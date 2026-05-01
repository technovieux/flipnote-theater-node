import React, { useRef, useState, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import { loadFixture, LoadedFixture, LoadedFixturePart } from '@/lib/fixtureLoader';
import * as THREE from 'three';

type TransformMode = 'translate' | 'rotate' | 'scale' | null;

interface SpotlightLyre3DProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
  isPlaying: boolean;
  transformMode: TransformMode;
  orbitControlsRef: React.RefObject<any>;
  fixtureId?: string;
}

export const SpotlightLyre3D: React.FC<SpotlightLyre3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  isPlaying,
  transformMode,
  orbitControlsRef,
  fixtureId = 'lyre_spot_150w',
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const yokeRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const transformControlsRef = useRef<any>(null);

  const [rotateTarget, setRotateTarget] = useState<'pan' | 'tilt'>('pan');
  const [loadedFixture, setLoadedFixture] = useState<LoadedFixture | null>(null);

  // Load the fixture OBJ parts
  useEffect(() => {
    loadFixture(fixtureId).then(setLoadedFixture).catch(console.error);
  }, [fixtureId]);

  // Disable orbit controls during gizmo drag
  useEffect(() => {
    if (transformControlsRef.current && orbitControlsRef.current) {
      const controls = transformControlsRef.current;
      const onDraggingChanged = (event: any) => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = !event.value;
        }
      };
      controls.addEventListener('dragging-changed', onDraggingChanged);
      return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
    }
  }, [orbitControlsRef, transformMode, isSelected, rotateTarget]);

  // Sync transform gizmo changes back to properties
  useEffect(() => {
    const targetRef = transformMode === 'rotate'
      ? (rotateTarget === 'pan' ? yokeRef : headRef)
      : groupRef;

    if (transformControlsRef.current && targetRef.current && isSelected && transformMode) {
      const controls = transformControlsRef.current;
      const onObjectChange = () => {
        if (!targetRef.current) return;

        if (transformMode === 'translate' && groupRef.current) {
          const pos = groupRef.current.position;
          onUpdateProperties({
            x: pos.x * 100,
            y: -pos.z * 100,
            z: pos.y * 100,
          });
        } else if (transformMode === 'scale' && groupRef.current) {
          const scale = groupRef.current.scale;
          onUpdateProperties({
            width: scale.x * 100,
            height: scale.z * 100,
            depth: scale.y * 100,
          });
        } else if (transformMode === 'rotate') {
          if (rotateTarget === 'pan' && yokeRef.current) {
            onUpdateProperties({
              rotationY: THREE.MathUtils.radToDeg(yokeRef.current.rotation.y),
            });
          } else if (rotateTarget === 'tilt' && headRef.current) {
            onUpdateProperties({
              rotationX: THREE.MathUtils.radToDeg(headRef.current.rotation.x),
            });
          }
        }
      };
      controls.addEventListener('objectChange', onObjectChange);
      return () => controls.removeEventListener('objectChange', onObjectChange);
    }
  }, [transformMode, isSelected, onUpdateProperties, rotateTarget]);

  // Z-up coordinate system
  const position: [number, number, number] = [
    properties.x / 100,
    properties.z / 100,
    -properties.y / 100,
  ];

  const uniformScale = (properties.width / 100 + properties.height / 100 + properties.depth / 100) / 3;
  const panRad = THREE.MathUtils.degToRad(properties.rotationY);
  const tiltRad = THREE.MathUtils.degToRad(properties.rotationX);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const getTransformTarget = () => {
    if (transformMode === 'rotate') {
      return rotateTarget === 'pan' ? yokeRef.current : headRef.current;
    }
    return groupRef.current;
  };

  const transformTarget = getTransformTarget();

  // Find parts by role
  const basePart = loadedFixture?.parts.find(p => p.name === 'base');
  const yokePart = loadedFixture?.parts.find(p => p.name === 'yoke');
  const headPart = loadedFixture?.parts.find(p => p.name === 'head');

  const renderPart = (part: LoadedFixturePart) => (
    <mesh geometry={part.geometry}>
      <meshStandardMaterial
        color={part.material.color}
        metalness={part.material.metalness ?? 0.5}
        roughness={part.material.roughness ?? 0.4}
      />
    </mesh>
  );

  const content = (
    <group
      ref={groupRef}
      position={position}
      scale={[uniformScale, uniformScale, uniformScale]}
      onPointerDown={handlePointerDown}
    >
      {/* === BASE (never rotates) === */}
      {basePart && renderPart(basePart)}

      {/* === YOKE (pan = rotation around vertical Y axis only) === */}
      <group
        ref={yokeRef}
        rotation={[0, panRad, 0]}
        position={yokePart ? yokePart.pivot : [0, 0.12, 0]}
      >
        {yokePart && renderPart(yokePart)}

        {/* === HEAD (tilt = rotation around horizontal X axis only) === */}
        <group
          ref={headRef}
          position={headPart ? [
            headPart.pivot[0] - (yokePart?.pivot[0] ?? 0),
            headPart.pivot[1] - (yokePart?.pivot[1] ?? 0),
            headPart.pivot[2] - (yokePart?.pivot[2] ?? 0),
          ] : [0, 0.034, 0]}
          rotation={[tiltRad, 0, 0]}
        >
          {headPart && renderPart(headPart)}

          {/* Lens glow */}
          {headPart?.lens && (
            <mesh position={headPart.lens.position}>
              <cylinderGeometry args={[headPart.lens.radius, headPart.lens.radius, 0.015, 32]} />
              <meshStandardMaterial
                color={headPart.lens.color}
                transparent
                opacity={0.7}
                metalness={0.1}
                roughness={0.1}
                emissive={headPart.lens.color}
                emissiveIntensity={0.3}
              />
            </mesh>
          )}

          {/* Light beam (visible when selected) */}
          {isSelected && (
            <mesh position={[0, -0.65, 0]}>
              <coneGeometry args={[0.3, 1.0, 16, 1, true]} />
              <meshBasicMaterial
                color="#88ccff"
                transparent
                opacity={0.08}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      </group>

      {/* Selection indicator */}
      {isSelected && !transformMode && (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.4, 0.5, 0.4]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.1} wireframe />
        </mesh>
      )}

      {/* Rotate target indicator */}
      {isSelected && transformMode === 'rotate' && (
        <group position={[0, 0.5, 0]}>
          <mesh>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={rotateTarget === 'pan' ? '#4f4' : '#44f'} />
          </mesh>
        </group>
      )}

      {/* Loading placeholder if not loaded yet */}
      {!loadedFixture && (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.2, 0.4, 0.2]} />
          <meshStandardMaterial color="#666" transparent opacity={0.5} wireframe />
        </mesh>
      )}
    </group>
  );

  if (isSelected && transformMode && transformTarget) {
    return (
      <>
        {content}
        <TransformControls
          ref={transformControlsRef}
          object={transformTarget}
          mode={transformMode === 'rotate' ? 'rotate' : transformMode}
          size={0.75}
        />
      </>
    );
  }

  return content;
};
