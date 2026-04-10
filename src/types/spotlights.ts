export type SpotlightCategory = 'entry-level' | 'professional';

export type SpotlightSortBy = 'name' | 'manufacturer' | 'power';

export interface SpotlightProduct {
  name: string;
  reference: string;
  manufacturer: string;
  beamAngle: string; // degrees as string
  beamType: string; // "Narrow", "Medium", "Wide", etc.
  power: string; // Watts as string
  colors: string[]; // hex color codes
  intensity: string; // percentage 0-100 as string
  focusDistance: string; // meters as string
  category: string; // UI label
}

export interface SpotlightObject {
  id: string;
  name: string;
  product: SpotlightProduct;
  productCategory: SpotlightCategory;
  address: string; // e.g., "DMX:123" or "192.168.1.100"
  enabled: boolean;
  properties: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    color: string;
  };
  animationState?: {
    currentIntensity: number; // 0-100
    currentColor: string;
    isAnimating: boolean;
  };
}

export interface SpotlightKeyframe {
  time: number; // ms in timeline
  spotlightId: string;
  intensity: number; // 0-100
  color: string; // hex
  focusX?: number; // optional: focus point X
  focusY?: number; // optional: focus point Y
}
