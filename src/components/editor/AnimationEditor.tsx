import React, { useState, useRef } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { MenuBar } from './MenuBar';
import { ObjectsList } from './ObjectsList';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { Timeline } from './Timeline';
import { useEditorState } from '@/hooks/useEditorState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  } = useEditorState();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedObject = state.objects.find(obj => obj.id === state.selectedObjectId) || null;

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, we just show a toast - you can extend this to actually load projects
      toast.success(`Fichier sélectionné: ${file.name}`);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
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
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json,.anim,.project"
      />
      
      <MenuBar
        onNewProject={resetProject}
        onOpenFile={handleOpenFile}
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
                  selectedObjectId={state.selectedObjectId}
                  currentTime={state.currentTime}
                  duration={state.duration}
                  isPlaying={state.isPlaying}
                  onPlay={play}
                  onPause={pause}
                  onStop={stop}
                  onSeek={setCurrentTime}
                  onAddScene={addScene}
                  onSelectObject={selectObject}
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
    </div>
  );
};
