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

/**
 * Drone assignment: at time T, drone D must be at anchor A of shape S.
 * Multiple assignments per drone build its trajectory ordered by time.
 */
export interface DroneAssignment {
  id: string;
  droneId: string;
  shapeId: string;
  anchorId: string;
  /** Time in milliseconds. Usually mirrors the shape's `shapeTime` but can be overridden. */
  time: number;
}