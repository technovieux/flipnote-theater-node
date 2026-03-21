export type FireworkCategory = 'consumer' | 'professional' | 'european';

export type FireworkSortBy = 'name' | 'manufacturer' | 'type';

export interface FireworkProduct {
  name: string;
  reference: string;
  manufacturer: string;
  effectType: string;
  duration: string; // seconds as string
  shots: string; // number as string or "N/A"
  caliber: string; // mm as string
  firingPattern: string;
  category: string; // product category label
  colors: string[];
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
