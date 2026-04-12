import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Settings, Package, Layers, Box, Sparkles, Lightbulb,
  Search, Download, Trash2, ArrowLeft, Check
} from 'lucide-react';
import { getAllModels, deleteModel, type ImportedOBJModel } from '@/lib/objLibraryStorage';
import { shape3DLibrary } from '@/data/shape3DLibrary';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'general' | 'packages';
type PackageMode = '2d' | '3d' | 'fireworks' | 'spotlight';
type PackageTab = 'installed' | 'catalog';

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  author: string;
  installed: boolean;
}

// Mock catalog data
const mockCatalog: Record<PackageMode, CatalogItem[]> = {
  '2d': [
    { id: 'c2d-1', name: 'Pack Formes Avancées', description: 'Polygones complexes et courbes', author: 'Flipnote Team', installed: false },
    { id: 'c2d-2', name: 'Pack Textures', description: 'Textures et motifs pour formes 2D', author: 'Community', installed: false },
  ],
  '3d': [
    { id: 'c3d-1', name: 'Pack Véhicules', description: 'Voitures, avions, bateaux détaillés', author: 'Flipnote Team', installed: false },
    { id: 'c3d-2', name: 'Pack Nature', description: 'Arbres, rochers, plantes réalistes', author: 'Community', installed: false },
    { id: 'c3d-3', name: 'Pack Architecture', description: 'Bâtiments et structures modernes', author: 'Flipnote Team', installed: false },
  ],
  fireworks: [
    { id: 'cfw-1', name: 'Pack Asiatique', description: 'Effets pyrotechniques traditionnels asiatiques', author: 'Flipnote Team', installed: false },
    { id: 'cfw-2', name: 'Pack Festival', description: 'Compositions pour grands festivals', author: 'Community', installed: false },
  ],
  spotlight: [
    { id: 'csp-1', name: 'Pack LED Bars', description: 'Barres LED et wash linéaires', author: 'Flipnote Team', installed: false },
    { id: 'csp-2', name: 'Pack Moving Heads Pro', description: 'Lyres asservies professionnelles', author: 'Community', installed: false },
  ],
};

