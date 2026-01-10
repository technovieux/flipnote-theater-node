import React, { useState, useRef, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { MenuBar } from './MenuBar';
import { ObjectsList } from './ObjectsList';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { Timeline } from './Timeline';
import { ExportDialog } from './ExportDialog';
import { useEditorState } from '@/hooks/useEditorState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { saveProject, saveProjectAs, openProject, hasCurrentFile, clearCurrentFile } from '@/lib/fileOperations';

export const AnimationEditor: React.FC = () => {
  const {
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
    loadProject,
    setBackgroundImage,
    setAudioTrack,
    copySelectedObject,
    pasteObject,
    moveKeyframe,
    deleteKeyframe,
  } = useEditorState();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ objectId: string; keyframeIndex: number } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // Confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ type: 'audio' | 'image'; file: File } | null>(null);

  const selectedObject = state.objects.find(obj => obj.id === state.selectedObjectId) || null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'C') {
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
      
      // K for keyframe
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        addKeyframe();
        return;
      }
      
      // Delete or Backspace to delete selected object or keyframe
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // Prioritize keyframe deletion if one is selected
        if (selectedKeyframe) {
          deleteKeyframe(selectedKeyframe.objectId, selectedKeyframe.keyframeIndex);
          setSelectedKeyframe(null);
        } else if (state.selectedObjectId) {
          deleteObject(state.selectedObjectId);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelectedObject, pasteObject, state.isPlaying, state.selectedObjectId, selectedKeyframe, play, pause, addKeyframe, deleteObject, deleteKeyframe, state]);

  const handleSave = async () => {
    try {
      const success = await saveProject(state);
      if (success) {
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
        toast.success('Projet sauvegardé avec succès');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const handleOpen = async () => {
    try {
      const project = await openProject();
      if (project) {
        loadProject(project);
        toast.success('Projet chargé avec succès');
      }
    } catch (error) {
      toast.error('Erreur lors du chargement du projet');
      console.error(error);
    }
  };

  const handleNewProject = () => {
    clearCurrentFile();
    resetProject();
    toast.info('Nouveau projet créé');
  };

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
        
        // Generate simple waveform data
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
        
        setAudioTrack(file, waveform, audioBuffer.duration * 1000);
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
    
    // Check if we need confirmation
    if (isAudio && state.audioTrack) {
      setPendingImport({ type: 'audio', file });
      setConfirmDialogOpen(true);
    } else if (isImage && state.backgroundImage) {
      setPendingImport({ type: 'image', file });
      setConfirmDialogOpen(true);
    } else {
      // No existing content, import directly
      if (isAudio) {
        processAudioFile(file);
      } else {
        processImageFile(file);
      }
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
    if (selectedObject && newName.trim()) {
      renameObject(selectedObject.id, newName.trim());
      setRenameDialogOpen(false);
      setNewName('');
    }
  };

  const openRenameDialog = () => {
    if (selectedObject) {
      setNewName(selectedObject.name);
      setRenameDialogOpen(true);
    }
  };

  const handleDelete = () => {
    if (state.selectedObjectId) {
      deleteObject(state.selectedObjectId);
    }
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
      
      <MenuBar
        onNewProject={handleNewProject}
        onOpenFile={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onImport={handleImport}
        onExport={() => setExportDialogOpen(true)}
        onAddObject={addObject}
        onAddKeyframe={addKeyframe}
        onDelete={handleDelete}
        onRename={openRenameDialog}
        theme={state.theme}
        onThemeChange={setTheme}
        animatedMode={state.animatedMode}
        onAnimatedModeChange={setAnimatedMode}
        showProperties={state.showProperties}
        onShowPropertiesChange={setShowProperties}
        hasSelectedObject={!!state.selectedObjectId}
      />
      
      <div className="flex-1 p-1 overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize={60} minSize={30}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={25} minSize={15}>
                <ObjectsList
                  objects={state.objects}
                  selectedObjectId={state.selectedObjectId}
                  onSelect={selectObject}
                  onReorder={reorderObjects}
                  onDelete={deleteObject}
                  onRename={renameObject}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={75} minSize={30}>
                <Canvas
                  objects={state.objects}
                  selectedObjectId={state.selectedObjectId}
                  onSelect={selectObject}
                  onUpdateProperties={updateObjectProperties}
                  getInterpolatedProperties={getInterpolatedProperties}
                  currentTime={state.currentTime}
                  backgroundImage={state.backgroundImage}
                  isPlaying={state.isPlaying}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            <ResizablePanelGroup direction="horizontal">
              {state.showProperties && (
                <>
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <PropertiesPanel
                      selectedObject={selectedObject}
                      onUpdateProperties={updateObjectProperties}
                      onAddKeyframe={addKeyframe}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}
              <ResizablePanel defaultSize={state.showProperties ? 70 : 100} minSize={40}>
                <Timeline
                  objects={state.objects}
                  scenes={state.scenes}
                  audioTrack={state.audioTrack}
                  selectedObjectId={state.selectedObjectId}
                  selectedKeyframe={selectedKeyframe}
                  currentTime={state.currentTime}
                  duration={state.duration}
                  isPlaying={state.isPlaying}
                  onPlay={play}
                  onPause={pause}
                  onStop={stop}
                  onSeek={setCurrentTime}
                  onAddScene={addScene}
                  onSelectObject={selectObject}
                  onSelectKeyframe={(objectId, keyframeIndex) => setSelectedKeyframe({ objectId, keyframeIndex })}
                  onMoveKeyframe={moveKeyframe}
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
    </div>
  );
};
