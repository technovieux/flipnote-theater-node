import React, { useState, useRef, useEffect } from 'react';
import { EditorMode, ProjectConfig } from '@/types/editor';
import { FireworkProduct, FireworkCategory } from '@/types/fireworks';
import { SpotlightFixture } from '@/types/spotlight';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { MenuBar } from './MenuBar';
import { ObjectsList } from './ObjectsList';
import { ObjectsList3D } from './ObjectsList3D';
import { Canvas } from './Canvas';
import { Canvas3D } from './Canvas3D';
import { PropertiesPanel } from './PropertiesPanel';
import { PropertiesPanel3D } from './PropertiesPanel3D';
import { PropertiesPanelSpotlight, SpotlightObjectData } from './PropertiesPanelSpotlight';
import { Timeline } from './Timeline';
import { ExportDialog } from './ExportDialog';
import { WelcomeDialog } from './WelcomeDialog';
import { ShapeLibraryDialog } from './ShapeLibraryDialog';
import { CustomShapeEditor } from './CustomShapeEditor';
import { FireworkLibraryDialog } from './FireworkLibraryDialog';
import { SpotlightLibraryDialog } from './SpotlightLibraryDialog';
import { FixtureLibraryDialog } from './FixtureLibraryDialog';
import { FixtureDefinition } from '@/lib/fixtureLoader';
import { useEditorState } from '@/hooks/useEditorState';
import { ProjectConfigDialog } from './ProjectConfigDialog';
import { getSunLightInfo } from '@/lib/sunPosition';
import { dmxOutput, DMXOutput } from '@/lib/dmxOutput';
import { LibraryShape3D } from '@/data/shape3DLibrary';
import { ImportedOBJModel } from '@/lib/objImporter';
import { saveModels, modelExistsByFileName } from '@/lib/objLibraryStorage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { saveProject, saveProjectAs, openProject, clearCurrentFile, FlptProject, EmbeddedOBJModel } from '@/lib/fileOperations';
import { SpotlightEditorObject } from '@/types/editor';

// Derive display color from spotlight channel values
const getSpotlightColor = (spot: SpotlightEditorObject, channelValues: number[]): string => {
  let r = 255, g = 255, b = 255;
  let dimmer = 255;
  let hasRgb = false;

  spot.fixture.channels.forEach((ch, i) => {
    const val = channelValues[i] ?? 0;
    if (ch.type === 'dimmer') {
      dimmer = val;
    } else if (ch.type === 'color') {
      const name = ch.name.toLowerCase();
      if (name.includes('rouge') || name.includes('red')) { r = val; hasRgb = true; }
      else if (name.includes('vert') || name.includes('green')) { g = val; hasRgb = true; }
      else if (name.includes('bleu') || name.includes('blue')) { b = val; hasRgb = true; }
    }
  });

  if (!hasRgb) {
    // No RGB channels — use dimmer as white intensity
    const v = dimmer;
    return `rgb(${v}, ${v}, ${v})`;
  }

  // Apply dimmer as a multiplier
  const factor = dimmer / 255;
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
};


