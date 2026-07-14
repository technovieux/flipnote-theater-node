import React, { useRef, useEffect } from 'react';
import { TransformControls } from '@react-three/drei';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import * as THREE from 'three';

type TransformMode = 'translate' | 'rotate' | 'scale' | null;

interface SpotlightFlat3DProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
  transformMode: TransformMode;
  orbitControlsRef: React.RefObject<any>;
}

/**
 * Flat round spotlight (PAR-style). Free rotation on all axes via gizmo.
 * Emits a smaller cone of light than the lyre.
 */
export const SpotlightFlat3D: React.FC<SpotlightFlat3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  transformMode,
  orbitControlsRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const transformControlsRef = useRef<any>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);

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
        } else if (transformMode === 'scale') {
          const s = groupRef.current.scale;
          onUpdateProperties({ width: s.x * 100, height: s.z * 100, depth: s.y * 100 });
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

  // Z-up coords (same convention as SpotlightLyre3D)
  const position: [number, number, number] = [
    properties.x / 100,
    properties.z / 100,
    -properties.y / 100,
  ];
  const uniformScale = (properties.width / 100 + properties.height / 100 + properties.depth / 100) / 3;

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(properties.rotationX),
    THREE.MathUtils.degToRad(properties.rotationY),
    THREE.MathUtils.degToRad(properties.rotationZ ?? 0),
  ];

  const lightColor = properties.color || '#ffffff';
  const powerFactor = Math.max(0, (properties.spotPower ?? 100)) / 100;
  const lightIntensity = Math.max(0.05, (properties.opacity ?? 100) / 100) * 3 * powerFactor;

  // Smaller cone than the lyre
  const coneRadius = 0.25 * powerFactor;
  const coneLength = 1.2 * powerFactor;
  const coneCenterY = -coneLength / 2; // emit downward along local -Y

  // Decompose the current color into per-LED (R/G/B/W) channel levels (0..1).
  // Dimmer/intensity comes from opacity so the LEDs dim in sync with the emitted beam.
  const dimmer = Math.max(0, Math.min(1, (properties.opacity ?? 100) / 100));
  const hexMatch = /^#?([0-9a-f]{6})$/i.exec(lightColor);
  const rgbInt = hexMatch ? parseInt(hexMatch[1], 16) : 0xffffff;
  const rNorm = ((rgbInt >> 16) & 0xff) / 255;
  const gNorm = ((rgbInt >> 8) & 0xff) / 255;
  const bNorm = (rgbInt & 0xff) / 255;
  const wNorm = Math.min(rNorm, gNorm, bNorm); // white contribution
  const channelLevels = [
    rNorm * dimmer,
    gNorm * dimmer,
    bNorm * dimmer,
    wNorm * dimmer,
  ];
  const ledPalette: [number, number, number][] = [
    [1, 0.1, 0.1],   // Red
    [0.1, 1, 0.1],   // Green
    [0.15, 0.3, 1],  // Blue
    [1, 1, 1],       // White
  ];

  // Build ring positions on the bottom lens face (local -Y).
  const buildRing = (count: number, radius: number, offset = 0) =>
    Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + offset;
      const idx = i % 4;
      return {
        key: `${count}-${i}`,
        pos: [Math.cos(angle) * radius, -0.028, Math.sin(angle) * radius] as [number, number, number],
        idx,
      };
    });
  const outerLeds = buildRing(12, 0.11);
  const innerLeds = buildRing(6, 0.055, Math.PI / 6);
  const ledSize = 0.014;

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const content = (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={[uniformScale, uniformScale, uniformScale]}
      onPointerDown={handlePointerDown}
    >
      {/* Flat disc body */}
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 0.05, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Dark lens plate on the bottom face — hosts the individual LEDs */}
      <mesh position={[0, -0.026, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.008, 32]} />
        <meshStandardMaterial color="#050505" metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Individual R/G/B/W LEDs — each only lights up when its channel is active */}
      {[...outerLeds, ...innerLeds].map(({ key, pos, idx }) => {
        const level = channelLevels[idx];
        const [pr, pg, pb] = ledPalette[idx];
        const litColor = new THREE.Color(pr * level, pg * level, pb * level);
        return (
          <mesh key={key} position={pos}>
            <sphereGeometry args={[ledSize, 10, 10]} />
            <meshStandardMaterial
              color={litColor}
              emissive={litColor}
              emissiveIntensity={0.8 + 2.5 * level}
              toneMapped={false}
            />
          </mesh>
        );
      })}
      {/* Volumetric cone (pointing down -Y) */}
      <mesh position={[0, coneCenterY, 0]}>
        <coneGeometry args={[coneRadius, coneLength, 24, 1, true]} />
        <meshBasicMaterial
          color={lightColor}
          transparent
          opacity={0.16 * dimmer}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Real spotLight */}
      <spotLight
        ref={spotLightRef}
        position={[0, -0.03, 0]}
        color={lightColor}
        intensity={lightIntensity}
        angle={Math.min(Math.PI / 4, (Math.PI / 9) * Math.max(0.3, powerFactor))}
        penumbra={0.4}
        distance={20 * Math.max(0.3, powerFactor)}
        decay={1.2}
        castShadow
      />
      <object3D ref={spotTargetRef} position={[0, -10, 0]} />

      {isSelected && !transformMode && (
        <mesh>
          <boxGeometry args={[0.4, 0.15, 0.4]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.1} wireframe />
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
          mode={transformMode}
          size={0.75}
        />
      </>
    );
  }

  return content;
};