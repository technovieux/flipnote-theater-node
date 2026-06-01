export interface DroneProduct {
  id: string;
  name: string;
  manufacturer: string;
  weight: number; // grams
  diameter: number; // mm
  ledColor: 'RGB' | 'RGBW' | 'RGBAW' | 'Mono';
  maxSpeed: number; // m/s
  flightTime: number; // minutes
  battery: string;
  description: string;
}

export type AnchorSource = 'vertex' | 'edge' | 'face';

export interface Anchor {
  id: string;
  /** Position in the object's local geometry space (before world transform). */
  position: { x: number; y: number; z: number };
  source: AnchorSource;
  /** Index of the originating vertex / edge / face in the geometry. */
  sourceIndex: number;
  /** When source is 'edge' or 'face', this anchor belongs to a division group. */
  groupId?: string;
}