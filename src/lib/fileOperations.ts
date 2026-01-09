import { EditorState, EditorObject, Scene, AudioTrack } from '@/types/editor';

export interface FlptProject {
  version: string;
  objects: EditorObject[];
  scenes: Scene[];
  backgroundImage: string | null;
  audioTrack: {
    name: string;
    waveform: number[];
    duration: number;
    data: string; // base64 encoded audio
  } | null;
  duration: number;
}

let currentFileHandle: FileSystemFileHandle | null = null;

export const hasFileSystemAccess = (): boolean => {
  return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
};

export const serializeProject = async (state: EditorState): Promise<FlptProject> => {
  let audioData: FlptProject['audioTrack'] = null;
  
  if (state.audioTrack?.file) {
    const arrayBuffer = await state.audioTrack.file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    audioData = {
      name: state.audioTrack.name,
      waveform: state.audioTrack.waveform,
      duration: state.audioTrack.duration,
      data: base64,
    };
  }

  return {
    version: '1.0',
    objects: state.objects,
    scenes: state.scenes,
    backgroundImage: state.backgroundImage,
    audioTrack: audioData,
    duration: state.duration,
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

// Convert base64 audio back to File
export const base64ToFile = (base64: string, filename: string): File => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], filename, { type: 'audio/mpeg' });
};
