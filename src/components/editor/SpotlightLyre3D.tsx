import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
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
}

// Realistic moving head (lyre) dimensions in meters
const BASE_RADIUS = 0.12;
const BASE_HEIGHT = 0.04;
const COLUMN_RADIUS = 0.025;
const COLUMN_HEIGHT = 0.08;
const YOKE_ARM_WIDTH = 0.02;
const YOKE_ARM_HEIGHT = 0.28;
const YOKE_ARM_DEPTH = 0.03;
const YOKE_GAP = 0.22; // distance between inner faces of yoke arms
const HEAD_RADIUS = 0.10;
const HEAD_LENGTH = 0.30;
const LENS_RADIUS = 0.085;
const LENS_DEPTH = 0.015;
const VENT_RING_RADIUS = 0.105;
const HANDLE_RADIUS = 0.008;
const HANDLE_LENGTH = 0.10;

const darkMetal = '#1a1a1a';
const mediumMetal = '#2a2a2a';
const headColor = '#222222';
const lensColor = '#88ccff';
const ventColor = '#111111';

export const SpotlightLyre3D: React.FC<SpotlightLyre3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  isPlaying,
  transformMode,
  orbitControlsRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const transformControlsRef = useRef<any>(null);

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
  }, [orbitControlsRef, transformMode, isSelected]);

  // Sync transform gizmo changes back
  useEffect(() => {
    if (transformControlsRef.current && groupRef.current && isSelected && transformMode) {
      const controls = transformControlsRef.current;
      const onObjectChange = () => {
        if (!groupRef.current) return;
        const pos = groupRef.current.position;
        const scale = groupRef.current.scale;
        // Only sync position and scale from gizmo — rotation is handled by pan/tilt sliders
        if (transformMode === 'translate') {
          onUpdateProperties({
            x: pos.x * 100,
            y: -pos.z * 100,
            z: pos.y * 100,
          });
        } else if (transformMode === 'scale') {
          onUpdateProperties({
            width: scale.x * 100,
            height: scale.z * 100,
            depth: scale.y * 100,
          });
        } else if (transformMode === 'rotate') {
          // For lyre, rotation gizmo controls pan (Y) and tilt (X)
          const rot = groupRef.current.rotation;
          onUpdateProperties({
            rotationY: THREE.MathUtils.radToDeg(-rot.y), // pan
          });
        }
      };
      controls.addEventListener('objectChange', onObjectChange);
      return () => controls.removeEventListener('objectChange', onObjectChange);
    }
  }, [transformMode, isSelected, onUpdateProperties]);

  // Z-up coordinate system
  const position: [number, number, number] = [
    properties.x / 100,
    properties.z / 100,
    -properties.y / 100,
  ];

  const uniformScale = (properties.width / 100 + properties.height / 100 + properties.depth / 100) / 3;

  // Pan = rotationY (horizontal), Tilt = rotationX (vertical head rotation)
  const panRad = THREE.MathUtils.degToRad(properties.rotationY);
  const tiltRad = THREE.MathUtils.degToRad(properties.rotationX);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect();
  };

  const content = (
    <group
      ref={groupRef}
      position={position}
      scale={[uniformScale, uniformScale, uniformScale]}
      onPointerDown={handlePointerDown}
    >
      {/* === BASE === */}
      {/* Main base plate */}
      <mesh position={[0, BASE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.1, BASE_HEIGHT, 32]} />
        <meshStandardMaterial color={darkMetal} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Base rubber feet (4) */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh key={`foot-${i}`} position={[Math.cos(angle) * BASE_RADIUS * 0.8, 0.005, Math.sin(angle) * BASE_RADIUS * 0.8]}>
            <cylinderGeometry args={[0.012, 0.012, 0.01, 8]} />
            <meshStandardMaterial color="#333" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Column from base to yoke */}
      <mesh position={[0, BASE_HEIGHT + COLUMN_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS * 1.2, COLUMN_HEIGHT, 16]} />
        <meshStandardMaterial color={mediumMetal} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* === YOKE (rotates with pan) === */}
      <group rotation={[0, panRad, 0]} position={[0, BASE_HEIGHT + COLUMN_HEIGHT, 0]}>
        {/* Left arm */}
        <mesh position={[-(YOKE_GAP / 2 + YOKE_ARM_WIDTH / 2), YOKE_ARM_HEIGHT / 2, 0]}>
          <boxGeometry args={[YOKE_ARM_WIDTH, YOKE_ARM_HEIGHT, YOKE_ARM_DEPTH]} />
          <meshStandardMaterial color={darkMetal} metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Right arm */}
        <mesh position={[(YOKE_GAP / 2 + YOKE_ARM_WIDTH / 2), YOKE_ARM_HEIGHT / 2, 0]}>
          <boxGeometry args={[YOKE_ARM_WIDTH, YOKE_ARM_HEIGHT, YOKE_ARM_DEPTH]} />
          <meshStandardMaterial color={darkMetal} metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Top bridge connecting the arms */}
        <mesh position={[0, YOKE_ARM_HEIGHT, 0]}>
          <boxGeometry args={[YOKE_GAP + YOKE_ARM_WIDTH * 2, YOKE_ARM_WIDTH, YOKE_ARM_DEPTH]} />
          <meshStandardMaterial color={darkMetal} metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Handles on yoke sides */}
        {[-1, 1].map(side => (
          <mesh key={`handle-${side}`} position={[side * (YOKE_GAP / 2 + YOKE_ARM_WIDTH + 0.01), YOKE_ARM_HEIGHT * 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 8]} />
            <meshStandardMaterial color="#444" metalness={0.4} roughness={0.5} />
          </mesh>
        ))}

        {/* === HEAD (rotates with tilt) === */}
        <group position={[0, YOKE_ARM_HEIGHT * 0.55, 0]} rotation={[tiltRad, 0, 0]}>
          {/* Head housing (main cylinder, horizontal) */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[HEAD_RADIUS, HEAD_RADIUS * 0.95, HEAD_LENGTH, 32]} />
            <meshStandardMaterial color={headColor} metalness={0.5} roughness={0.35} />
          </mesh>

          {/* Ventilation rings */}
          {[-0.08, -0.04, 0, 0.04, 0.08].map((z, i) => (
            <mesh key={`vent-${i}`} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[VENT_RING_RADIUS, 0.003, 4, 32]} />
              <meshStandardMaterial color={ventColor} metalness={0.3} roughness={0.7} />
            </mesh>
          ))}

          {/* Front lens */}
          <mesh position={[0, 0, -HEAD_LENGTH / 2 - LENS_DEPTH / 2]}>
            <cylinderGeometry args={[LENS_RADIUS, LENS_RADIUS, LENS_DEPTH, 32]} />
            <meshStandardMaterial
              color={lensColor}
              transparent
              opacity={0.7}
              metalness={0.1}
              roughness={0.1}
              emissive={lensColor}
              emissiveIntensity={0.3}
            />
          </mesh>

          {/* Lens ring */}
          <mesh position={[0, 0, -HEAD_LENGTH / 2 - LENS_DEPTH]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[LENS_RADIUS + 0.005, 0.005, 8, 32]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.2} />
          </mesh>

          {/* Back cap */}
          <mesh position={[0, 0, HEAD_LENGTH / 2 + 0.005]}>
            <cylinderGeometry args={[HEAD_RADIUS * 0.6, HEAD_RADIUS * 0.5, 0.02, 16]} />
            <meshStandardMaterial color={darkMetal} metalness={0.5} roughness={0.4} />
          </mesh>

          {/* Light beam (visible when selected) */}
          {isSelected && (
            <mesh position={[0, 0, -HEAD_LENGTH / 2 - 0.5]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.3, 1.0, 16, 1, true]} />
              <meshBasicMaterial
                color={lensColor}
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
        <mesh position={[0, YOKE_ARM_HEIGHT / 2 + BASE_HEIGHT, 0]}>
          <boxGeometry args={[0.4, YOKE_ARM_HEIGHT + 0.1, 0.4]} />
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
          mode={transformMode === 'rotate' ? 'rotate' : transformMode}
          size={0.75}
        />
      </>
    );
  }

  return content;
};