const modeConfig: { key: PackageMode; label: string; icon: React.ReactNode }[] = [
  { key: '2d', label: '2D', icon: <Layers className="w-4 h-4" /> },
  { key: '3d', label: '3D', icon: <Box className="w-4 h-4" /> },
  { key: 'fireworks', label: 'Pyro', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'spotlight', label: 'Spots', icon: <Lightbulb className="w-4 h-4" /> },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
  const [section, setSection] = useState<SettingsSection>('general');
  const [selectedMode, setSelectedMode] = useState<PackageMode>('3d');
  const [packageTab, setPackageTab] = useState<PackageTab>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [objModels, setObjModels] = useState<ImportedOBJModel[]>([]);
  const [spotlightFixtures, setSpotlightFixtures] = useState<any[]>([]);
  const [fireworkProducts, setFireworkProducts] = useState<any[]>([]);
  const [installedCatalog, setInstalledCatalog] = useState<string[]>([]);

  useEffect(() => {
    if (open && section === 'packages') {
      loadInstalledData();
    }
  }, [open, section, selectedMode]);

  const loadInstalledData = async () => {
    try {
      const models = await getAllModels();
      setObjModels(models);
    } catch { /* empty */ }

    try {
      const res = await fetch('/data/spotlight_fixtures.json');
      const data = await res.json();
      setSpotlightFixtures(data);
    } catch { /* empty */ }

    try {
      const [c, p, e] = await Promise.all([
        fetch('/data/consumer_fireworks.json').then(r => r.json()),
        fetch('/data/professionnal_fireworks.json').then(r => r.json()),
        fetch('/data/european_fireworks.json').then(r => r.json()),
      ]);
      setFireworkProducts([...c, ...p, ...e]);
    } catch { /* empty */ }
  };

  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const installedItems = useMemo(() => {
    const q = normalize(searchQuery);
    if (selectedMode === '3d') {
      const builtIn = shape3DLibrary.map(s => ({ id: s.id, name: s.name, type: 'built-in' as const }));
      const imported = objModels.map(m => ({ id: m.id, name: m.name, type: 'imported' as const }));
      const all = [...builtIn, ...imported];
      return q ? all.filter(i => normalize(i.name).includes(q)) : all;
    }
    if (selectedMode === 'spotlight') {
      const items = spotlightFixtures.map((f: any) => ({ id: f.name, name: `${f.name} (${f.manufacturer})`, type: 'built-in' as const }));
      return q ? items.filter(i => normalize(i.name).includes(q)) : items;
    }
    if (selectedMode === 'fireworks') {
      const items = fireworkProducts.map((f: any) => ({ id: f.reference || f.name, name: f.name, type: 'built-in' as const }));
      return q ? items.filter(i => normalize(i.name).includes(q)) : items;
    }
    // 2D has no installable packages yet
    return [];
  }, [selectedMode, objModels, spotlightFixtures, fireworkProducts, searchQuery]);

  const catalogItems = useMemo(() => {
    const q = normalize(searchQuery);
    const items = mockCatalog[selectedMode] || [];
    const withState = items.map(i => ({ ...i, installed: installedCatalog.includes(i.id) }));
    return q ? withState.filter(i => normalize(i.name).includes(q) || normalize(i.description).includes(q)) : withState;
  }, [selectedMode, searchQuery, installedCatalog]);

  const handleInstallCatalog = (id: string) => {
    setInstalledCatalog(prev => [...prev, id]);
  };

  const handleDeleteOBJ = async (id: string) => {
    await deleteModel(id);
    setObjModels(prev => prev.filter(m => m.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[500px] p-0 gap-0 overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-3 flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start mb-2 text-muted-foreground"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>

            <Button
              variant={section === 'general' ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start"
              onClick={() => setSection('general')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Paramètres généraux
            </Button>
            <Button
              variant={section === 'packages' ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start"
              onClick={() => setSection('packages')}
            >
              <Package className="w-4 h-4 mr-2" />
              Gestionnaire de paquets
            </Button>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {section === 'general' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Paramètres généraux</h2>
                <p className="text-muted-foreground text-sm">
                  Les paramètres généraux seront disponibles prochainement.
                </p>
              </div>
            )}

            {section === 'packages' && (
              <div className="flex h-full overflow-hidden">
                {/* Mode sidebar */}
                <div className="w-32 border-r bg-muted/20 p-2 flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase">Modes</p>
                  {modeConfig.map(m => (
                    <Button
                      key={m.key}
                      variant={selectedMode === m.key ? 'secondary' : 'ghost'}
                      size="sm"
                      className="justify-start text-xs"
                      onClick={() => { setSelectedMode(m.key); setSearchQuery(''); }}
                    >
                      {m.icon}
                      <span className="ml-2">{m.label}</span>
                    </Button>
                  ))}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Tabs value={packageTab} onValueChange={(v) => setPackageTab(v as PackageTab)} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 p-3 border-b">
                      <TabsList className="h-8">
                        <TabsTrigger value="installed" className="text-xs">Installés</TabsTrigger>
                        <TabsTrigger value="catalog" className="text-xs">Catalogue</TabsTrigger>
                      </TabsList>
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Rechercher..."
                          className="h-8 pl-7 text-xs"
                        />
                      </div>
                    </div>

                    <TabsContent value="installed" className="flex-1 m-0 overflow-hidden">
                      <ScrollArea className="h-full p-3">
                        {installedItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            {selectedMode === '2d' ? 'Aucun paquet disponible pour le mode 2D' : 'Aucun élément installé'}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {installedItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 group">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{item.name}</span>
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {item.type === 'built-in' ? 'Intégré' : 'Importé'}
                                  </Badge>
                                </div>
                                {item.type === 'imported' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={() => handleDeleteOBJ(item.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="catalog" className="flex-1 m-0 overflow-hidden">
                      <ScrollArea className="h-full p-3">
                        {catalogItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Aucun paquet trouvé
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {catalogItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-md border bg-card">
                                <div>
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">par {item.author}</p>
                                </div>
                                <Button
                                  variant={item.installed ? 'ghost' : 'outline'}
                                  size="sm"
                                  className="text-xs h-7 shrink-0 ml-3"
                                  disabled={item.installed}
                                  onClick={() => handleInstallCatalog(item.id)}
                                >
                                  {item.installed ? (
                                    <><Check className="w-3.5 h-3.5 mr-1" /> Installé</>
                                  ) : (
                                    <><Download className="w-3.5 h-3.5 mr-1" /> Installer</>
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
