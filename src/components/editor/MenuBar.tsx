import React from 'react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  MenubarCheckboxItem,
} from '@/components/ui/menubar';
import { ShapeType, Shape3DType, ThemeMode } from '@/types/editor';

interface MenuBarProps {
  onNewProject: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onImport: () => void;
  onExport: () => void;
  onAddObject: (type: ShapeType) => void;
  onAddObject3D: (type: Shape3DType) => void;
  onAddKeyframe: () => void;
  onDelete: () => void;
  onRename: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  animatedMode: boolean;
  onAnimatedModeChange: (animated: boolean) => void;
  showProperties: boolean;
  onShowPropertiesChange: (show: boolean) => void;
  mode3D: boolean;
  hasSelectedObject: boolean;
  onOpenLibrary: () => void;
  onOpenCustomEditor: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewProject,
  onOpenFile,
  onSave,
  onSaveAs,
  onImport,
  onExport,
  onAddObject,
  onAddObject3D,
  onAddKeyframe,
  onDelete,
  onRename,
  theme,
  onThemeChange,
  animatedMode,
  onAnimatedModeChange,
  showProperties,
  onShowPropertiesChange,
  mode3D,
  hasSelectedObject,
  onOpenLibrary,
  onOpenCustomEditor,
}) => {
  return (
    <Menubar className="border-b border-panel-border rounded-none bg-card px-2">
      <MenubarMenu>
        <MenubarTrigger className="text-sm">Fichier</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onNewProject}>
            Nouveau <MenubarShortcut>Ctrl+N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onOpenFile}>
            Ouvrir <MenubarShortcut>Ctrl+O</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onImport}>
            Importer <MenubarShortcut>Ctrl+I</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onSave}>
            Sauvegarder <MenubarShortcut>Ctrl+S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onSaveAs}>
            Sauvegarder sous...
          </MenubarItem>
          <MenubarItem onClick={onExport}>
            Exporter
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Quitter <MenubarShortcut>Alt+F4</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="text-sm">Édition</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onDelete} disabled={!hasSelectedObject}>
            Supprimer <MenubarShortcut>Suppr</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onAddKeyframe} disabled={!hasSelectedObject}>
            Ajouter Keyframe <MenubarShortcut>K</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="text-sm">Objet</MenubarTrigger>
        <MenubarContent>
          {!mode3D ? (
            <MenubarSub>
              <MenubarSubTrigger>Ajouter 2D</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={() => onAddObject('rectangle')}>Rectangle</MenubarItem>
                <MenubarItem onClick={() => onAddObject('circle')}>Cercle</MenubarItem>
                <MenubarItem onClick={() => onAddObject('triangle')}>Triangle</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          ) : (
            <>
              <MenubarSub>
                <MenubarSubTrigger>Formes de base</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => onAddObject3D('cube')}>Cube</MenubarItem>
                  <MenubarItem onClick={() => onAddObject3D('sphere')}>Sphère</MenubarItem>
                  <MenubarItem onClick={() => onAddObject3D('cylinder')}>Cylindre</MenubarItem>
                  <MenubarItem onClick={() => onAddObject3D('cone')}>Cône</MenubarItem>
                  <MenubarItem onClick={() => onAddObject3D('torus')}>Tore</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem onClick={onOpenLibrary}>
                📦 Bibliothèque d'objets...
              </MenubarItem>
              <MenubarItem onClick={onOpenCustomEditor}>
                ✏️ Créer une forme personnalisée...
              </MenubarItem>
            </>
          )}
          <MenubarSeparator />
          <MenubarItem onClick={onRename} disabled={!hasSelectedObject}>
            Renommer <MenubarShortcut>F2</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="text-sm">Préférences</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>Changer de thème</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={() => onThemeChange('light')}>
                {theme === 'light' && '✓ '}Clair
              </MenubarItem>
              <MenubarItem onClick={() => onThemeChange('dark')}>
                {theme === 'dark' && '✓ '}Sombre
              </MenubarItem>
              <MenubarItem onClick={() => onThemeChange('system')}>
                {theme === 'system' && '✓ '}Système
              </MenubarItem>
          </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarCheckboxItem
            checked={animatedMode}
            onCheckedChange={onAnimatedModeChange}
          >
            Animé
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={showProperties}
            onCheckedChange={onShowPropertiesChange}
          >
            Propriétés
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
