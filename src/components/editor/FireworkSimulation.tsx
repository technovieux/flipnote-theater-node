import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EditorObject3D } from '@/types/editor';
import { FireworkProduct } from '@/types/fireworks';

interface FireworkSimulationProps {
  objects: EditorObject3D[];
  currentTime: number; // ms
  isPlaying: boolean;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number; // 0-1
  maxLife: number;
  size: number;
  hasGravity: boolean;
}

const GRAVITY = -9.81;
const MAX_PARTICLES_PER_FIREWORK = 200;
const TRAIL_SEGMENTS = 40;

// Compute the rise height in Three.js units from caliber
const getRiseHeight = (product: FireworkProduct): number => {
  const caliber = parseInt(product.caliber) || 30;
  // Rough: height proportional to caliber, capped
  return Math.min(caliber / 10, 20);
};

// Get rise duration as fraction of total duration (first 25-35%)
const getRiseFraction = (product: FireworkProduct): number => {
  const effectType = product.effectType.toLowerCase();
  if (effectType.includes('fountain') || effectType.includes('gerb')) return 0.05;
  if (effectType.includes('wheel')) return 0.02;
  if (effectType.includes('waterfall')) return 0.05;
  return 0.3; // shells, batteries, etc.
};

// Check if effect type produces particles on burst
const hasParticles = (product: FireworkProduct): boolean => {
  const effectType = product.effectType.toLowerCase();
  if (effectType.includes('fountain') || effectType.includes('gerb')) return true;
  if (effectType.includes('wheel')) return true;
  return true; // most fireworks have particle bursts
};

// Check if it's a ground-level effect (no rise)
const isGroundEffect = (product: FireworkProduct): boolean => {
  const effectType = product.effectType.toLowerCase();
  return (
    effectType.includes('fountain') ||
    effectType.includes('gerb') ||
    effectType.includes('wheel') ||
    effectType.includes('waterfall')
  );
};

// Get spread angle in radians
const getSpreadAngle = (product: FireworkProduct): number => {
  const effectType = product.effectType.toLowerCase();
  if (effectType.includes('fountain') || effectType.includes('gerb')) return Math.PI / 6;
  if (effectType.includes('roman candle')) return Math.PI / 12;
  if (effectType.includes('mine')) return Math.PI / 3;
  return Math.PI; // full sphere for shells
};

/**
 * A single firework effect rendered inside the R3F canvas.
 */
