import React, { useRef, useEffect, useMemo, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EditorObject3D, Object3DProperties, VideoTrack } from '@/types/editor';
import { registerVideoElement, unregisterVideoElement } from '@/lib/videoElementRegistry';
import { removeVideoProjection, setVideoProjection } from '@/lib/videoProjection';

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
 * Mapping video projector — square/rectangular projected video.
 * A projector-depth pass is used so only the closest surface in the beam receives
 * the image; surfaces behind it are masked like real-world projection shadows.
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
  const projectorCameraRef = useRef<THREE.PerspectiveCamera>(new THREE.PerspectiveCamera(45, 1, 0.05, 8));
  const projectorMatrixRef = useRef(new THREE.Matrix4());
  const depthMaterialRef = useRef(new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, side: THREE.DoubleSide }));
  const { gl, scene } = useThree();
  const [videoAspect, setVideoAspect] = useState(16 / 9);

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

  useEffect(() => {
    if (!videoEl) {
      setVideoAspect(16 / 9);
      return;
    }

    const updateAspect = () => {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        setVideoAspect(videoEl.videoWidth / videoEl.videoHeight);
      }
    };

    videoEl.addEventListener('loadedmetadata', updateAspect);
    updateAspect();
    return () => videoEl.removeEventListener('loadedmetadata', updateAspect);
  }, [videoEl]);

  // Keystone offsets (screen-space corners in normalized [-0.5..0.5]).
  const kTL = properties.keystoneTL ?? { x: 0, y: 0 };
  const kTR = properties.keystoneTR ?? { x: 0, y: 0 };
  const kBR = properties.keystoneBR ?? { x: 0, y: 0 };
  const kBL = properties.keystoneBL ?? { x: 0, y: 0 };

  const depthTarget = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1024, 1024);
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    target.depthTexture = new THREE.DepthTexture(1024, 1024);
    target.depthTexture.type = THREE.UnsignedShortType;
    target.depthTexture.format = THREE.DepthFormat;
    return target;
  }, []);

  useEffect(() => () => {
    removeVideoProjection(object.id);
    depthTarget.dispose();
    depthTarget.depthTexture?.dispose();
    depthMaterialRef.current.dispose();
  }, [depthTarget, object.id]);

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

  // Base projection footprint at throwDistance. Width is driven by throwRatio;
  // height follows the video's native aspect ratio so the image is not stretched.
  const halfW = throwDistance * throwRatio * 0.5;
  const halfH = halfW / Math.max(0.1, videoAspect);

  useEffect(() => {
    const camera = projectorCameraRef.current;
    camera.aspect = Math.max(0.1, videoAspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / throwDistance));
    camera.near = 0.05;
    camera.far = throwDistance;
    camera.updateProjectionMatrix();
  }, [halfH, throwDistance, videoAspect]);

  useFrame(() => {
    const camera = projectorCameraRef.current;
    const group = groupRef.current;
    if (!group) return;

    group.updateWorldMatrix(true, false);
    camera.position.setFromMatrixPosition(group.matrixWorld);
    group.getWorldQuaternion(camera.quaternion);
    camera.updateMatrixWorld(true);

    const previousTarget = gl.getRenderTarget();
    const previousOverride = scene.overrideMaterial;
    const hiddenObjects: THREE.Object3D[] = [];

    scene.traverse((child) => {
      const renderable = child as THREE.Object3D & {
        isMesh?: boolean;
        isLine?: boolean;
        isPoints?: boolean;
        isSprite?: boolean;
      };
      const isRenderable = Boolean(renderable.isMesh || renderable.isLine || renderable.isPoints || renderable.isSprite);
      if (!isRenderable || child.userData.videoProjectionSurface || !child.visible) return;
      hiddenObjects.push(child);
      child.visible = false;
    });

    const videoReady = Boolean(
      videoTexture &&
      videoEl &&
      videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      opacity > 0
    );

    if (videoReady) {
      scene.overrideMaterial = depthMaterialRef.current;
      gl.setRenderTarget(depthTarget);
      gl.clear();
      gl.render(scene, camera);
      scene.overrideMaterial = previousOverride;
      hiddenObjects.forEach((child) => {
        child.visible = true;
      });
      gl.setRenderTarget(previousTarget);
    } else {
      hiddenObjects.forEach((child) => {
        child.visible = true;
      });
      scene.overrideMaterial = previousOverride;
      gl.setRenderTarget(previousTarget);
    }

    if (videoTexture) {
      videoTexture.needsUpdate = true;
    }

    projectorMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    setVideoProjection({
      id: object.id,
      enabled: videoReady,
      projectorMatrix: projectorMatrixRef.current,
      videoTexture: videoTexture ?? depthTarget.texture,
      depthTexture: depthTarget.depthTexture,
      opacity,
      intensity: 1.5,
      corners: {
        bl: new THREE.Vector2(kBL.x, kBL.y),
        br: new THREE.Vector2(1 + kBR.x, kBR.y),
        tr: new THREE.Vector2(1 + kTR.x, 1 + kTR.y),
        tl: new THREE.Vector2(kTL.x, 1 + kTL.y),
      },
    });
  }, -1);

  // Rectangular frustum beam — cross-section follows video aspect + keystone footprint.
  const beamGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // Apex at (0,0,0), base at z = -throwDistance with keystone offsets.
    const bl: [number, number, number] = [-halfW + kBL.x * 2 * halfW, -halfH + kBL.y * 2 * halfH, -throwDistance];
    const br: [number, number, number] = [ halfW + kBR.x * 2 * halfW, -halfH + kBR.y * 2 * halfH, -throwDistance];
    const tr: [number, number, number] = [ halfW + kTR.x * 2 * halfW,  halfH + kTR.y * 2 * halfH, -throwDistance];
    const tl: [number, number, number] = [-halfW + kTL.x * 2 * halfW,  halfH + kTL.y * 2 * halfH, -throwDistance];
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
  }, [halfW, halfH, throwDistance, kTL.x, kTL.y, kTR.x, kTR.y, kBR.x, kBR.y, kBL.x, kBL.y]);

  useEffect(() => () => { beamGeometry.dispose(); }, [beamGeometry]);

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