import React, { useMemo } from 'react';
import { EditorObject3D, Keyframe3D } from '@/types/editor';

interface SpotlightSimulationProps {
  objects: EditorObject3D[];
  currentTime: number;
  isPlaying: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

interface SpotlightState {
  objectId: string;
  intensity: number; // 0-100
  color: string;
  x: number;
  y: number;
}

// Helper to interpolate keyframe values
const interpolateValue = (
  keyframes: Keyframe3D[],
  currentTime: number,
  getValueFn: (kf: Keyframe3D) => number
): number => {
  if (keyframes.length === 0) return 0;
  
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  
  // Find surrounding keyframes
  let before = sorted[0];
  let after = sorted[keyframes.length - 1];
  
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].time <= currentTime) {
      before = sorted[i];
    }
    if (sorted[i].time >= currentTime && after === undefined) {
      after = sorted[i];
      break;
    }
  }
  
  // If no interpolation needed
  if (before.time === after.time || currentTime <= before.time) {
    return getValueFn(before);
  }
  
  if (currentTime >= after.time) {
    return getValueFn(after);
  }
  
  // Linear interpolation
  const progress = (currentTime - before.time) / (after.time - before.time);
  const beforeVal = getValueFn(before);
  const afterVal = getValueFn(after);
  
  return beforeVal + (afterVal - beforeVal) * progress;
};

// Helper to interpolate color
const interpolateColor = (
  keyframes: Keyframe3D[],
  currentTime: number
): string => {
  if (keyframes.length === 0) return '#FFFFFF';
  
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  
  let before = sorted[0];
  let after = sorted[keyframes.length - 1];
  
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].time <= currentTime) {
      before = sorted[i];
    }
    if (sorted[i].time >= currentTime && after === undefined) {
      after = sorted[i];
      break;
    }
  }
  
  if (before.time === after.time || currentTime <= before.time) {
    return before.properties.color;
  }
  
  if (currentTime >= after.time) {
    return after.properties.color;
  }
  
  // For color, we'll just use the "before" color with opacity transition
  return before.properties.color;
};

export const SpotlightSimulation: React.FC<SpotlightSimulationProps> = ({
  objects,
  currentTime,
  isPlaying,
  canvasWidth,
  canvasHeight,
}) => {
  // Filter spotlight objects and calculate their current state
  const spotlights = useMemo(() => {
    return objects
      .filter(obj => obj.type === 'spotlight' && obj.spotlightProduct)
      .map(obj => {
        // Get intensity keyframes (extract from regular keyframes if they exist)
        const allKeyframes = obj.keyframes || [];
        
        // Simulate intensity animation using opacity keyframes
        const currentIntensity = allKeyframes.length > 0
          ? interpolateValue(allKeyframes, currentTime, (kf) => kf.properties.opacity)
          : parseInt(obj.spotlightProduct?.intensity || '100');
        
        const currentColor = allKeyframes.length > 0
          ? interpolateColor(allKeyframes, currentTime)
          : (obj.spotlightProduct?.colors[0] || '#FFFFFF');
        
        return {
          objectId: obj.id,
          intensity: Math.max(0, Math.min(100, currentIntensity)),
          color: currentColor,
          x: obj.properties.x,
          y: obj.properties.y,
          width: obj.properties.width,
          height: obj.properties.height,
          product: obj.spotlightProduct!,
          address: obj.spotlightAddress,
        };
      });
  }, [objects, currentTime]);

  return (
    <g id="spotlight-simulation">
      {spotlights.map((spot) => {
        const intensity = spot.intensity / 100;
        const glowRadius = (spot.product.beamAngle / 60) * Math.max(spot.width, spot.height) * 2;
        const centerX = spot.x;
        const centerY = spot.y;

        return (
          <g key={spot.objectId} id={`spotlight-${spot.objectId}`}>
            {/* Glow/Beam effect */}
            <ellipse
              cx={centerX}
              cy={centerY}
              rx={glowRadius * intensity}
              ry={glowRadius * intensity * 0.7}
              fill={spot.color}
              opacity={0.15 * intensity}
              filter="url(#soft-glow)"
            />

            {/* Spotlight body */}
            <rect
              x={centerX - spot.width / 2}
              y={centerY - spot.height / 2}
              width={spot.width}
              height={spot.height}
              fill={spot.color}
              opacity={0.7 + intensity * 0.3}
              rx="4"
              stroke={spot.color}
              strokeWidth="2"
            />

            {/* Intensity indicator (inner glow) */}
            {intensity > 0 && (
              <circle
                cx={centerX}
                cy={centerY}
                r={Math.max(spot.width, spot.height) / 3}
                fill="white"
                opacity={intensity * 0.4}
              />
            )}

            {/* Label */}
            <text
              x={centerX}
              y={centerY + spot.height / 2 + 20}
              textAnchor="middle"
              fontSize="12"
              fill="currentColor"
              opacity="0.7"
              pointerEvents="none"
            >
              {spot.address} {Math.round(spot.intensity)}%
            </text>
          </g>
        );
      })}
    </g>
  );
};
