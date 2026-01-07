export type ShapeType = 'rectangle' | 'circle' | 'triangle';

export interface ObjectProperties {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  color: string;
}

export interface Keyframe {
  time: number; // in milliseconds
  properties: ObjectProperties;
}

export interface EditorObject {
  id: string;
  name: string;
  type: ShapeType;
  properties: ObjectProperties;
  keyframes: Keyframe[];
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
}
