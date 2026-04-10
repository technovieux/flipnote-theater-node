import { FireworkProduct, FireworkCategory } from './fireworks';
import { SpotlightProduct, SpotlightCategory } from './spotlights';

export type ShapeType = 'rectangle' | 'circle' | 'triangle';
export type Shape3DType = 
  | 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus'
  // Geometric
  | 'pyramid' | 'octahedron' | 'dodecahedron' | 'icosahedron' | 'tetrahedron'
  | 'torusknot' | 'capsule' | 'ring' | 'tube'
  // Architectural
  | 'arch' | 'stairs' | 'roof' | 'window' | 'door'
  // Symbols
  | 'star' | 'heart' | 'arrow' | 'gear' | 'plus' | 'cross' | 'speechbubble'
  // Everyday
  | 'table' | 'chair' | 'car' | 'tree' | 'house' | 'lamp' | 'bottle' | 'cup'
  // Custom and imported
  | 'custom' | 'obj'
  // Fireworks
  | 'firework'
  // Spotlights
  | 'spotlight';

export type EditorMode = '2d' | '3d' | 'fireworks' | 'spotlights';

export interface CustomGeometry {
  points: { x: number; y: number }[];
  depth: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
}

// Serialized OBJ geometry for storage
export interface OBJGeometry {
  positions: number[];
  normals: number[];
  indices?: number[];
}

export interface ObjectProperties {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  color: string;
}

export interface Object3DProperties {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  opacity: number;
  color: string;
}

export interface CameraPosition {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

export interface Keyframe {
  time: number; // in milliseconds
  properties: ObjectProperties;
}

export interface Keyframe3D {
  time: number;
  properties: Object3DProperties;
  camera?: CameraPosition;
  // Spotlight-specific properties
  spotlightAddress?: string;
  dmxValues?: number[];
}

export interface EditorObject {
  id: string;
  name: string;
  type: ShapeType;
  properties: ObjectProperties;
  keyframes: Keyframe[];
}

export interface EditorObject3D {
  id: string;
  name: string;
  type: Shape3DType;
  properties: Object3DProperties;
  keyframes: Keyframe3D[];
  customGeometry?: CustomGeometry;
  objGeometry?: OBJGeometry;
  fireworkProduct?: FireworkProduct;
  fireworkCategory?: FireworkCategory;
  spotlightProduct?: SpotlightProduct;
  spotlightCategory?: SpotlightCategory;
  spotlightAddress?: string; // e.g., "DMX:123" or "192.168.1.100"
  dmxValues?: number[]; // Array of DMX channel values (0-255)
}

export interface Scene {
  id: string;
  name: string;
  time: number;
  number: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  file: File | null;
  waveform: number[];
  duration: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface EditorState {
  objects: EditorObject[];
  objects3D: EditorObject3D[];
  selectedObjectIds: string[];
  scenes: Scene[];
  audioTracks: AudioTrack[];
  backgroundImage: string | null; // URL or data URI
  currentTime: number;
  isPlaying: boolean;
  duration: number; // max 2 hours = 7200000ms
  showProperties: boolean;
  animatedMode: boolean;
  theme: ThemeMode;
  mode3D: boolean;
  modeFireworks: boolean;
  modeSpotlights: boolean;
  hasUnsavedChanges: boolean;
}
