import React from 'react';
import type { Spotlight2DShape } from '@/types/editor';

export interface SpotlightChannelMix {
  /** 0..1 red channel level (dimmer already applied). */
  r: number;
  /** 0..1 green channel level. */
  g: number;
  /** 0..1 blue channel level. */
  b: number;
  /** 0..1 dedicated white channel level. */
  w: number;
}

interface Props {
  shape: Spotlight2DShape;
  color: string; // current output color (hex)
  intensity?: number; // 0..1 brightness multiplier
  width: number;
  height: number;
  /** Per-channel levels (0..1, dimmer applied). Used to light individual LEDs on par_led / led_bar. */
  channels?: SpotlightChannelMix;
}

// Adjust a hex color by a brightness factor (0..1).
const scaleColor = (hex: string, factor: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = Math.round(((int >> 16) & 0xff) * factor);
  const g = Math.round(((int >> 8) & 0xff) * factor);
  const b = Math.round((int & 0xff) * factor);
  return `rgb(${r}, ${g}, ${b})`;
};

// Draws a decorative 2D representation of a spotlight. Non-interactive.
export const Spotlight2DShapeView: React.FC<Props> = ({ shape, color, intensity = 1, width, height, channels }) => {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const mix: SpotlightChannelMix = channels ?? { r: clampedIntensity, g: clampedIntensity, b: clampedIntensity, w: clampedIntensity };
  // Level per palette entry: R, G, B, W (index-aligned with `palette` arrays below).
  const levels = [
    Math.max(0, Math.min(1, mix.r)),
    Math.max(0, Math.min(1, mix.g)),
    Math.max(0, Math.min(1, mix.b)),
    Math.max(0, Math.min(1, mix.w)),
  ];

  if (shape === 'circle') {
    return (
      <div
        className="w-full h-full rounded-full border border-black/40"
        style={{
          background: `radial-gradient(circle, ${scaleColor(color, clampedIntensity)} 40%, rgba(0,0,0,0.85) 100%)`,
          boxShadow: `0 0 ${8 + 16 * clampedIntensity}px ${scaleColor(color, clampedIntensity * 0.8)}`,
        }}
      />
    );
  }

  if (shape === 'led_bar') {
    // A row of LEDs alternating R/G/B/W, brightness modulated by intensity + current color mix.
    const count = Math.max(6, Math.min(24, Math.floor(width / 12)));
    const palette = ['#ff2020', '#20ff20', '#2050ff', '#ffffff'];
    return (
      <div className="w-full h-full rounded-sm bg-black/85 border border-black/60 flex items-center justify-around px-1">
        {Array.from({ length: count }).map((_, i) => {
          const idx = i % palette.length;
          const led = palette[idx];
          const level = levels[idx];
          const lit = scaleColor(led, level);
          return (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: Math.min(height * 0.5, 10),
                height: Math.min(height * 0.5, 10),
                background: lit,
                boxShadow: `0 0 ${4 + 8 * level}px ${lit}`,
              }}
            />
          );
        })}
      </div>
    );
  }

  if (shape === 'par_led') {
    // PAR body with a ring + inner hex of LED lenses (R/G/B/W). Matches the reference LED PAR image.
    const outer = 12; // outer ring LEDs
    const inner = 6;  // inner ring LEDs
    const cx = width / 2;
    const cy = height / 2;
    const rOuter = Math.min(width, height) * 0.4;
    const rInner = Math.min(width, height) * 0.2;
    const palette = ['#ff2020', '#20ff20', '#2050ff', '#ffffff'];
    const ledSize = Math.min(width, height) * 0.11;

    const renderRing = (count: number, radius: number, offset = 0) =>
      Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + offset;
        const x = cx + Math.cos(angle) * radius - ledSize / 2;
        const y = cy + Math.sin(angle) * radius - ledSize / 2;
        const idx = i % palette.length;
        const led = palette[idx];
        const level = levels[idx];
        const lit = scaleColor(led, level);
        return (
          <div
            key={`${count}-${i}`}
            className="absolute rounded-full"
            style={{
              left: x,
              top: y,
              width: ledSize,
              height: ledSize,
              background: lit,
              boxShadow: `0 0 ${3 + 8 * level}px ${lit}`,
            }}
          />
        );
      });

    return (
      <div
        className="w-full h-full rounded-full relative border border-black/60"
        style={{ background: 'radial-gradient(circle, #1a1a1a 60%, #050505 100%)' }}
      >
        {renderRing(outer, rOuter)}
        {renderRing(inner, rInner, Math.PI / inner)}
        {/* Center LED reflecting the mixed color */}
        <div
          className="absolute rounded-full"
          style={{
            left: cx - ledSize / 2,
            top: cy - ledSize / 2,
            width: ledSize,
            height: ledSize,
            background: scaleColor(color, clampedIntensity),
            boxShadow: `0 0 ${4 + 10 * clampedIntensity}px ${scaleColor(color, clampedIntensity)}`,
          }}
        />
      </div>
    );
  }

  // Default 'square'
  return (
    <div
      className="w-full h-full rounded-sm border border-black/40"
      style={{
        background: scaleColor(color, clampedIntensity),
        boxShadow: `0 0 ${4 + 10 * clampedIntensity}px ${scaleColor(color, clampedIntensity * 0.8)}`,
      }}
    />
  );
};