export const AnimationEditor: React.FC = () => {
  const {
    state,
    setTheme,
    setShowProperties,
    setAnimatedMode,
    setMode3D,
    setModeFireworks,
    setModeSpotlight,
    setModeCombined,
    updateProjectConfig,
    addFireworkObject,
    addSpotlightObject,
    updateSpotlightDmxAddress,
    updateSpotlightPosition,
    updateSpotlightChannelValue,
    getInterpolatedSpotlightChannels,
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
    moveScene,
    deleteScene,
    play,
    pause,
    stop,
    setCurrentTime,
    getInterpolatedProperties,
    getInterpolatedProperties3D,
    resetProject,
    loadProject,
    setBackgroundImage,
    addAudioTrack,
    removeAudioTrack,
    copySelectedObject,
    pasteObject,
    moveKeyframe,
    deleteKeyframe,
    markAsSaved,
    undo,
    redo,
  } = useEditorState();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ objectId: string; keyframeIndex: number } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(true);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [renderMode, setRenderMode] = useState(false);
  const [fireworkLibraryOpen, setFireworkLibraryOpen] = useState(false);
  const [spotlightLibraryOpen, setSpotlightLibraryOpen] = useState(false);
  const [fixtureLibraryOpen, setFixtureLibraryOpen] = useState(false);
  const [projectConfigOpen, setProjectConfigOpen] = useState(false);
  const [dmxConnected, setDmxConnected] = useState(false);
  const [dmxRealtime, setDmxRealtime] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  
  // Confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ type: 'audio' | 'image'; file: File } | null>(null);
  
  // Exit confirmation dialog state
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  
  // OBJ import dialog state
  const [objImportDialogOpen, setObjImportDialogOpen] = useState(false);
  const [pendingOBJModels, setPendingOBJModels] = useState<EmbeddedOBJModel[]>([]);

  // Derived: selected objects arrays
  const selectedObjects = state.objects.filter(obj => state.selectedObjectIds.includes(obj.id));
  const selectedObjects3D = state.objects3D.filter(obj => state.selectedObjectIds.includes(obj.id));

  // Handle beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.hasUnsavedChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          copySelectedObject();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          pasteObject();
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          await handleSave();
        } else if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          await handleOpen();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          handleNewProject();
        } else if (e.key === 'a' || e.key === 'A') {
          // Ctrl+A: select all
          e.preventDefault();
          const allObjects = state.mode3D ? state.objects3D : state.objects;
          allObjects.forEach((obj, idx) => {
            if (idx === 0) {
              selectObject(obj.id);
            } else {
              selectObject(obj.id, { ctrlKey: true });
            }
          });
        }
        return;
      }
      
      // Space for play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }
      
      // K for keyframe (disabled in render mode)
      if (e.key === 'k' || e.key === 'K') {
        if (!renderMode) {
          e.preventDefault();
          addKeyframe();
        }
        return;
      }
      
      // Delete or Backspace to delete selected object or keyframe (disabled in render mode)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!renderMode) {
          e.preventDefault();
          if (selectedKeyframe) {
            deleteKeyframe(selectedKeyframe.objectId, selectedKeyframe.keyframeIndex);
            setSelectedKeyframe(null);
          } else if (selectedSceneId) {
            deleteScene(selectedSceneId);
            setSelectedSceneId(null);
          } else if (state.selectedObjectIds.length > 0) {
            deleteSelectedObjects();
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelectedObject, pasteObject, state.isPlaying, state.selectedObjectIds, selectedKeyframe, selectedSceneId, play, pause, addKeyframe, deleteSelectedObjects, deleteKeyframe, deleteScene, state, undo, redo, selectObject, state.mode3D, state.objects, state.objects3D, renderMode]);

  const handleSave = async () => {
    try {
      const success = await saveProject(state);
      if (success) {
        markAsSaved();
        toast.success('Projet sauvegardé avec succès');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const handleSaveAs = async () => {
    try {
      const success = await saveProjectAs(state);
      if (success) {
        markAsSaved();
        toast.success('Projet sauvegardé avec succès');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const handleExitWithoutSave = () => {
    setExitDialogOpen(false);
    window.removeEventListener('beforeunload', () => {});
    window.close();
  };

  const handleSaveAndExit = async () => {
    await handleSave();
    setExitDialogOpen(false);
  };

  const handleOpen = async () => {
    try {
      const project = await openProject();
      if (project) {
        loadProject(project);
        setWelcomeDialogOpen(false);
        toast.success('Projet chargé avec succès');
        
        // Check for embedded OBJ models
        if (project.embeddedOBJModels && project.embeddedOBJModels.length > 0) {
          setPendingOBJModels(project.embeddedOBJModels);
          setObjImportDialogOpen(true);
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement du projet');
      console.error(error);
    }
  };
  
  const handleImportOBJModelsToLibrary = async () => {
    try {
      let importedCount = 0;
      let skippedCount = 0;
      
      for (const model of pendingOBJModels) {
        const exists = await modelExistsByFileName(model.fileName);
        if (!exists) {
          await saveModels([{
            name: model.name,
            fileName: model.fileName,
            geometry: model.geometry,
          }]);
          importedCount++;
        } else {
          skippedCount++;
        }
      }
      
      if (importedCount > 0) {
        toast.success(`${importedCount} modèle(s) importé(s) dans la bibliothèque`);
      }
      if (skippedCount > 0) {
        toast.info(`${skippedCount} modèle(s) déjà présent(s)`);
      }
    } catch (error) {
      toast.error("Erreur lors de l'import des modèles");
      console.error(error);
    }
    
    setObjImportDialogOpen(false);
    setPendingOBJModels([]);
  };
  
  const handleSkipOBJImport = () => {
    setObjImportDialogOpen(false);
    setPendingOBJModels([]);
  };

  const handleNewProject = () => {
    clearCurrentFile();
    resetProject();
    setWelcomeDialogOpen(true);
    toast.info('Nouveau projet créé');
  };

  const handleSelectMode = (mode: EditorMode) => {
    if (mode === 'fireworks') {
      setModeFireworks(true);
    } else if (mode === 'spotlight') {
      setModeSpotlight(true);
    } else if (mode === 'combined') {
      setModeCombined(true);
    } else {
      setMode3D(mode === '3d');
    }
    setWelcomeDialogOpen(false);
  };

  // DMX handlers
  const handleDmxConnect = async () => {
    try {
      if (!DMXOutput.isSupported()) {
        toast.error('Web Serial API non supportée. Utilisez Chrome ou Edge.');
        return;
      }
      const success = await dmxOutput.connect();
      if (success) {
        setDmxConnected(true);
        toast.success('Port DMX connecté');
      }
    } catch (error) {
      toast.error(`Erreur DMX: ${(error as Error).message}`);
    }
  };

  const handleDmxDisconnect = async () => {
    await dmxOutput.disconnect();
    setDmxConnected(false);
    setDmxRealtime(false);
    toast.info('Port DMX déconnecté');
  };

  const handleDmxRealtimeChange = (enabled: boolean) => {
    setDmxRealtime(enabled);
    if (enabled) {
      dmxOutput.startRealtimeOutput();
      toast.success('Sortie DMX temps-réel activée');
    } else {
      dmxOutput.stopRealtimeOutput();
      toast.info('Sortie DMX temps-réel désactivée');
    }
  };

  // Send DMX values when in realtime mode
  useEffect(() => {
    if (!dmxRealtime || !dmxConnected || !state.modeSpotlight) return;
    
    for (const spot of state.spotlights) {
      const values = getInterpolatedSpotlightChannels(spot, state.currentTime);
      dmxOutput.setChannels(spot.dmxAddress, values);
    }
  }, [dmxRealtime, dmxConnected, state.modeSpotlight, state.spotlights, state.currentTime, getInterpolatedSpotlightChannels]);

  // Cleanup DMX on unmount
  useEffect(() => {
    return () => {
      dmxOutput.disconnect();
    };
  }, []);

  // Derived spotlight data for properties panel
  const selectedSpotlightData: SpotlightObjectData[] = state.spotlights
    .filter(s => state.selectedObjectIds.includes(s.id))
    .map(s => ({
      id: s.id,
      name: s.name,
      fixtureName: s.fixture.name,
      dmxAddress: s.dmxAddress,
      channels: s.fixture.channels,
      channelValues: s.channelValues,
      x: s.x,
      y: s.y,
    }));

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleImport = () => {
    importInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`Fichier sélectionné: ${file.name}`);
      e.target.value = '';
    }
  };

  const processAudioFile = (file: File) => {
    const audioContext = new AudioContext();
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = 200;
        const blockSize = Math.floor(rawData.length / samples);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }
        
        addAudioTrack(file, waveform, audioBuffer.duration * 1000);
        toast.success(`Audio importé: ${file.name}`);
      } catch (error) {
        toast.error("Erreur lors du chargement de l'audio");
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setBackgroundImage(dataUrl);
      toast.success(`Image importée: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    
    if (!isAudio && !isImage) {
      toast.error("Type de fichier non supporté. Utilisez une image ou un fichier audio.");
      e.target.value = '';
      return;
    }
    
    if (isAudio) {
      processAudioFile(file);
    } else if (isImage && state.backgroundImage) {
      setPendingImport({ type: 'image', file });
      setConfirmDialogOpen(true);
    } else if (isImage) {
      processImageFile(file);
    }
    
    e.target.value = '';
  };

  const handleConfirmReplace = () => {
    if (pendingImport) {
      if (pendingImport.type === 'audio') {
        processAudioFile(pendingImport.file);
      } else {
        processImageFile(pendingImport.file);
      }
    }
    setPendingImport(null);
    setConfirmDialogOpen(false);
  };

  const handleCancelReplace = () => {
    setPendingImport(null);
    setConfirmDialogOpen(false);
  };

  const handleRename = () => {
    if (selectedObjects.length === 1 && newName.trim()) {
      renameObject(selectedObjects[0].id, newName.trim());
      setRenameDialogOpen(false);
      setNewName('');
    } else if (selectedObjects3D.length === 1 && newName.trim()) {
      renameObject(selectedObjects3D[0].id, newName.trim());
      setRenameDialogOpen(false);
      setNewName('');
    }
  };

  const openRenameDialog = () => {
    const firstSelected = selectedObjects[0] || selectedObjects3D[0];
    if (firstSelected) {
      setNewName(firstSelected.name);
      setRenameDialogOpen(true);
    }
  };

  const handleDelete = () => {
    if (state.selectedObjectIds.length > 0) {
      deleteSelectedObjects();
    }
  };

  // Handle shape selection from library
  const handleSelectShapeFromLibrary = (shape: LibraryShape3D) => {
    if (shape.customGeometry) {
      addObject3DWithGeometry(
        shape.name,
        shape.type,
        shape.customGeometry,
        shape.defaultScale
      );
    } else if (shape.defaultScale) {
      addObject3DWithGeometry(
        shape.name,
        shape.type,
        undefined,
        shape.defaultScale
      );
    } else {
      addObject3D(shape.type);
    }
    toast.success(`${shape.name} ajouté`);
  };

  // Handle OBJ model selection from library
  const handleSelectOBJModel = (model: ImportedOBJModel) => {
    addObject3DFromOBJ(model.name, model.geometry);
    toast.success(`${model.name} ajouté`);
  };

  // Handle custom shape creation
  const handleCreateCustomShape = (
    name: string,
    points: { x: number; y: number }[],
    depth: number,
    bevel: boolean
  ) => {
    addObject3DWithGeometry(
      name,
      'custom',
      {
        points,
        depth,
        bevelEnabled: bevel,
        bevelThickness: bevel ? 0.05 : 0,
        bevelSize: bevel ? 0.05 : 0,
      }
    );
    toast.success(`${name} créée`);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json,.anim,.project"
      />
      <input
        type="file"
        ref={importInputRef}
        onChange={handleImportChange}
        className="hidden"
        accept="image/*,audio/*"
      />
      <input
        type="file"
        ref={audioInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processAudioFile(file);
          e.target.value = '';
        }}
        className="hidden"
        accept="audio/*"
      />
      
      <MenuBar
        onNewProject={handleNewProject}
        onOpenFile={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onImport={handleImport}
        onExport={() => setExportDialogOpen(true)}
        onAddObject={addObject}
        onAddObject3D={addObject3D}
        onAddKeyframe={addKeyframe}
        onDelete={handleDelete}
        onRename={openRenameDialog}
        theme={state.theme}
        onThemeChange={setTheme}
        animatedMode={state.animatedMode}
        onAnimatedModeChange={setAnimatedMode}
        showProperties={state.showProperties}
        onShowPropertiesChange={setShowProperties}
        mode3D={state.mode3D}
        modeFireworks={state.modeFireworks}
        modeSpotlight={state.modeSpotlight}
        modeCombined={state.modeCombined}
        hasSelectedObject={state.selectedObjectIds.length > 0}
        onOpenLibrary={() => setLibraryDialogOpen(true)}
        onOpenCustomEditor={() => setCustomEditorOpen(true)}
        onOpenFireworkLibrary={() => setFireworkLibraryOpen(true)}
        onOpenSpotlightLibrary={() => {
          if (state.modeSpotlight && !state.mode3D) {
            setSpotlightLibraryOpen(true);
          } else {
            setFixtureLibraryOpen(true);
          }
        }}
        renderMode={renderMode}
        onToggleRenderMode={() => setRenderMode(!renderMode)}
        onOpenProjectConfig={() => setProjectConfigOpen(true)}
        dmxConnected={dmxConnected}
        dmxRealtime={dmxRealtime}
        onDmxConnect={handleDmxConnect}
        onDmxDisconnect={handleDmxDisconnect}
        onDmxRealtimeChange={handleDmxRealtimeChange}
      />
      
      <div className="flex-1 p-1 overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize={60} minSize={30}>
           <ResizablePanelGroup direction="horizontal">
              {!renderMode && (
                <>
                  <ResizablePanel defaultSize={25} minSize={15}>
                    {state.modeSpotlight ? (
                      <ObjectsList
                        objects={state.spotlights.map(s => ({
                          id: s.id,
                          name: s.name,
                          type: 'circle' as const,
                          properties: { x: s.x, y: s.y, width: 50, height: 50, rotation: 0, opacity: s.opacity, color: s.color },
                          keyframes: s.keyframes.map(kf => ({ time: kf.time, properties: { x: s.x, y: s.y, width: 50, height: 50, rotation: 0, opacity: 100, color: s.color } })),
                        }))}
                        selectedObjectIds={state.selectedObjectIds}
                        onSelect={selectObject}
                        onReorder={reorderObjects}
                        onDelete={deleteObject}
                        onRename={renameObject}
                      />
                    ) : state.mode3D ? (
                      <ObjectsList3D
                        objects={state.objects3D}
                        selectedObjectIds={state.selectedObjectIds}
                        onSelect={selectObject}
                        onReorder={reorderObjects}
                        onDelete={deleteObject}
                        onRename={renameObject}
                      />
                    ) : (
                      <ObjectsList
                        objects={state.objects}
                        selectedObjectIds={state.selectedObjectIds}
                        onSelect={selectObject}
                        onReorder={reorderObjects}
                        onDelete={deleteObject}
                        onRename={renameObject}
                      />
                    )}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}
              <ResizablePanel defaultSize={renderMode ? 100 : 75} minSize={30}>
                {state.mode3D ? (
                  <Canvas3D
                    objects={state.objects3D}
                    selectedObjectIds={renderMode ? [] : state.selectedObjectIds}
                    onSelect={renderMode ? () => {} : selectObject}
                    onUpdateProperties={renderMode ? () => {} : updateObject3DProperties}
                    getInterpolatedProperties={getInterpolatedProperties3D}
                    currentTime={state.currentTime}
                    isPlaying={state.isPlaying}
                    sunLight={state.modeCombined ? getSunLightInfo(
                      state.projectConfig.latitude,
                      state.projectConfig.longitude,
                      state.projectConfig.startDate,
                      state.projectConfig.startTime,
                      state.currentTime
                    ) : null}
                  />
                ) : state.modeSpotlight ? (
                  <Canvas
                    objects={state.spotlights.map(s => {
                      const channels = getInterpolatedSpotlightChannels(s, state.currentTime);
                      const color = getSpotlightColor(s, channels);
                      return {
                        id: s.id,
                        name: s.name,
                        type: 'rectangle' as const,
                        properties: { x: s.x, y: s.y, width: 60, height: 60, rotation: 0, opacity: 100, color },
                        keyframes: [],
                      };
                    })}
                    selectedObjectIds={renderMode ? [] : state.selectedObjectIds}
                    onSelect={renderMode ? () => {} : selectObject}
                    onUpdateProperties={renderMode ? () => {} : (id, props) => {
                      if (props.x !== undefined || props.y !== undefined) {
                        updateSpotlightPosition(id, { x: props.x, y: props.y });
                      }
                    }}
                    getInterpolatedProperties={(obj) => obj.properties}
                    currentTime={state.currentTime}
                    backgroundImage={state.backgroundImage}
                    isPlaying={state.isPlaying}
                  />
                ) : (
                  <Canvas
                    objects={state.objects}
                    selectedObjectIds={renderMode ? [] : state.selectedObjectIds}
                    onSelect={renderMode ? () => {} : selectObject}
                    onUpdateProperties={renderMode ? () => {} : updateObjectProperties}
                    getInterpolatedProperties={getInterpolatedProperties}
                    currentTime={state.currentTime}
                    backgroundImage={state.backgroundImage}
                    isPlaying={state.isPlaying}
                  />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            <ResizablePanelGroup direction="horizontal">
              {state.showProperties && !renderMode && (
                <>
                  <ResizablePanel defaultSize={30} minSize={20}>
                    {state.modeSpotlight ? (
                      <PropertiesPanelSpotlight
                        selectedSpotlights={selectedSpotlightData}
                        onUpdateDmxAddress={updateSpotlightDmxAddress}
                        onUpdateChannelValue={updateSpotlightChannelValue}
                        onAddKeyframe={addKeyframe}
                      />
                    ) : state.mode3D ? (
                      <PropertiesPanel3D
                        selectedObjects={selectedObjects3D}
                        onUpdateProperties={updateObject3DProperties}
                        onUpdateAllSelected={updateSelectedObjects3DProperties}
                        onAddKeyframe={addKeyframe}
                      />
                    ) : (
                      <PropertiesPanel
                        selectedObjects={selectedObjects}
                        onUpdateProperties={updateObjectProperties}
                        onUpdateAllSelected={updateSelectedObjectsProperties}
                        onAddKeyframe={addKeyframe}
                      />
                    )}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}
              <ResizablePanel defaultSize={state.showProperties && !renderMode ? 70 : 100} minSize={40}>
                <Timeline
                  objects={state.modeSpotlight 
                    ? state.spotlights.map(s => ({
                        id: s.id,
                        name: s.name,
                        type: 'circle' as const,
                        properties: { x: s.x, y: s.y, width: 50, height: 50, rotation: 0, opacity: s.opacity, color: s.color },
                        keyframes: s.keyframes.map(kf => ({ time: kf.time, properties: { x: s.x, y: s.y, width: 50, height: 50, rotation: 0, opacity: 100, color: s.color } })),
                      }))
                    : state.objects}
                  objects3D={state.objects3D}
                  mode3D={state.mode3D && !state.modeSpotlight}
                  scenes={state.scenes}
                  audioTracks={state.audioTracks}
                  selectedObjectIds={state.selectedObjectIds}
                  selectedKeyframe={selectedKeyframe}
                  currentTime={state.currentTime}
                  duration={state.duration}
                  isPlaying={state.isPlaying}
                  onPlay={play}
                  onPause={pause}
                  onStop={stop}
                  onSeek={setCurrentTime}
                  onAddScene={addScene}
                  onMoveScene={moveScene}
                  onDeleteScene={deleteScene}
                  selectedSceneId={selectedSceneId}
                  onSelectScene={setSelectedSceneId}
                  onSelectObject={(id) => selectObject(id)}
                  onSelectKeyframe={(objectId, keyframeIndex) => setSelectedKeyframe({ objectId, keyframeIndex })}
                  onMoveKeyframe={moveKeyframe}
                  onDeleteKeyframe={(objectId, keyframeIndex) => {
                    deleteKeyframe(objectId, keyframeIndex);
                    setSelectedKeyframe(null);
                  }}
                  onAddAudio={() => audioInputRef.current?.click()}
                  onRemoveAudio={(trackId) => removeAudioTrack(trackId)}
                  renderMode={renderMode}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer l'objet</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nouveau nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer le contenu existant ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImport?.type === 'audio' 
                ? "Une bande son existe déjà. Voulez-vous la remplacer ?"
                : "Une image d'arrière-plan existe déjà. Voulez-vous la remplacer ?"
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>Remplacer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        state={state}
      />

      <WelcomeDialog
        open={welcomeDialogOpen}
        onSelectMode={handleSelectMode}
      />

      <ShapeLibraryDialog
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
        onSelectShape={handleSelectShapeFromLibrary}
        onSelectOBJModel={handleSelectOBJModel}
      />

      <CustomShapeEditor
        open={customEditorOpen}
        onOpenChange={setCustomEditorOpen}
        onCreateShape={handleCreateCustomShape}
      />

      <FireworkLibraryDialog
        open={fireworkLibraryOpen}
        onOpenChange={setFireworkLibraryOpen}
        onSelectFirework={(product, category) => {
          addFireworkObject(product, category);
          toast.success(`${product.name} ajouté au projet`);
        }}
      />

      <SpotlightLibraryDialog
        open={spotlightLibraryOpen}
        onOpenChange={setSpotlightLibraryOpen}
        onSelectFixture={(fixture) => {
          addSpotlightObject(fixture);
          toast.success(`${fixture.name} ajouté au projet`);
        }}
      />

      <FixtureLibraryDialog
        open={fixtureLibraryOpen}
        onOpenChange={setFixtureLibraryOpen}
        onSelectFixture={(fixture: FixtureDefinition) => {
          addObject3D('spotlight_lyre', fixture.id);
          toast.success(`${fixture.name} ajouté en 3D`);
        }}
      />
      <ProjectConfigDialog
        open={projectConfigOpen}
        onOpenChange={setProjectConfigOpen}
        config={state.projectConfig}
        onUpdateConfig={updateProjectConfig}
      />

      <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir quitter sans sauvegarder ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non sauvegardées. Que souhaitez-vous faire ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleExitWithoutSave}>
              Oui, laissez-moi partir
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndExit}>
              Bonne idée, je vais sauvegarder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={objImportDialogOpen} onOpenChange={setObjImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modèles 3D détectés</AlertDialogTitle>
            <AlertDialogDescription>
              Ce projet contient {pendingOBJModels.length} fichier(s) 3D (.obj).
              Voulez-vous les importer dans votre bibliothèque locale pour pouvoir les réutiliser dans d'autres projets ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 max-h-32 overflow-y-auto">
            <ul className="text-sm text-muted-foreground space-y-1">
              {pendingOBJModels.map((model, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-primary">📦</span>
                  {model.name}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipOBJImport}>
              Non merci
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleImportOBJModelsToLibrary}>
              Oui, importer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
