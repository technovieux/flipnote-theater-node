export type FireworkCategory = 'consumer' | 'professional' | 'european';

export type FireworkType = 
  | 'shell' | 'battery' | 'roman_candle' | 'fountain' 
  | 'mine' | 'cake' | 'rocket' | 'sparkler' | 'firecracker'
  | 'crossette' | 'comet' | 'waterfall' | 'wheel';

export type FireworkSortBy = 'name' | 'manufacturer' | 'type';

export interface FireworkEffect {
  name: string;
  hasParticles: boolean;
  colors: string[];
  duration: number; // ms
  height: number; // meters
  spread: number; // degrees
}

export interface FireworkProduct {
  id: string;
  name: string;
  manufacturer: string;
  type: FireworkType;
  caliber: number; // mm
  effects: FireworkEffect[];
  totalDuration: number; // ms
  maxHeight: number; // meters
  shotCount: number;
  weight: number; // grams
  safetyDistance: number; // meters
  description?: string;
}

export interface FireworkObject3D {
  id: string;
  name: string;
  product: FireworkProduct;
  category: FireworkCategory;
  properties: {
    x: number;
    y: number;
    z: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
  };
  launchTime: number | null; // ms in timeline, null = not scheduled
}
