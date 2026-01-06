import { useState, useCallback, useEffect, useRef } from 'react';
import { EditorState, EditorObject, ObjectProperties, Keyframe, Scene, ShapeType, ThemeMode } from '@/types/editor';

const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultProperties: ObjectProperties = {
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 100,
  color: '#00d4ff',
};

const initialState: EditorState = {
  objects: [],
  selectedObjectId: null,
  scenes: [],
  audioTrack: null,
  currentTime: 0,
  isPlaying: false,
  duration: 7200000, // 2 hours in ms
  showProperties: true,
  animatedMode: true,
  theme: 'dark',
};

export const useEditorState = () => {
  const [state, setState] = useState<EditorState>(initialState);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

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

  const setTheme = useCallback((theme: ThemeMode) => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const setShowProperties = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showProperties: show }));
  }, []);

  const setAnimatedMode = useCallback((animated: boolean) => {
    setState(prev => ({ ...prev, animatedMode: animated }));
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
      selectedObjectId: newObject.id,
    }));
  }, [state.objects.length]);

  const selectObject = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedObjectId: id }));
  }, []);

  const updateObjectProperties = useCallback((id: string, properties: Partial<ObjectProperties>) => {
    setState(prev => ({
      ...prev,
      objects: prev.objects.map(obj =>
        obj.id === id ? { ...obj, properties: { ...obj.properties, ...properties } } : obj
      ),
    }));
  }, []);

  const renameObject = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      objects: prev.objects.map(obj =>
        obj.id === id ? { ...obj, name } : obj
      ),
    }));
  }, []);

  const deleteObject = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      objects: prev.objects.filter(obj => obj.id !== id),
      selectedObjectId: prev.selectedObjectId === id ? null : prev.selectedObjectId,
    }));
  }, []);

  const reorderObjects = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newObjects = [...prev.objects];
      const [removed] = newObjects.splice(fromIndex, 1);
      newObjects.splice(toIndex, 0, removed);
      return { ...prev, objects: newObjects };
    });
  }, []);

  const addKeyframe = useCallback(() => {
    if (!state.selectedObjectId) return;
    
    setState(prev => {
      const selectedObject = prev.objects.find(obj => obj.id === prev.selectedObjectId);
      if (!selectedObject) return prev;
      
      const existingIndex = selectedObject.keyframes.findIndex(
        kf => Math.abs(kf.time - prev.currentTime) < 100
      );
      
      const newKeyframe: Keyframe = {
        time: prev.currentTime,
        properties: { ...selectedObject.properties },
      };
      
      return {
        ...prev,
        objects: prev.objects.map(obj => {
          if (obj.id !== prev.selectedObjectId) return obj;
          
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
    });
  }, [state.selectedObjectId]);

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
      
      return { ...prev, scenes: newScenes };
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
      color: prevKf.properties.color,
    };
  }, [state.animatedMode]);

  const resetProject = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    setTheme,
    setShowProperties,
    setAnimatedMode,
    addObject,
    selectObject,
    updateObjectProperties,
    renameObject,
    deleteObject,
    reorderObjects,
    addKeyframe,
    addScene,
    play,
    pause,
    stop,
    setCurrentTime,
    getInterpolatedProperties,
    resetProject,
  };
};
