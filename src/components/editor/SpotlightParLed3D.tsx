import React, { useRef, useEffect } from 'react';
import { TransformControls } from '@react-three/drei';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import * as THREE from 'three';

type TransformMode = 'translate' | 'rotate' | 'scale' | null;

interface SpotlightParLed3DProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
  transformMode: TransformMode;
  orbitControlsRef: React.RefObject<any>;
}

/**
 * Flat round PAR LED spotlight with independent R/G/B/W channels + master dimmer.
 * The visible LEDs light up per-channel; the emitted beam color is the mix of active channels.
 */
export const SpotlightParLed3D: React.FC<SpotlightParLed3DProps> = ({
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

  const powerFactor = Math.max(0, (properties.spotPower ?? 100)) / 100;

  // Per-channel DMX values (0..255), default all off with dimmer full.
  const dmxR = Math.max(0, Math.min(255, properties.ledR ?? 0));
  const dmxG = Math.max(0, Math.min(255, properties.ledG ?? 0));
  const dmxB = Math.max(0, Math.min(255, properties.ledB ?? 0));
  const dmxW = Math.max(0, Math.min(255, properties.ledW ?? 0));
  const dmxDim = Math.max(0, Math.min(255, properties.ledDimmer ?? 255));

  const dim = dmxDim / 255;
  const levels = [
    (dmxR / 255) * dim,
    (dmxG / 255) * dim,
    (dmxB / 255) * dim,
    (dmxW / 255) * dim,
  ];

  // Mixed emitted color (R + G + B + W, clamped).
  const mixR = Math.min(1, levels[0] + levels[3]);
  const mixG = Math.min(1, levels[1] + levels[3]);
  const mixB = Math.min(1, levels[2] + levels[3]);
  const beamStrength = Math.max(mixR, mixG, mixB);
  const beamColor = new THREE.Color(
    beamStrength > 0 ? mixR / beamStrength : 0,
    beamStrength > 0 ? mixG / beamStrength : 0,
    beamStrength > 0 ? mixB / beamStrength : 0,
  );

  const lightIntensity = beamStrength * 3 * powerFactor;

  const coneRadius = 0.25 * powerFactor;
  const coneLength = 1.2 * powerFactor;
  const coneCenterY = -coneLength / 2;

  const ledPalette: [number, number, number][] = [
    [1, 0.1, 0.1],
    [0.1, 1, 0.1],
    [0.15, 0.3, 1],
    [1, 1, 1],
  ];
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
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 0.05, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.026, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.008, 32]} />
        <meshStandardMaterial color="#050505" metalness={0.2} roughness={0.6} />
      </mesh>
      {[...outerLeds, ...innerLeds].map(({ key, pos, idx }) => {
        const level = levels[idx];
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
      <mesh position={[0, coneCenterY, 0]}>
        <coneGeometry args={[coneRadius, coneLength, 24, 1, true]} />
        <meshBasicMaterial
          color={beamColor}
          transparent
          opacity={0.16 * beamStrength}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <spotLight
        ref={spotLightRef}
        position={[0, -0.03, 0]}
        color={beamColor}
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