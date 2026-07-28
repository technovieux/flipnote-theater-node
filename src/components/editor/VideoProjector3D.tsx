import React, { useRef, useEffect, useMemo } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EditorObject3D, Object3DProperties, VideoTrack } from '@/types/editor';
import { registerVideoElement, unregisterVideoElement } from '@/lib/videoElementRegistry';

type TransformMode = 'translate' | 'rotate' | 'scale' | null;

interface VideoProjector3DProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
  transformMode: TransformMode;
  orbitControlsRef: React.RefObject<any>;
  videoTrack: VideoTrack | undefined;
}

// Central inscribed square (in map UV) that will be lit inside the cone.
// cone circumscribes the target square => half-size in UV = 1/(2*sqrt(2)).
const HALF_UV = 1 / (2 * Math.SQRT2); // ~0.3536

const KEYSTONE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Inverse-bilinear warp of the video into a keystone-deformed quad inside the RT.
// Outside the quad => black => spotlight projects no light there (square beam mask).
const KEYSTONE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform int uHasMap;
uniform vec2 uBL, uBR, uTR, uTL;
varying vec2 vUv;

vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  vec2 e = b - a;
  vec2 f = d - a;
  vec2 g = a - b + c - d;
  vec2 h = p - a;
  float k2 = g.x*f.y - g.y*f.x;
  float k1 = e.x*f.y - e.y*f.x + h.x*g.y - h.y*g.x;
  float k0 = h.x*e.y - h.y*e.x;
  float s, t;
  if (abs(k2) < 1e-5) {
    s = (abs(k1) < 1e-5) ? -1.0 : (-k0 / k1);
  } else {
    float w = k1*k1 - 4.0*k0*k2;
    if (w < 0.0) return vec2(-1.0);
    w = sqrt(w);
    float s1 = (-k1 - w) / (2.0*k2);
    float s2 = (-k1 + w) / (2.0*k2);
    s = (s1 >= 0.0 && s1 <= 1.0) ? s1 : s2;
  }
  vec2 den = mix(f, c - b, s);
  t = (abs(den.x) > abs(den.y)) ? (h.x - e.x*s) / den.x : (h.y - e.y*s) / den.y;
  return vec2(s, t);
}

