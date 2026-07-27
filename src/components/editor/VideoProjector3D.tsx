import React, { useRef, useEffect, useMemo } from 'react';
import { TransformControls } from '@react-three/drei';
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

/**
 * Mapping video projector.
 *
 * Renders:
 *  - a black box body with a lens,
 *  - a translucent volumetric beam cone,
 *  - an ACTUAL projected image at `throwDistance` in front of the projector
 *    (a plane whose 4 corners are offset by the keystone offsets so the
 *     user can adapt the image to the target surface).
 *
 * The plane is textured with the linked video via a hidden <video> element +
 * `THREE.VideoTexture`. Playback is driven by the timeline through the
 * `videoElementRegistry` (see AnimationEditor).
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

  // Create a hidden <video> element for the linked track and expose it via the registry
  // so the timeline can drive playback for every projector globally.
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

  // VideoTexture bound to the element (or a fallback checkerboard for "no video assigned")
  const videoTexture = useMemo(() => {
    if (!videoEl) return null;
    const tex = new THREE.VideoTexture(videoEl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoEl]);

  useEffect(() => () => { videoTexture?.dispose(); }, [videoTexture]);

  // Real spotlight (illumination only — no map projection, keystone is on the plane)
  useEffect(() => {
    if (spotLightRef.current && spotTargetRef.current) {
      spotLightRef.current.target = spotTargetRef.current;
      spotLightRef.current.target.updateMatrixWorld();
    }
  }, []);

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

  // Keystone offsets (default 0). Corners follow TL, TR, BR, BL convention (screen space).
  const kTL = properties.keystoneTL ?? { x: 0, y: 0 };
  const kTR = properties.keystoneTR ?? { x: 0, y: 0 };
  const kBR = properties.keystoneBR ?? { x: 0, y: 0 };
  const kBL = properties.keystoneBL ?? { x: 0, y: 0 };

  // Projection plane sits at local -Z = -throwDistance from the projector body.
  // Base half-size derived from throw distance × throw ratio.
  const halfW = throwDistance * throwRatio * 0.5;
  const halfH = halfW * (9 / 16); // default 16:9 aspect

  // Build a keystone-deformed plane geometry (2 triangles, 4 vertices).
  const planeGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // Corners: BL, BR, TR, TL
    const positions = new Float32Array([
      -halfW + kBL.x * halfW * 2, -halfH + kBL.y * halfH * 2, 0,
       halfW + kBR.x * halfW * 2, -halfH + kBR.y * halfH * 2, 0,
       halfW + kTR.x * halfW * 2,  halfH + kTR.y * halfH * 2, 0,
      -halfW + kTL.x * halfW * 2,  halfH + kTL.y * halfH * 2, 0,
    ]);
    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
  }, [halfW, halfH, kTL.x, kTL.y, kTR.x, kTR.y, kBR.x, kBR.y, kBL.x, kBL.y]);

  useEffect(() => () => { planeGeometry.dispose(); }, [planeGeometry]);

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

      {/* Volumetric beam — cone opening along local -Z toward the plane */}
      <mesh position={[0, 0, -throwDistance / 2 - 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[Math.max(halfW, halfH) * 1.05, throwDistance, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08 * opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Projected image plane (keystone-deformed) at -Z */}
      <mesh
        geometry={planeGeometry}
        position={[0, 0, -throwDistance - 0.3]}
      >
        {videoTexture ? (
          <meshBasicMaterial
            map={videoTexture}
            side={THREE.DoubleSide}
            transparent
            opacity={opacity}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        ) : (
          <meshBasicMaterial
            color="#222"
            side={THREE.DoubleSide}
            transparent
            opacity={0.4 * opacity}
            wireframe
          />
        )}
      </mesh>

      {/* Real light for scene illumination flavor */}
      <spotLight
        ref={spotLightRef}
        position={[0, 0, -0.3]}
        color={color}
        intensity={0.6 * opacity}
        angle={Math.min(Math.PI / 3, Math.atan((halfW * 1.2) / throwDistance))}
        penumbra={0.5}
        distance={throwDistance * 1.2}
        decay={1.3}
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