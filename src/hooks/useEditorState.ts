import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  EditorState, 
  EditorObject, 
  EditorObject3D,
  ObjectProperties, 
  Object3DProperties,
  Keyframe, 
  Keyframe3D,
  CameraPosition,
  Scene, 
  ShapeType, 
  Shape3DType,
  ThemeMode, 
  AudioTrack,
  CustomGeometry,
  OBJGeometry,
} from '@/types/editor';
import { FireworkProduct, FireworkCategory } from '@/types/fireworks';
import { FlptProject, base64ToFile } from '@/lib/fileOperations';
import { interpolateColor } from '@/lib/colorUtils';

// Store current camera position for 3D keyframes
let currentCameraPosition: CameraPosition | null = null;

export const setCameraPosition = (pos: CameraPosition) => {
  currentCameraPosition = pos;
};

export const getCameraPosition = (): CameraPosition | null => {
  return currentCameraPosition;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// Clipboard for copy/paste
let clipboardObject: EditorObject | null = null;
let clipboardObject3D: EditorObject3D | null = null;

// Max history size
const MAX_HISTORY_SIZE = 50;

// Keys to exclude from history comparison (transient state)
const TRANSIENT_KEYS: (keyof EditorState)[] = ['currentTime', 'isPlaying'];

// Deep clone state for history (excluding audio file which can't be cloned)
const cloneStateForHistory = (state: EditorState): EditorState => {
  return {
    ...state,
    objects: JSON.parse(JSON.stringify(state.objects)),
    objects3D: JSON.parse(JSON.stringify(state.objects3D)),
    scenes: JSON.parse(JSON.stringify(state.scenes)),
    audioTrack: state.audioTrack ? { ...state.audioTrack } : null,
  };
};

const defaultProperties: ObjectProperties = {
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 100,
  color: '#00d4ff',
};

const default3DProperties: Object3DProperties = {
  x: 0,
  y: 0,
  z: 0,
  width: 100,
  height: 100,
  depth: 100,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  opacity: 100,
  color: '#00d4ff',
};

const initialState: EditorState = {
  objects: [],
  objects3D: [],
  selectedObjectIds: [],
  scenes: [],
  audioTrack: null,
  backgroundImage: null,
  currentTime: 0,
  isPlaying: false,
  duration: 7200000, // 2 hours in ms
  showProperties: true,
  animatedMode: true,
  theme: 'dark',
  mode3D: false,
  modeFireworks: false,
  hasUnsavedChanges: false,
};

export const useEditorState = () => {
  const [state, setState] = useState<EditorState>(initialState);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  // History for undo/redo
  const historyRef = useRef<EditorState[]>([cloneStateForHistory(initialState)]);
  const historyIndexRef = useRef<number>(0);
  const isUndoRedoRef = useRef<boolean>(false);
  
  // Save state to history (called after meaningful changes)
  const saveToHistory = useCallback((newState: EditorState) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    
    // Remove any future states if we're not at the end
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    
    // Add new state
    newHistory.push(cloneStateForHistory(newState));
    
    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    } else {
      historyIndexRef.current++;
    }
    
    historyRef.current = newHistory;
  }, []);
  
  // Undo function
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      isUndoRedoRef.current = true;
      const previousState = historyRef.current[historyIndexRef.current];
      setState(prev => ({
        ...cloneStateForHistory(previousState),
        currentTime: prev.currentTime,
        isPlaying: prev.isPlaying,
        theme: prev.theme,
      }));
    }
  }, []);
  
  // Redo function
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      isUndoRedoRef.current = true;
      const nextState = historyRef.current[historyIndexRef.current];
      setState(prev => ({
        ...cloneStateForHistory(nextState),
        currentTime: prev.currentTime,
        isPlaying: prev.isPlaying,
        theme: prev.theme,
      }));
    }
  }, []);

  // Theme management
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('light', !isDark);
    } else {
      root.classList.toggle('light', state.theme === 'light');
    }
  }, [state.theme]);

  // Animation loop
  useEffect(() => {
    if (state.isPlaying) {
      lastTimeRef.current = performance.now();
      
      const animate = (currentTimestamp: number) => {
        const delta = currentTimestamp - lastTimeRef.current;
        lastTimeRef.current = currentTimestamp;
        
        setState(prev => {
          const newTime = prev.currentTime + delta;
          if (newTime >= prev.duration) {
            return { ...prev, currentTime: prev.duration, isPlaying: false };
          }
          return { ...prev, currentTime: newTime };
        });
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isPlaying]);

  // Save to history when meaningful state changes occur
  const prevStateRef = useRef<string>('');
  useEffect(() => {
    // Skip if this is from undo/redo
    if (isUndoRedoRef.current) return;
    
    // Create a snapshot excluding transient properties
    const snapshot = JSON.stringify({
      objects: state.objects,
      objects3D: state.objects3D,
      scenes: state.scenes,
      backgroundImage: state.backgroundImage,
      selectedObjectIds: state.selectedObjectIds,
    });
    
    // Only save if something meaningful changed
    if (snapshot !== prevStateRef.current && prevStateRef.current !== '') {
      saveToHistory(state);
    }
    prevStateRef.current = snapshot;
  }, [state.objects, state.objects3D, state.scenes, state.backgroundImage, state.selectedObjectIds, saveToHistory, state]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const setShowProperties = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showProperties: show }));
  }, []);

  const setAnimatedMode = useCallback((animated: boolean) => {
    setState(prev => ({ ...prev, animatedMode: animated }));
  }, []);

  const setMode3D = useCallback((mode3D: boolean) => {
    setState(prev => ({ ...prev, mode3D, modeFireworks: false, selectedObjectIds: [] }));
  }, []);

  const setModeFireworks = useCallback((modeFireworks: boolean) => {
    setState(prev => ({ ...prev, modeFireworks, mode3D: modeFireworks, selectedObjectIds: [] }));
  }, []);

  const markAsChanged = useCallback(() => {
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));
  }, []);

  const markAsSaved = useCallback(() => {
    setState(prev => ({ ...prev, hasUnsavedChanges: false }));
  }, []);

  const addObject = useCallback((type: ShapeType) => {
    const colors = ['#00d4ff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newObject: EditorObject = {
      id: generateId(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${state.objects.length + 1}`,
      type,
      properties: { ...defaultProperties, color: randomColor },
      keyframes: [],
    };
    
    setState(prev => ({
      ...prev,
      objects: [newObject, ...prev.objects],
      selectedObjectIds: [newObject.id],
      hasUnsavedChanges: true,
    }));
  }, [state.objects.length]);

  const addObject3D = useCallback((type: Shape3DType) => {
    const colors = ['#00d4ff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const typeNames: Partial<Record<Shape3DType, string>> = {
      cube: 'Cube',
      sphere: 'Sphère',
      cylinder: 'Cylindre',
      cone: 'Cône',
      torus: 'Tore',
      pyramid: 'Pyramide',
      octahedron: 'Octaèdre',
      dodecahedron: 'Dodécaèdre',
      icosahedron: 'Icosaèdre',
      tetrahedron: 'Tétraèdre',
      torusknot: 'Tore noué',
      capsule: 'Capsule',
      ring: 'Anneau',
      tube: 'Tube',
      arch: 'Arche',
      stairs: 'Escalier',
      roof: 'Toit',
      window: 'Fenêtre',
      door: 'Porte',
      star: 'Étoile',
      heart: 'Cœur',
      arrow: 'Flèche',
      gear: 'Engrenage',
      plus: 'Plus',
      cross: 'Croix',
      speechbubble: 'Bulle',
      table: 'Table',
      chair: 'Chaise',
      car: 'Voiture',
      tree: 'Arbre',
      house: 'Maison',
      lamp: 'Lampe',
      bottle: 'Bouteille',
      cup: 'Tasse',
      custom: 'Forme',
    };
    
    const newObject: EditorObject3D = {
      id: generateId(),
      name: `${typeNames[type] || type} ${state.objects3D.length + 1}`,
      type,
      properties: { ...default3DProperties, color: randomColor },
      keyframes: [],
    };
    
    setState(prev => ({
      ...prev,
      objects3D: [newObject, ...prev.objects3D],
      selectedObjectIds: [newObject.id],
      hasUnsavedChanges: true,
    }));
  }, [state.objects3D.length]);

  // Add 3D object with custom geometry
  const addObject3DWithGeometry = useCallback((
    name: string,
    type: Shape3DType,
    customGeometry?: CustomGeometry,
    defaultScale?: { width: number; height: number; depth: number }
  ) => {
    const colors = ['#00d4ff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newObject: EditorObject3D = {
      id: generateId(),
      name: `${name} ${state.objects3D.length + 1}`,
      type,
      properties: {
        ...default3DProperties,
        color: randomColor,
        ...(defaultScale || {}),
      },
      keyframes: [],
      customGeometry,
    };
    
    setState(prev => ({
      ...prev,
      objects3D: [newObject, ...prev.objects3D],
      selectedObjectIds: [newObject.id],
      hasUnsavedChanges: true,
    }));
  }, [state.objects3D.length]);

  // Add 3D object from imported OBJ file
  const addObject3DFromOBJ = useCallback((
    name: string,
    objGeometry: OBJGeometry
  ) => {
    const colors = ['#00d4ff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newObject: EditorObject3D = {
      id: generateId(),
      name: `${name} ${state.objects3D.length + 1}`,
      type: 'obj',
      properties: {
        ...default3DProperties,
        color: randomColor,
      },
      keyframes: [],
      objGeometry,
    };
    
    setState(prev => ({
      ...prev,
      objects3D: [newObject, ...prev.objects3D],
      selectedObjectIds: [newObject.id],
      hasUnsavedChanges: true,
    }));
  }, [state.objects3D.length]);

  // Add firework object
  const addFireworkObject = useCallback((product: FireworkProduct, category: FireworkCategory) => {
    const cal = parseInt(product.caliber) || 20;
    const newObject: EditorObject3D = {
      id: generateId(),
      name: `${product.name}`,
      type: 'firework',
      properties: {
        ...default3DProperties,
        color: product.colors[0] || '#FF4400',
        width: Math.max(20, cal / 2),
        height: Math.max(20, cal / 2),
        depth: Math.max(20, cal / 2),
      },
      keyframes: [],
      fireworkProduct: product,
      fireworkCategory: category,
    };
    
    setState(prev => ({
      ...prev,
      objects3D: [newObject, ...prev.objects3D],
      selectedObjectIds: [newObject.id],
      hasUnsavedChanges: true,
    }));
  }, []);


  const selectObject = useCallback((id: string | null, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => {
    setState(prev => {
      if (id === null) {
        return { ...prev, selectedObjectIds: [] };
      }
      
      const { ctrlKey = false, shiftKey = false } = options || {};
      
      if (ctrlKey) {
        // Toggle selection
        const isSelected = prev.selectedObjectIds.includes(id);
        return {
          ...prev,
          selectedObjectIds: isSelected
            ? prev.selectedObjectIds.filter(sid => sid !== id)
            : [...prev.selectedObjectIds, id],
        };
      }
      
      if (shiftKey && prev.selectedObjectIds.length > 0) {
        // Range selection
        const allObjects = prev.mode3D ? prev.objects3D : prev.objects;
        const lastSelectedId = prev.selectedObjectIds[prev.selectedObjectIds.length - 1];
        const lastIndex = allObjects.findIndex(o => o.id === lastSelectedId);
        const currentIndex = allObjects.findIndex(o => o.id === id);
        
        if (lastIndex >= 0 && currentIndex >= 0) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = allObjects.slice(start, end + 1).map(o => o.id);
          // Merge with existing selection
          const merged = new Set([...prev.selectedObjectIds, ...rangeIds]);
          return { ...prev, selectedObjectIds: Array.from(merged) };
        }
      }
      
      // Simple select (replace)
      return { ...prev, selectedObjectIds: [id] };
    });
  }, []);

  const updateObjectProperties = useCallback((id: string, properties: Partial<ObjectProperties>) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj) return prev;

      // Check if we're at a keyframe's time (within 100ms tolerance)
      const keyframeIndex = obj.keyframes.findIndex(
        kf => Math.abs(kf.time - prev.currentTime) < 100
      );

      return {
        ...prev,
        hasUnsavedChanges: true,
        objects: prev.objects.map(o => {
          if (o.id !== id) return o;

          // Update base properties
          const newProperties = { ...o.properties, ...properties };

          // Also update keyframe if we're at one
          if (keyframeIndex >= 0) {
            const newKeyframes = [...o.keyframes];
            newKeyframes[keyframeIndex] = {
              ...newKeyframes[keyframeIndex],
              properties: { ...newKeyframes[keyframeIndex].properties, ...properties },
            };
            return { ...o, properties: newProperties, keyframes: newKeyframes };
          }

          return { ...o, properties: newProperties };
        }),
      };
    });
  }, []);

  // Batch update: apply property changes to all selected objects
  const updateSelectedObjectsProperties = useCallback((properties: Partial<ObjectProperties>) => {
    setState(prev => {
      return {
        ...prev,
        hasUnsavedChanges: true,
        objects: prev.objects.map(o => {
          if (!prev.selectedObjectIds.includes(o.id)) return o;

          const keyframeIndex = o.keyframes.findIndex(
            kf => Math.abs(kf.time - prev.currentTime) < 100
          );

          const newProperties = { ...o.properties, ...properties };

          if (keyframeIndex >= 0) {
            const newKeyframes = [...o.keyframes];
            newKeyframes[keyframeIndex] = {
              ...newKeyframes[keyframeIndex],
              properties: { ...newKeyframes[keyframeIndex].properties, ...properties },
            };
            return { ...o, properties: newProperties, keyframes: newKeyframes };
          }

          return { ...o, properties: newProperties };
        }),
      };
    });
  }, []);

  const updateObject3DProperties = useCallback((id: string, properties: Partial<Object3DProperties>) => {
    setState(prev => {
      const obj = prev.objects3D.find(o => o.id === id);
      if (!obj) return prev;

      const keyframeIndex = obj.keyframes.findIndex(
        kf => Math.abs(kf.time - prev.currentTime) < 100
      );

      return {
        ...prev,
        hasUnsavedChanges: true,
        objects3D: prev.objects3D.map(o => {
          if (o.id !== id) return o;

          const newProperties = { ...o.properties, ...properties };

          if (keyframeIndex >= 0) {
            const newKeyframes = [...o.keyframes];
            newKeyframes[keyframeIndex] = {
              ...newKeyframes[keyframeIndex],
              properties: { ...newKeyframes[keyframeIndex].properties, ...properties },
            };
            return { ...o, properties: newProperties, keyframes: newKeyframes };
          }

          return { ...o, properties: newProperties };
        }),
      };
    });
  }, []);

  // Batch update for 3D objects
  const updateSelectedObjects3DProperties = useCallback((properties: Partial<Object3DProperties>) => {
    setState(prev => {
      return {
        ...prev,
        hasUnsavedChanges: true,
        objects3D: prev.objects3D.map(o => {
          if (!prev.selectedObjectIds.includes(o.id)) return o;

          const keyframeIndex = o.keyframes.findIndex(
            kf => Math.abs(kf.time - prev.currentTime) < 100
          );

          const newProperties = { ...o.properties, ...properties };

          if (keyframeIndex >= 0) {
            const newKeyframes = [...o.keyframes];
            newKeyframes[keyframeIndex] = {
              ...newKeyframes[keyframeIndex],
              properties: { ...newKeyframes[keyframeIndex].properties, ...properties },
            };
            return { ...o, properties: newProperties, keyframes: newKeyframes };
          }

          return { ...o, properties: newProperties };
        }),
      };
    });
  }, []);

  const renameObject = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: true,
      objects: prev.objects.map(obj =>
        obj.id === id ? { ...obj, name } : obj
      ),
      objects3D: prev.objects3D.map(obj =>
        obj.id === id ? { ...obj, name } : obj
      ),
    }));
  }, []);

  const deleteObject = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: true,
      objects: prev.objects.filter(obj => obj.id !== id),
      objects3D: prev.objects3D.filter(obj => obj.id !== id),
      selectedObjectIds: prev.selectedObjectIds.filter(sid => sid !== id),
    }));
  }, []);

  // Delete all selected objects
  const deleteSelectedObjects = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: true,
      objects: prev.objects.filter(obj => !prev.selectedObjectIds.includes(obj.id)),
      objects3D: prev.objects3D.filter(obj => !prev.selectedObjectIds.includes(obj.id)),
      selectedObjectIds: [],
    }));
  }, []);

  const reorderObjects = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      if (prev.mode3D) {
        const newObjects = [...prev.objects3D];
        const [removed] = newObjects.splice(fromIndex, 1);
        newObjects.splice(toIndex, 0, removed);
        return { ...prev, objects3D: newObjects, hasUnsavedChanges: true };
      } else {
        const newObjects = [...prev.objects];
        const [removed] = newObjects.splice(fromIndex, 1);
        newObjects.splice(toIndex, 0, removed);
        return { ...prev, objects: newObjects, hasUnsavedChanges: true };
      }
    });
  }, []);

  const addKeyframe = useCallback(() => {
    if (state.selectedObjectIds.length === 0) return;
    
    setState(prev => {
      if (prev.mode3D) {
        return {
          ...prev,
          hasUnsavedChanges: true,
          objects3D: prev.objects3D.map(obj => {
            if (!prev.selectedObjectIds.includes(obj.id)) return obj;
            
            // Firework objects can only have 1 keyframe (the launch time)
            if (obj.type === 'firework') {
              const launchKeyframe: Keyframe3D = {
                time: prev.currentTime,
                properties: { ...obj.properties },
                camera: currentCameraPosition || undefined,
              };
              return { ...obj, keyframes: [launchKeyframe] };
            }
            
            const existingIndex = obj.keyframes.findIndex(
              kf => Math.abs(kf.time - prev.currentTime) < 100
            );
            
            const newKeyframe: Keyframe3D = {
              time: prev.currentTime,
              properties: { ...obj.properties },
              camera: currentCameraPosition || undefined,
            };
            
            let newKeyframes = [...obj.keyframes];
            if (existingIndex >= 0) {
              newKeyframes[existingIndex] = newKeyframe;
            } else {
              newKeyframes.push(newKeyframe);
              newKeyframes.sort((a, b) => a.time - b.time);
            }
            
            return { ...obj, keyframes: newKeyframes };
          }),
        };
      } else {
        return {
          ...prev,
          hasUnsavedChanges: true,
          objects: prev.objects.map(obj => {
            if (!prev.selectedObjectIds.includes(obj.id)) return obj;
            
            const existingIndex = obj.keyframes.findIndex(
              kf => Math.abs(kf.time - prev.currentTime) < 100
            );
            
            const newKeyframe: Keyframe = {
              time: prev.currentTime,
              properties: { ...obj.properties },
            };
            
            let newKeyframes = [...obj.keyframes];
            if (existingIndex >= 0) {
              newKeyframes[existingIndex] = newKeyframe;
            } else {
              newKeyframes.push(newKeyframe);
              newKeyframes.sort((a, b) => a.time - b.time);
            }
            
            return { ...obj, keyframes: newKeyframes };
          }),
        };
      }
    });
  }, [state.selectedObjectIds]);

  const addScene = useCallback((name: string) => {
    setState(prev => {
      const newScene: Scene = {
        id: generateId(),
        name,
        time: prev.currentTime,
        number: prev.scenes.length + 1,
      };
      
      const newScenes = [...prev.scenes, newScene].sort((a, b) => a.time - b.time);
      // Renumber scenes after sorting
      newScenes.forEach((s, i) => s.number = i + 1);
      
      return { ...prev, scenes: newScenes, hasUnsavedChanges: true };
    });
  }, []);

  const play = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: Math.max(0, Math.min(time, prev.duration)) }));
  }, []);

  const getInterpolatedProperties = useCallback((object: EditorObject, time: number): ObjectProperties => {
    if (object.keyframes.length === 0) return object.properties;
    
    const sortedKeyframes = [...object.keyframes].sort((a, b) => a.time - b.time);
    
    // Find surrounding keyframes
    let prevKf: Keyframe | null = null;
    let nextKf: Keyframe | null = null;
    
    for (const kf of sortedKeyframes) {
      if (kf.time <= time) {
        prevKf = kf;
      } else if (!nextKf && kf.time > time) {
        nextKf = kf;
        break;
      }
    }
    
    if (!prevKf && !nextKf) return object.properties;
    if (!prevKf) return nextKf!.properties;
    if (!nextKf) return prevKf.properties;
    
    if (!state.animatedMode) {
      return prevKf.properties;
    }
    
    // Interpolate
    const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);
    
    const interpolate = (a: number, b: number) => a + (b - a) * progress;
    
    return {
      x: interpolate(prevKf.properties.x, nextKf.properties.x),
      y: interpolate(prevKf.properties.y, nextKf.properties.y),
      width: interpolate(prevKf.properties.width, nextKf.properties.width),
      height: interpolate(prevKf.properties.height, nextKf.properties.height),
      rotation: interpolate(prevKf.properties.rotation, nextKf.properties.rotation),
      opacity: interpolate(prevKf.properties.opacity, nextKf.properties.opacity),
      color: interpolateColor(prevKf.properties.color, nextKf.properties.color, progress),
    };
  }, [state.animatedMode]);

  const getInterpolatedProperties3D = useCallback((object: EditorObject3D, time: number): Object3DProperties => {
    if (object.keyframes.length === 0) return object.properties;
    
    const sortedKeyframes = [...object.keyframes].sort((a, b) => a.time - b.time);
    
    let prevKf: Keyframe3D | null = null;
    let nextKf: Keyframe3D | null = null;
    
    for (const kf of sortedKeyframes) {
      if (kf.time <= time) {
        prevKf = kf;
      } else if (!nextKf && kf.time > time) {
        nextKf = kf;
        break;
      }
    }
    
    if (!prevKf && !nextKf) return object.properties;
    if (!prevKf) return nextKf!.properties;
    if (!nextKf) return prevKf.properties;
    
    if (!state.animatedMode) {
      return prevKf.properties;
    }
    
    const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);
    const interpolate = (a: number, b: number) => a + (b - a) * progress;
    
    return {
      x: interpolate(prevKf.properties.x, nextKf.properties.x),
      y: interpolate(prevKf.properties.y, nextKf.properties.y),
      z: interpolate(prevKf.properties.z, nextKf.properties.z),
      width: interpolate(prevKf.properties.width, nextKf.properties.width),
      height: interpolate(prevKf.properties.height, nextKf.properties.height),
      depth: interpolate(prevKf.properties.depth, nextKf.properties.depth),
      rotationX: interpolate(prevKf.properties.rotationX, nextKf.properties.rotationX),
      rotationY: interpolate(prevKf.properties.rotationY, nextKf.properties.rotationY),
      rotationZ: interpolate(prevKf.properties.rotationZ, nextKf.properties.rotationZ),
      opacity: interpolate(prevKf.properties.opacity, nextKf.properties.opacity),
      color: interpolateColor(prevKf.properties.color, nextKf.properties.color, progress),
    };
  }, [state.animatedMode]);

  const resetProject = useCallback(() => {
    setState(initialState);
  }, []);

  const loadProject = useCallback((project: FlptProject) => {
    let audioTrack: AudioTrack | null = null;
    
    if (project.audioTrack) {
      const file = base64ToFile(project.audioTrack.data, project.audioTrack.name);
      audioTrack = {
        id: generateId(),
        name: project.audioTrack.name,
        file,
        waveform: project.audioTrack.waveform,
        duration: project.audioTrack.duration,
      };
    }
    
    setState({
      ...initialState,
      objects: project.objects,
      objects3D: project.objects3D || [],
      scenes: project.scenes,
      backgroundImage: project.backgroundImage,
      audioTrack,
      duration: project.duration,
      mode3D: project.mode3D || project.modeFireworks || false,
      modeFireworks: project.modeFireworks || false,
      hasUnsavedChanges: false,
    });
  }, []);

  const setBackgroundImage = useCallback((imageUrl: string | null) => {
    setState(prev => ({ ...prev, backgroundImage: imageUrl, hasUnsavedChanges: true }));
  }, []);

  const setAudioTrack = useCallback((file: File, waveform: number[], duration: number) => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: true,
      audioTrack: {
        id: generateId(),
        name: file.name,
        file,
        waveform,
        duration,
      },
    }));
  }, []);

  const copySelectedObject = useCallback(() => {
    if (state.selectedObjectIds.length === 0) return;
    
    // Copy first selected object (for single copy/paste)
    const firstId = state.selectedObjectIds[0];
    
    if (state.mode3D) {
      const obj = state.objects3D.find(o => o.id === firstId);
      if (obj) {
        clipboardObject3D = JSON.parse(JSON.stringify(obj));
        clipboardObject = null;
      }
    } else {
      const obj = state.objects.find(o => o.id === firstId);
      if (obj) {
        clipboardObject = JSON.parse(JSON.stringify(obj));
        clipboardObject3D = null;
      }
    }
  }, [state.selectedObjectIds, state.objects, state.objects3D, state.mode3D]);

  const pasteObject = useCallback(() => {
    if (state.mode3D && clipboardObject3D) {
      const newObject: EditorObject3D = {
        ...JSON.parse(JSON.stringify(clipboardObject3D)),
        id: generateId(),
        name: `${clipboardObject3D.name} (copie)`,
        properties: {
          ...clipboardObject3D.properties,
          x: clipboardObject3D.properties.x + 20,
          z: clipboardObject3D.properties.z + 20,
        },
      };
      
      setState(prev => ({
        ...prev,
        objects3D: [newObject, ...prev.objects3D],
        selectedObjectIds: [newObject.id],
        hasUnsavedChanges: true,
      }));
    } else if (!state.mode3D && clipboardObject) {
      const newObject: EditorObject = {
        ...JSON.parse(JSON.stringify(clipboardObject)),
        id: generateId(),
        name: `${clipboardObject.name} (copie)`,
        properties: {
          ...clipboardObject.properties,
          x: clipboardObject.properties.x + 20,
          y: clipboardObject.properties.y + 20,
        },
      };
      
      setState(prev => ({
        ...prev,
        objects: [newObject, ...prev.objects],
        selectedObjectIds: [newObject.id],
        hasUnsavedChanges: true,
      }));
    }
  }, [state.mode3D]);

  const moveKeyframe = useCallback((objectId: string, keyframeIndex: number, newTime: number) => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: true,
      objects: prev.objects.map(obj => {
        if (obj.id !== objectId) return obj;
        
        const newKeyframes = [...obj.keyframes];
        if (keyframeIndex >= 0 && keyframeIndex < newKeyframes.length) {
          newKeyframes[keyframeIndex] = {
            ...newKeyframes[keyframeIndex],
            time: newTime,
          };
          newKeyframes.sort((a, b) => a.time - b.time);
        }
        return { ...obj, keyframes: newKeyframes };
      }),
      objects3D: prev.objects3D.map(obj => {
        if (obj.id !== objectId) return obj;
        
        const newKeyframes = [...obj.keyframes];
        if (keyframeIndex >= 0 && keyframeIndex < newKeyframes.length) {
          newKeyframes[keyframeIndex] = {
            ...newKeyframes[keyframeIndex],
            time: newTime,
          };
          newKeyframes.sort((a, b) => a.time - b.time);
        }
        return { ...obj, keyframes: newKeyframes };
      }),
    }));
  }, []);

  const deleteKeyframe = useCallback((objectId: string, keyframeIndex: number) => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: true,
      objects: prev.objects.map(obj => {
        if (obj.id !== objectId) return obj;
        const newKeyframes = obj.keyframes.filter((_, idx) => idx !== keyframeIndex);
        return { ...obj, keyframes: newKeyframes };
      }),
      objects3D: prev.objects3D.map(obj => {
        if (obj.id !== objectId) return obj;
        const newKeyframes = obj.keyframes.filter((_, idx) => idx !== keyframeIndex);
        return { ...obj, keyframes: newKeyframes };
      }),
    }));
  }, []);

  return {
    state,
    setTheme,
    setShowProperties,
    setAnimatedMode,
    setMode3D,
    setModeFireworks,
    addFireworkObject,
    addObject,
    addObject3D,
    addObject3DWithGeometry,
    addObject3DFromOBJ,
    selectObject,
    updateObjectProperties,
    updateObject3DProperties,
    updateSelectedObjectsProperties,
    updateSelectedObjects3DProperties,
    renameObject,
    deleteObject,
    deleteSelectedObjects,
    reorderObjects,
    addKeyframe,
    addScene,
    play,
    pause,
    stop,
    setCurrentTime,
    getInterpolatedProperties,
    getInterpolatedProperties3D,
    resetProject,
    loadProject,
    setBackgroundImage,
    setAudioTrack,
    copySelectedObject,
    pasteObject,
    moveKeyframe,
    deleteKeyframe,
    markAsSaved,
    undo,
    redo,
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
  };
};
