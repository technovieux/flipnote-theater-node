export type ShapeType = 'rectangle' | 'circle' | 'triangle';
export type Shape3DType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus';

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

export interface Keyframe {
  time: number; // in milliseconds
  properties: ObjectProperties;
}

export interface Keyframe3D {
  time: number;
  properties: Object3DProperties;
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
  selectedObjectId: string | null;
  scenes: Scene[];
  audioTrack: AudioTrack | null;
  backgroundImage: string | null; // URL or data URI
  currentTime: number;
  isPlaying: boolean;
  duration: number; // max 2 hours = 7200000ms
  showProperties: boolean;
  animatedMode: boolean;
  theme: ThemeMode;
  mode3D: boolean;
}
