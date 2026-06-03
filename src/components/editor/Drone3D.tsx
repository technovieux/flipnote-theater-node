import React from 'react';
import * as THREE from 'three';
import { EditorObject3D, Object3DProperties } from '@/types/editor';

interface Drone3DProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  /** Optional runtime position override (drone-mode physical playback). */
  runtimePosition?: [number, number, number];
}

export const Drone3D: React.FC<Drone3DProps> = ({ object, properties, isSelected, onSelect, runtimePosition }) => {
  // Editor (Z-up) -> Three (Y-up): (x, z, -y)
  const position: [number, number, number] = runtimePosition ?? [
    properties.x / 100,
    properties.z / 100,
    -properties.y / 100,
  ];
  const color = properties.color || '#88ccff';
  const size = 0.12;

  return (
    <group position={position} onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* LED core (emissive) */}
      <mesh>
        <sphereGeometry args={[size * 0.7, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {/* Small glow point light */}
      <pointLight color={color} intensity={0.6} distance={2} decay={1.5} />
      {/* Propeller arms — four thin sticks in cross */}
      {[0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * size * 1.2, 0, Math.sin(a) * size * 1.2]}>
          <boxGeometry args={[size * 0.9, size * 0.05, size * 0.05]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      ))}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[size * 1.5, 12, 12]} />
          <meshBasicMaterial color="#00d4ff" wireframe transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
};