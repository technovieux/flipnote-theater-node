import React, { useState } from 'react';
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
import { ShapeType, ThemeMode } from '@/types/editor';

interface MenuBarProps {
  onNewProject: () => void;
  onOpenFile: () => void;
  onImport: () => void;
  onAddObject: (type: ShapeType) => void;
  onAddKeyframe: () => void;
  onDelete: () => void;
  onRename: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  animatedMode: boolean;
  onAnimatedModeChange: (animated: boolean) => void;
  showProperties: boolean;
  onShowPropertiesChange: (show: boolean) => void;
  hasSelectedObject: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewProject,
  onOpenFile,
  onImport,
  onAddObject,
  onAddKeyframe,
  onDelete,
  onRename,
  theme,
  onThemeChange,
  animatedMode,
  onAnimatedModeChange,
  showProperties,
  onShowPropertiesChange,
  hasSelectedObject,
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
          <MenubarItem>
            Sauvegarder <MenubarShortcut>Ctrl+S</MenubarShortcut>
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>Exporter</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Images (séquence)</MenubarItem>
              <MenubarItem>Vidéo</MenubarItem>
              <MenubarItem>PDF</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
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
          <MenubarSub>
            <MenubarSubTrigger>Ajouter</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={() => onAddObject('rectangle')}>Rectangle</MenubarItem>
              <MenubarItem onClick={() => onAddObject('circle')}>Cercle</MenubarItem>
              <MenubarItem onClick={() => onAddObject('triangle')}>Triangle</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
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
