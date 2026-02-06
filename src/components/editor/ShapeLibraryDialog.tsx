import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { shape3DLibrary, shapeCategories, LibraryShape3D } from '@/data/shape3DLibrary';
import { cn } from '@/lib/utils';
import { ImportedOBJModel, parseOBJContent } from '@/lib/objImporter';
import { parseOBJFilesFromDirectory } from '@/lib/objImporter';
import { defaultModels, defaultModelCategories, DefaultModel } from '@/data/defaultModels';
import { getAllModels, saveModels, deleteModel } from '@/lib/objLibraryStorage';
import { FolderOpen, Trash2, Upload, Loader2, Package, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
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

interface ShapeLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectShape: (shape: LibraryShape3D) => void;
  onSelectOBJModel?: (model: ImportedOBJModel) => void;
}

export const ShapeLibraryDialog: React.FC<ShapeLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSelectShape,
  onSelectOBJModel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('geometric');
  const [hoveredShape, setHoveredShape] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importedModels, setImportedModels] = useState<ImportedOBJModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDefaultId, setLoadingDefaultId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load imported models on mount
  useEffect(() => {
    if (open) {
      loadImportedModels();
    }
  }, [open]);

  const loadImportedModels = async () => {
    try {
      const models = await getAllModels();
      setImportedModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const normalizeSearch = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const searchNormalized = normalizeSearch(searchQuery);

  const isSearching = searchQuery.trim().length > 0;

  const searchFilteredShapes = isSearching
    ? shape3DLibrary.filter(shape =>
        normalizeSearch(shape.name).includes(searchNormalized) ||
        normalizeSearch(shape.category).includes(searchNormalized)
      )
    : [];

  const searchFilteredModels = isSearching
    ? importedModels.filter(model =>
        normalizeSearch(model.name).includes(searchNormalized) ||
        normalizeSearch(model.fileName).includes(searchNormalized)
      )
    : [];

  const searchFilteredDefaults = isSearching
    ? defaultModels.filter(model =>
        normalizeSearch(model.name).includes(searchNormalized) ||
        normalizeSearch(model.category).includes(searchNormalized)
      )
    : [];

  const filteredShapes = shape3DLibrary.filter(shape => shape.category === selectedCategory);

  const handleSelectShape = (shape: LibraryShape3D) => {
    onSelectShape(shape);
    onOpenChange(false);
  };

  const handleSelectOBJModel = (model: ImportedOBJModel) => {
    if (onSelectOBJModel) {
      onSelectOBJModel(model);
      onOpenChange(false);
    }
  };

  const handleSelectDefaultModel = async (model: DefaultModel) => {
    if (!onSelectOBJModel) return;
    setLoadingDefaultId(model.id);
    try {
      const response = await fetch(model.path);
      if (!response.ok) throw new Error('Failed to fetch model');
      const content = await response.text();
      const geometry = parseOBJContent(content);
      if (!geometry) {
        toast.error('Impossible de charger ce modèle');
        return;
      }
      const importedModel: ImportedOBJModel = {
        id: `default-${model.id}-${Date.now()}`,
        name: model.name,
        fileName: model.fileName,
        geometry,
        createdAt: Date.now(),
      };
      onSelectOBJModel(importedModel);
      onOpenChange(false);
    } catch (error) {
      console.error('Error loading default model:', error);
      toast.error('Erreur lors du chargement du modèle');
    } finally {
      setLoadingDefaultId(null);
    }
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      const parsedModels = await parseOBJFilesFromDirectory(files);
      
      if (parsedModels.length === 0) {
        toast.error('Aucun fichier .obj valide trouvé dans le dossier');
        return;
      }

      const savedModels = await saveModels(parsedModels);
      setImportedModels(prev => [...savedModels, ...prev]);
      
      toast.success(`${savedModels.length} modèle(s) importé(s) avec succès`);
      setSelectedCategory('imported');
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Erreur lors de l'import des fichiers");
    } finally {
      setIsLoading(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const handleDeleteModel = async (id: string) => {
    try {
      await deleteModel(id);
      setImportedModels(prev => prev.filter(m => m.id !== id));
      toast.success('Modèle supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
    setDeleteConfirmId(null);
  };

  const allCategories = {
    ...shapeCategories,
    defaults: { name: 'Modèles inclus', icon: '📦' },
    imported: { name: 'Mes modèles', icon: '📁' },
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📦</span> Bibliothèque d'objets 3D
            </DialogTitle>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un objet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search results mode */}
          {isSearching ? (
            <div className="mt-2">
              <ScrollArea className="h-[420px] pr-4">
                {searchFilteredShapes.length === 0 && searchFilteredModels.length === 0 && searchFilteredDefaults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                    <Search className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">Aucun résultat pour "{searchQuery}"</p>
                  </div>
                ) : (
                  <>
                    {/* Group search results by category */}
                    {Object.entries(allCategories).map(([catKey, { name, icon }]) => {
                      const catShapes = (catKey !== 'imported' && catKey !== 'defaults')
                        ? searchFilteredShapes.filter(s => s.category === catKey)
                        : [];
                      const catModels = catKey === 'imported' ? searchFilteredModels : [];
                      const catDefaults = catKey === 'defaults' ? searchFilteredDefaults : [];
                      if (catShapes.length === 0 && catModels.length === 0 && catDefaults.length === 0) return null;

                      return (
                        <div key={catKey} className="mb-4">
                          <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <span>{icon}</span> {name}
                            <span className="text-[10px] ml-1">({catShapes.length + catModels.length + catDefaults.length})</span>
                          </h3>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {catShapes.map((shape) => (
                              <button
                                key={shape.id}
                                onClick={() => handleSelectShape(shape)}
                                onMouseEnter={() => setHoveredShape(shape.id)}
                                onMouseLeave={() => setHoveredShape(null)}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                  "hover:border-primary hover:bg-accent/50",
                                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                  hoveredShape === shape.id ? "border-primary bg-accent/30" : "border-border"
                                )}
                              >
                                <span className="text-3xl mb-2">{shape.icon}</span>
                                <span className="text-xs text-center font-medium">{shape.name}</span>
                              </button>
                            ))}
                            {catDefaults.map((dm) => (
                              <button
                                key={dm.id}
                                onClick={() => handleSelectDefaultModel(dm)}
                                disabled={loadingDefaultId === dm.id}
                                onMouseEnter={() => setHoveredShape(dm.id)}
                                onMouseLeave={() => setHoveredShape(null)}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                  "hover:border-primary hover:bg-accent/50",
                                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                  hoveredShape === dm.id ? "border-primary bg-accent/30" : "border-border"
                                )}
                              >
                                <span className="text-3xl mb-2">{loadingDefaultId === dm.id ? '⏳' : dm.icon}</span>
                                <span className="text-xs text-center font-medium">{dm.name}</span>
                              </button>
                            ))}
                            {catModels.map((model) => (
                              <button
                                key={model.id}
                                onClick={() => handleSelectOBJModel(model)}
                                onMouseEnter={() => setHoveredShape(model.id)}
                                onMouseLeave={() => setHoveredShape(null)}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                  "hover:border-primary hover:bg-accent/50",
                                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                  hoveredShape === model.id ? "border-primary bg-accent/30" : "border-border"
                                )}
                              >
                                <div className="w-8 h-8 mb-2 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-xs text-center font-medium truncate w-full">{model.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </ScrollArea>
              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  {searchFilteredShapes.length + searchFilteredModels.length + searchFilteredDefaults.length} résultat(s)
                </p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            /* Normal tabs mode */
            <>
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="grid w-full grid-cols-6">
                  {Object.entries(allCategories).map(([key, { name, icon }]) => (
                    <TabsTrigger key={key} value={key} className="text-xs relative">
                      <span className="mr-1">{icon}</span>
                      <span className="hidden sm:inline">{name}</span>
                      {key === 'imported' && importedModels.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                          {importedModels.length}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Built-in categories */}
                {Object.keys(shapeCategories).map((category) => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {shape3DLibrary
                          .filter(shape => shape.category === category)
                          .map((shape) => (
                            <button
                              key={shape.id}
                              onClick={() => handleSelectShape(shape)}
                              onMouseEnter={() => setHoveredShape(shape.id)}
                              onMouseLeave={() => setHoveredShape(null)}
                              className={cn(
                                "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                "hover:border-primary hover:bg-accent/50",
                                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                hoveredShape === shape.id ? "border-primary bg-accent/30" : "border-border"
                              )}
                            >
                              <span className="text-3xl mb-2">{shape.icon}</span>
                              <span className="text-xs text-center font-medium">{shape.name}</span>
                            </button>
                          ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}

                {/* Default models tab */}
                <TabsContent value="defaults" className="mt-4">
                  <ScrollArea className="h-[400px] pr-4">
                    {Object.entries(defaultModelCategories).map(([catKey, { name, icon }]) => {
                      const models = defaultModels.filter(m => m.category === catKey);
                      if (models.length === 0) return null;
                      return (
                        <div key={catKey} className="mb-4">
                          <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <span>{icon}</span> {name}
                          </h3>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {models.map((dm) => (
                              <button
                                key={dm.id}
                                onClick={() => handleSelectDefaultModel(dm)}
                                disabled={loadingDefaultId === dm.id}
                                onMouseEnter={() => setHoveredShape(dm.id)}
                                onMouseLeave={() => setHoveredShape(null)}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                  "hover:border-primary hover:bg-accent/50",
                                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                  hoveredShape === dm.id ? "border-primary bg-accent/30" : "border-border"
                                )}
                              >
                                <span className="text-3xl mb-2">{loadingDefaultId === dm.id ? '⏳' : dm.icon}</span>
                                <span className="text-xs text-center font-medium">{dm.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </TabsContent>

                {/* Imported models tab */}
                <TabsContent value="imported" className="mt-4">
                  <div className="mb-4 flex gap-2">
                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-ignore - webkitdirectory is not in the types but works
                      webkitdirectory="true"
                      directory=""
                      multiple
                      accept=".obj"
                      onChange={handleFolderSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                      Importer un dossier .obj
                    </Button>
                    <input
                      type="file"
                      multiple
                      accept=".obj"
                      onChange={handleFolderSelect}
                      className="hidden"
                      id="single-obj-input"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('single-obj-input')?.click()}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Fichiers individuels
                    </Button>
                  </div>

                  <ScrollArea className="h-[350px] pr-4">
                    {importedModels.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Package className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm">Aucun modèle importé</p>
                        <p className="text-xs mt-1">
                          Importez un dossier contenant des fichiers .obj
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {importedModels.map((model) => (
                          <div
                            key={model.id}
                            className={cn(
                              "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all group",
                              "hover:border-primary hover:bg-accent/50",
                              hoveredShape === model.id ? "border-primary bg-accent/30" : "border-border"
                            )}
                          >
                            <button
                              onClick={() => handleSelectOBJModel(model)}
                              onMouseEnter={() => setHoveredShape(model.id)}
                              onMouseLeave={() => setHoveredShape(null)}
                              className="flex flex-col items-center w-full focus:outline-none"
                            >
                              <div className="w-12 h-12 mb-2 rounded bg-muted flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <span className="text-xs text-center font-medium truncate w-full">
                                {model.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate w-full">
                                {model.fileName}
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(model.id);
                              }}
                              className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  {selectedCategory === 'imported'
                    ? `${importedModels.length} modèle(s) importé(s)`
                    : `${filteredShapes.length} objets disponibles`}
                </p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fermer
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le modèle sera supprimé de votre bibliothèque personnelle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteModel(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
