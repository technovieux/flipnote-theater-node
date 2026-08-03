import { EditorState, EditorObject, EditorObject3D, SpotlightEditorObject, Scene, AudioTrack, OBJGeometry, ProjectConfig } from '@/types/editor';
import { DroneAssignment } from '@/types/drone';

// Embedded OBJ model for portable project files
export interface EmbeddedOBJModel {
  id: string;
  name: string;
  fileName: string;
  geometry: OBJGeometry;
}

export interface FlptProject {
  version: string;
  objects: EditorObject[];
  objects3D?: EditorObject3D[];
  spotlights?: SpotlightEditorObject[];
  scenes: Scene[];
  backgroundImage: string | null;
  audioTrack?: {
    name: string;
    waveform: number[];
    duration: number;
    data: string;
  } | null;
  audioTracks?: {
    name: string;
    waveform: number[];
    duration: number;
    data: string;
  }[];
  videoTracks?: {
    id?: string;
    name: string;
    duration: number;
    data: string;
    mimeType?: string;
  }[];
  duration: number;
  mode3D?: boolean;
  modeFireworks?: boolean;
  modeSpotlight?: boolean;
  modeCombined?: boolean;
  modeDrone?: boolean;
  projectConfig?: ProjectConfig;
  droneAssignments?: DroneAssignment[];
  embeddedOBJModels?: EmbeddedOBJModel[];
}

let currentFileHandle: FileSystemFileHandle | null = null;

export const hasFileSystemAccess = (): boolean => {
  return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
};

export const serializeProject = async (state: EditorState): Promise<FlptProject> => {
  const audioTracksData: FlptProject['audioTracks'] = [];
  
  for (const track of state.audioTracks) {
    if (track.file) {
      const arrayBuffer = await track.file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      audioTracksData.push({
        name: track.name,
        waveform: track.waveform,
        duration: track.duration,
        data: base64,
      });
    }
  }

  const videoTracksData: FlptProject['videoTracks'] = [];
  for (const track of state.videoTracks) {
    if (track.file) {
      const arrayBuffer = await track.file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      // Chunked to avoid stack overflow on large videos
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
      }
      videoTracksData.push({
        id: track.id,
        name: track.name,
        duration: track.duration,
        data: btoa(binary),
        mimeType: track.file.type || 'video/mp4',
      });
    }
  }

  // Extract unique OBJ geometries from 3D objects
  const embeddedOBJModels: EmbeddedOBJModel[] = [];
  const seenIds = new Set<string>();
  
  for (const obj of state.objects3D) {
    if (obj.type === 'obj' && obj.objGeometry) {
      // Use a hash of the geometry as ID to avoid duplicates
      const geometryKey = `${obj.name}_${obj.objGeometry.positions.length}`;
      if (!seenIds.has(geometryKey)) {
        seenIds.add(geometryKey);
        embeddedOBJModels.push({
          id: obj.id,
          name: obj.name,
          fileName: `${obj.name}.obj`,
          geometry: obj.objGeometry,
        });
      }
    }
  }

  return {
    version: '1.4',
    objects: state.objects,
    objects3D: state.objects3D,
    spotlights: state.spotlights.length > 0 ? state.spotlights : undefined,
    scenes: state.scenes,
    backgroundImage: state.backgroundImage,
    audioTracks: audioTracksData && audioTracksData.length > 0 ? audioTracksData : undefined,
    videoTracks: videoTracksData.length > 0 ? videoTracksData : undefined,
    duration: state.duration,
    mode3D: state.mode3D,
    modeFireworks: state.modeFireworks,
    modeSpotlight: state.modeSpotlight || undefined,
    modeCombined: state.modeCombined || undefined,
    modeDrone: state.modeDrone || undefined,
    projectConfig: state.projectConfig,
    droneAssignments: state.droneAssignments.length > 0 ? state.droneAssignments : undefined,
    embeddedOBJModels: embeddedOBJModels.length > 0 ? embeddedOBJModels : undefined,
  };
};

export const saveProjectAs = async (state: EditorState): Promise<boolean> => {
  if (!hasFileSystemAccess()) {
    // Fallback for browsers without File System Access API
    const project = await serializeProject(state);
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projet.flpt';
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'projet.flpt',
      types: [
        {
          description: 'Fichier Projet Animation',
          accept: { 'application/flpt': ['.flpt'] },
        },
      ],
    });

    currentFileHandle = handle;
    return await saveToHandle(state, handle);
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return false; // User cancelled
    }
    throw error;
  }
};

export const saveProject = async (state: EditorState): Promise<boolean> => {
  if (!currentFileHandle) {
    return saveProjectAs(state);
  }

  return await saveToHandle(state, currentFileHandle);
};

const saveToHandle = async (state: EditorState, handle: FileSystemFileHandle): Promise<boolean> => {
  try {
    const project = await serializeProject(state);
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(project, null, 2));
    await writable.close();
    return true;
  } catch (error) {
    console.error('Error saving project:', error);
    return false;
  }
};

export const openProject = async (): Promise<FlptProject | null> => {
  if (!hasFileSystemAccess()) {
    // Fallback using input element
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.flpt';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        try {
          const text = await file.text();
          const project = JSON.parse(text) as FlptProject;
          resolve(project);
        } catch (error) {
          console.error('Error reading project:', error);
          resolve(null);
        }
      };
      input.click();
    });
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Fichier Projet Animation',
          accept: { 'application/flpt': ['.flpt'] },
        },
      ],
    });

    currentFileHandle = handle;
    const file = await handle.getFile();
    const text = await file.text();
    return JSON.parse(text) as FlptProject;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null; // User cancelled
    }
    throw error;
  }
};

export const hasCurrentFile = (): boolean => {
  return currentFileHandle !== null;
};

export const clearCurrentFile = (): void => {
  currentFileHandle = null;
};

// Convert base64 media back to File
export const base64ToFile = (base64: string, filename: string, mimeType = 'audio/mpeg'): File => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
};