const FireworkEffect: React.FC<{
  object: EditorObject3D;
  product: FireworkProduct;
  launchTime: number;
  currentTime: number;
  isPlaying: boolean;
}> = ({ object, product, launchTime, currentTime, isPlaying }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  const totalDuration = (parseFloat(product.duration) || 3) * 1000; // ms
  const elapsed = currentTime - launchTime;
  const progress = Math.max(0, Math.min(1, elapsed / totalDuration));

  const riseHeight = getRiseHeight(product);
  const riseFraction = getRiseFraction(product);
  const ground = isGroundEffect(product);
  const spread = getSpreadAngle(product);
  const colors = product.colors.length > 0 ? product.colors : ['#FF4400'];

  // Position in Three.js coords (editor y → -z, editor z → y)
  const basePos = useMemo(() => new THREE.Vector3(
    object.properties.x / 100,
    object.properties.z / 100,
    -object.properties.y / 100,
  ), [object.properties.x, object.properties.y, object.properties.z]);

  // Generate burst particles once
  const particles = useMemo(() => {
    const count = ground ? MAX_PARTICLES_PER_FIREWORK / 2 : MAX_PARTICLES_PER_FIREWORK;
    const positions = new Float32Array(count * 3);
    const particleColors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    const lifetimes: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;

      // Random velocity in spread cone
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * spread;
      const speed = 2 + Math.random() * 4;

      if (ground) {
        // Fountain: upward cone
        velocities.push(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed * 0.5,
          Math.cos(phi) * speed,
          Math.sin(phi) * Math.sin(theta) * speed * 0.5,
        ));
      } else {
        // Shell: outward sphere
        velocities.push(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed,
        ));
      }

      lifetimes.push(0.3 + Math.random() * 0.7);
      sizes.push(0.02 + Math.random() * 0.06);

      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    return { positions, colors: particleColors, velocities, lifetimes, sizes, count };
  }, [colors, ground, spread]);

  // Trail geometry (red dashed line showing the rise path)
  const trailGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      points.push(new THREE.Vector3(0, (i / TRAIL_SEGMENTS) * riseHeight, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [riseHeight]);

  // Update particles each frame
  useFrame((_, delta) => {
    if (!particlesRef.current || elapsed < 0 || progress > 1) return;
    if (!isPlaying && elapsed <= 0) return;

    const geo = particlesRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;

    const burstStart = ground ? 0 : riseFraction;
    const burstProgress = ground
      ? progress
      : Math.max(0, (progress - riseFraction) / (1 - riseFraction));

    if (burstProgress <= 0) {
      // Before burst: hide all particles
      for (let i = 0; i < particles.count; i++) {
        posAttr.setXYZ(i, 0, -1000, 0);
      }
      posAttr.needsUpdate = true;
      return;
    }

    const burstCenter = ground
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(0, riseHeight, 0);

    for (let i = 0; i < particles.count; i++) {
      const life = burstProgress / particles.lifetimes[i];
      if (life > 1) {
        // Dead particle — fade out
        posAttr.setXYZ(i, 0, -1000, 0);
        continue;
      }

      const t = burstProgress * 2; // time factor
      const vel = particles.velocities[i];
      const gravity = ground ? GRAVITY * 0.3 : GRAVITY * 0.5;

      const px = burstCenter.x + vel.x * t;
      const py = burstCenter.y + vel.y * t + 0.5 * gravity * t * t;
      const pz = burstCenter.z + vel.z * t;

      posAttr.setXYZ(i, px, Math.max(0, py), pz);

      // Fade color towards darker
      const fade = 1 - life * 0.8;
      colAttr.setXYZ(
        i,
        particles.colors[i * 3] * fade,
        particles.colors[i * 3 + 1] * fade,
        particles.colors[i * 3 + 2] * fade,
      );
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  // Don't render if not in time range
  if (elapsed < 0 || progress > 1.2) return null;

  const riseProgress = ground ? 0 : Math.min(1, progress / riseFraction);
  const trailOpacity = progress < riseFraction ? 1 : Math.max(0, 1 - (progress - riseFraction) * 4);

  // Shots: for batteries, repeat bursts
  const shotCount = parseInt(product.shots) || 1;
  const firingPattern = product.firingPattern?.toLowerCase() || 'straight';

  return (
    <group ref={groupRef} position={basePos}>
      {/* Red dashed trail — always visible during rise */}
      {!ground && riseProgress > 0 && trailOpacity > 0 && (
        <line ref={trailRef as any}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                (() => {
                  const pts = [];
                  const segs = Math.floor(riseProgress * TRAIL_SEGMENTS);
                  for (let i = 0; i <= segs; i++) {
                    pts.push(0, (i / TRAIL_SEGMENTS) * riseHeight, 0);
                  }
                  return new Float32Array(pts);
                })(),
                3,
              ]}
            />
          </bufferGeometry>
          <lineDashedMaterial
            color="#FF0000"
            dashSize={0.15}
            gapSize={0.1}
            opacity={trailOpacity}
            transparent
            linewidth={2}
          />
        </line>
      )}

      {/* Rising head glow */}
      {!ground && riseProgress > 0 && riseProgress < 1 && (
        <mesh position={[0, riseProgress * riseHeight, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#FF4400" />
        </mesh>
      )}

      {/* Fountain continuous spray (ground effects) */}
      {ground && progress > 0 && (
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particles.positions, 3]}
              count={particles.count}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[particles.colors, 3]}
              count={particles.count}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.08}
            vertexColors
            transparent
            opacity={Math.max(0, 1 - (progress - 0.7) * 3)}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* Aerial burst particles */}
      {!ground && progress > riseFraction && (
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particles.positions, 3]}
              count={particles.count}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[particles.colors, 3]}
              count={particles.count}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.1}
            vertexColors
            transparent
            opacity={Math.max(0, 1 - (progress - 0.5) * 2)}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* Burst flash */}
      {!ground && progress > riseFraction && progress < riseFraction + 0.1 && (
        <pointLight
          position={[0, riseHeight, 0]}
          color={colors[0]}
          intensity={10 * (1 - (progress - riseFraction) / 0.1)}
          distance={riseHeight * 2}
          decay={2}
        />
      )}
    </group>
  );
};

/**
 * Container component that manages all firework simulations.
 */
export const FireworkSimulation: React.FC<FireworkSimulationProps> = ({
  objects,
  currentTime,
  isPlaying,
}) => {
  // Get all firework objects with their launch times
  const activeFireworks = useMemo(() => {
    return objects
      .filter(obj => obj.type === 'firework' && obj.fireworkProduct && obj.keyframes.length > 0)
      .map(obj => ({
        object: obj,
        product: obj.fireworkProduct!,
        launchTime: obj.keyframes[0].time,
      }))
      .filter(fw => {
        const duration = (parseFloat(fw.product.duration) || 3) * 1000;
        // Show if within the active window (with a small buffer)
        return currentTime >= fw.launchTime - 100 && currentTime <= fw.launchTime + duration * 1.3;
      });
  }, [objects, currentTime]);

  return (
    <>
      {activeFireworks.map(fw => (
        <FireworkEffect
          key={fw.object.id}
          object={fw.object}
          product={fw.product}
          launchTime={fw.launchTime}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />
      ))}
    </>
  );
};