void main() {
  vec2 st = invBilinear(vUv, uBL, uBR, uTR, uTL);
  if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 col = (uHasMap == 1) ? texture2D(uMap, vec2(st.x, 1.0 - st.y)).rgb : vec3(0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Mapping video projector — real projection.
 *
 * The video is baked (keystone-warped, black outside the deformed quad) into a
 * WebGLRenderTarget every frame. That texture is fed to a `SpotLight.map`
 * with shadows enabled, so it is projected onto the actual scene surfaces:
 *   - only the front-most surface is lit (shadow map occlusion),
 *   - if nothing is in the beam, nothing is drawn,
 *   - the cone opens as a square (thanks to the black mask outside the quad).
 */
export const VideoProjector3D: React.FC<VideoProjector3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  transformMode,
  orbitControlsRef,
  videoTrack,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const transformControlsRef = useRef<any>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);
  const { gl } = useThree();

  // Editor (Z-up) -> Three (Y-up): (x, z, -y)
  const position: [number, number, number] = [
    properties.x / 100,
    properties.z / 100,
    -properties.y / 100,
  ];
  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(properties.rotationX),
    THREE.MathUtils.degToRad(properties.rotationY),
    THREE.MathUtils.degToRad(properties.rotationZ ?? 0),
  ];

  const throwDistance = Math.max(0.5, properties.throwDistance ?? 8);
  const throwRatio = Math.max(0.2, properties.throwRatio ?? 0.6);
  const opacity = Math.max(0, Math.min(1, (properties.opacity ?? 100) / 100));
  const color = properties.color || '#ffffff';

  const videoEl = useMemo(() => {
    if (!videoTrack?.url) return null;
    const el = document.createElement('video');
    el.src = videoTrack.url;
    el.crossOrigin = 'anonymous';
    el.muted = true;
    el.loop = false;
    el.playsInline = true;
    el.preload = 'auto';
    return el;
  }, [videoTrack?.url]);

  useEffect(() => {
    if (!videoEl || !videoTrack) return;
    registerVideoElement(videoTrack.id, videoEl);
    return () => unregisterVideoElement(videoTrack.id, videoEl);
  }, [videoEl, videoTrack?.id]);

  const videoTexture = useMemo(() => {
    if (!videoEl) return null;
    const tex = new THREE.VideoTexture(videoEl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoEl]);

  useEffect(() => () => { videoTexture?.dispose(); }, [videoTexture]);

  // Keystone offsets (screen-space corners in normalized [-0.5..0.5]).
  const kTL = properties.keystoneTL ?? { x: 0, y: 0 };
  const kTR = properties.keystoneTR ?? { x: 0, y: 0 };
  const kBR = properties.keystoneBR ?? { x: 0, y: 0 };
  const kBL = properties.keystoneBL ?? { x: 0, y: 0 };

  // Offscreen render target + shader scene for the projected map.
  const projected = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1024, 1024, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      generateMipmaps: false,
    });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.ShaderMaterial({
      vertexShader: KEYSTONE_VERT,
      fragmentShader: KEYSTONE_FRAG,
      uniforms: {
        uMap: { value: null },
        uHasMap: { value: 0 },
        uBL: { value: new THREE.Vector2() },
        uBR: { value: new THREE.Vector2() },
        uTR: { value: new THREE.Vector2() },
        uTL: { value: new THREE.Vector2() },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { rt, scene, camera, material };
  }, []);

  useEffect(() => () => {
    projected.rt.dispose();
    projected.material.dispose();
    (projected.scene.children[0] as THREE.Mesh).geometry.dispose();
  }, [projected]);

  // Update uniforms whenever the keystone / video changes.
  useEffect(() => {
    const m = projected.material;
    m.uniforms.uMap.value = videoTexture;
    m.uniforms.uHasMap.value = videoTexture ? 1 : 0;
    // Base inscribed-square corners in RT UV space, then apply keystone offsets
    // (offsets are in fraction of the square side; UV side length = 2*HALF_UV).
    const c = 0.5;
    const h = HALF_UV;
    const sz = 2 * HALF_UV;
    m.uniforms.uBL.value.set(c - h + kBL.x * sz, c - h + kBL.y * sz);
    m.uniforms.uBR.value.set(c + h + kBR.x * sz, c - h + kBR.y * sz);
    m.uniforms.uTR.value.set(c + h + kTR.x * sz, c + h + kTR.y * sz);
    m.uniforms.uTL.value.set(c - h + kTL.x * sz, c + h + kTL.y * sz);
  }, [projected, videoTexture, kTL.x, kTL.y, kTR.x, kTR.y, kBR.x, kBR.y, kBL.x, kBL.y]);

  // Bake the projected map every frame (video keeps changing).
  useFrame(() => {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(projected.rt);
    gl.render(projected.scene, projected.camera);
    gl.setRenderTarget(prev);
  });

  // Real spotlight — carries the projected map onto the scene, with shadows.
  useEffect(() => {
    if (spotLightRef.current && spotTargetRef.current) {
      spotLightRef.current.target = spotTargetRef.current;
      spotLightRef.current.target.updateMatrixWorld();
    }
    const sl = spotLightRef.current;
    if (sl) {
      sl.map = projected.rt.texture as any;
      sl.castShadow = true;
      sl.shadow.mapSize.set(1024, 1024);
      sl.shadow.bias = -0.0005;
      sl.shadow.camera.near = 0.1;
      sl.shadow.camera.far = throwDistance + 1;
    }
  }, [projected, throwDistance]);

  // Disable orbit controls during gizmo drag
  useEffect(() => {
    if (transformControlsRef.current && orbitControlsRef.current) {
      const controls = transformControlsRef.current;
      const onDraggingChanged = (event: any) => {
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = !event.value;
      };
      controls.addEventListener('dragging-changed', onDraggingChanged);
      return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
    }
  }, [orbitControlsRef, transformMode, isSelected]);

  // Sync gizmo back to properties
  useEffect(() => {
    if (transformControlsRef.current && groupRef.current && isSelected && transformMode) {
      const controls = transformControlsRef.current;
      const onObjectChange = () => {
        if (!groupRef.current) return;
        if (transformMode === 'translate') {
          const p = groupRef.current.position;
          onUpdateProperties({ x: p.x * 100, y: -p.z * 100, z: p.y * 100 });
        } else if (transformMode === 'rotate') {
          const r = groupRef.current.rotation;
          onUpdateProperties({
            rotationX: THREE.MathUtils.radToDeg(r.x),
            rotationY: THREE.MathUtils.radToDeg(r.y),
            rotationZ: THREE.MathUtils.radToDeg(r.z),
          });
        }
      };
      controls.addEventListener('objectChange', onObjectChange);
      return () => controls.removeEventListener('objectChange', onObjectChange);
    }
  }, [transformMode, isSelected, onUpdateProperties]);

  // Base square footprint at throwDistance.
  const halfW = throwDistance * throwRatio * 0.5;

  // Square-frustum beam wireframe (subtle) — cross-section = the square keystone footprint.
  const beamGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const s = halfW;
    // Apex at (0,0,0), base at z = -throwDistance with keystone offsets.
    const bl: [number, number, number] = [-s + kBL.x * 2 * s, -s + kBL.y * 2 * s, -throwDistance];
    const br: [number, number, number] = [ s + kBR.x * 2 * s, -s + kBR.y * 2 * s, -throwDistance];
    const tr: [number, number, number] = [ s + kTR.x * 2 * s,  s + kTR.y * 2 * s, -throwDistance];
    const tl: [number, number, number] = [-s + kTL.x * 2 * s,  s + kTL.y * 2 * s, -throwDistance];
    const apex: [number, number, number] = [0, 0, 0];
    const pts: number[] = [];
    // Four side triangles from apex.
    const sides: [number[], number[]][] = [
      [bl, br],
      [br, tr],
      [tr, tl],
      [tl, bl],
    ];
    for (const [a, b] of sides) {
      pts.push(...apex, ...a, ...b);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    g.computeVertexNormals();
    return g;
  }, [halfW, throwDistance, kTL.x, kTL.y, kTR.x, kTR.y, kBR.x, kBR.y, kBL.x, kBL.y]);

  useEffect(() => () => { beamGeometry.dispose(); }, [beamGeometry]);

  // SpotLight angle so the cone circumscribes the square footprint (half-diagonal).
  const spotAngle = Math.min(Math.PI / 2.5, Math.atan((halfW * Math.SQRT2) / throwDistance));

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const content = (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerDown={handlePointerDown}
    >
      {/* Projector body */}
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.25, 0.55]} />
        <meshStandardMaterial color="#141414" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.06, 24]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0, -0.31]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.005, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9 * opacity}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Square-frustum volumetric beam (subtle, additive) */}
      <mesh geometry={beamGeometry} position={[0, 0, -0.3]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.06 * opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Real projecting light — casts the video onto scene geometry with shadows. */}
      <spotLight
        ref={spotLightRef}
        position={[0, 0, -0.3]}
        color={color}
        intensity={6 * opacity}
        angle={spotAngle}
        penumbra={0.02}
        distance={throwDistance}
        decay={0.4}
      />
      <object3D ref={spotTargetRef} position={[0, 0, -throwDistance]} />

      {isSelected && !transformMode && (
        <mesh>
          <boxGeometry args={[0.45, 0.3, 0.6]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.15} wireframe />
        </mesh>
      )}
    </group>
  );

  if (isSelected && transformMode && groupRef.current) {
    return (
      <>
        {content}
        <TransformControls
          ref={transformControlsRef}
          object={groupRef.current}
          mode={transformMode === 'scale' ? 'translate' : transformMode}
          size={0.75}
          showZ={transformMode === 'rotate' ? false : true}
        />
      </>
    );
  }

  return content;
};