import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Settings, Package, Layers, Box, Sparkles, Lightbulb,
  Search, Download, Trash2, ArrowLeft, WifiOff, Loader2, ChevronRight
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getAllModels, deleteModel } from '@/lib/objLibraryStorage';
import type { ImportedOBJModel } from '@/lib/objImporter';
import { shape3DLibrary } from '@/data/shape3DLibrary';
import {
  fetchCatalog, installPack, uninstallPack, getInstalledPacks,
  type CatalogEntry, type InstalledPack, type PackMode,
} from '@/lib/packCatalog';
import { toast } from 'sonner';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'general' | 'packages';
type PackageMode = PackMode;
type PackageTab = 'installed' | 'catalog';

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
  const [remoteCatalog, setRemoteCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);

  useEffect(() => {
    if (open && section === 'packages') {
      loadInstalledData();
      setInstalledPacks(getInstalledPacks(selectedMode));
    }
  }, [open, section, selectedMode]);

  useEffect(() => {
    if (open && section === 'packages' && packageTab === 'catalog') {
      let cancelled = false;
      setCatalogLoading(true);
      setCatalogError(null);
      fetchCatalog(selectedMode)
        .then(entries => { if (!cancelled) setRemoteCatalog(entries); })
        .catch((err) => {
          if (!cancelled) {
            setRemoteCatalog([]);
            setCatalogError(err?.message === 'catalog_unreachable'
              ? 'offline'
              : 'offline');
          }
        })
        .finally(() => { if (!cancelled) setCatalogLoading(false); });
      return () => { cancelled = true; };
    }
  }, [open, section, packageTab, selectedMode]);

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

  /** Stable signature used for dedup across packs / built-ins / imports. */
  const signatureOf = (mode: PackageMode, item: any): string => {
    if (mode === 'fireworks') {
      return normalize(String(item?.reference ?? item?.id ?? item?.name ?? ''));
    }
    if (mode === 'spotlight') {
      return normalize(`${item?.manufacturer ?? ''}|${item?.name ?? item?.id ?? ''}`);
    }
    return normalize(String(item?.id ?? item?.name ?? ''));
  };
  const displayNameOf = (mode: PackageMode, item: any): string => {
    if (mode === 'spotlight') return `${item?.name ?? item?.id ?? '—'} (${item?.manufacturer ?? '?'})`;
    return String(item?.name ?? item?.id ?? '—');
  };

  type ItemRow = { sig: string; name: string };
  type Group = {
    key: string;
    title: string;
    kind: 'built-in' | 'imported' | 'pack';
    /** Pack id when kind === 'pack' (used for uninstall). */
    packId?: string;
    items: ItemRow[];
  };

  /** Build ordered groups + apply cross-group dedup (priority: built-in → imported → packs). */
  const groups = useMemo<Group[]>(() => {
    const seen = new Set<string>();
    const consume = (raw: any[], mode: PackageMode): ItemRow[] => {
      const rows: ItemRow[] = [];
      for (const it of raw) {
        const sig = signatureOf(mode, it);
        if (!sig || seen.has(sig)) continue;
        seen.add(sig);
        rows.push({ sig, name: displayNameOf(mode, it) });
      }
      return rows;
    };

    const list: Group[] = [];
    if (selectedMode === '3d') {
      list.push({ key: 'built-in', title: 'Intégrés', kind: 'built-in', items: consume(shape3DLibrary as any[], '3d') });
      list.push({ key: 'imported', title: 'Importés (.obj)', kind: 'imported', items: consume(objModels as any[], '3d') });
    } else if (selectedMode === 'spotlight') {
      list.push({ key: 'built-in', title: 'Intégrés', kind: 'built-in', items: consume(spotlightFixtures, 'spotlight') });
    } else if (selectedMode === 'fireworks') {
      list.push({ key: 'built-in', title: 'Intégrés', kind: 'built-in', items: consume(fireworkProducts, 'fireworks') });
    }
    for (const pack of installedPacks) {
      const payload = Array.isArray(pack.payload) ? pack.payload as any[] : [];
      list.push({
        key: `pack:${pack.id}`,
        title: pack.name,
        kind: 'pack',
        packId: pack.id,
        items: consume(payload, selectedMode),
      });
    }
    return list;
  }, [selectedMode, objModels, spotlightFixtures, fireworkProducts, installedPacks]);

  const filteredGroups = useMemo<Group[]>(() => {
    const q = normalize(searchQuery);
    if (!q) return groups;
    return groups
      .map(g => ({ ...g, items: g.items.filter(i => normalize(i.name).includes(q)) }))
      .filter(g => g.items.length > 0 || normalize(g.title).includes(q));
  }, [groups, searchQuery]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setOpenGroups(p => ({ ...p, [key]: !p[key] }));

  const [catalogKindFilter, setCatalogKindFilter] = useState<{ pack: boolean; single: boolean }>({ pack: true, single: true });

  const catalogItems = useMemo(() => {
    const q = normalize(searchQuery);
    const installedIds = new Set(installedPacks.map(p => p.id));
    const withState = remoteCatalog.map(e => ({
      ...e,
      description: e.description ?? '',
      author: e.author ?? '',
      installed: installedIds.has(e.id),
    }));
    const kindFiltered = withState.filter(i =>
      (catalogKindFilter.pack && i.kind === 'pack') || (catalogKindFilter.single && i.kind === 'single')
    );
    return q ? kindFiltered.filter(i => normalize(i.name).includes(q) || normalize(i.description).includes(q)) : kindFiltered;
  }, [searchQuery, remoteCatalog, installedPacks, catalogKindFilter]);

  const handleInstallCatalog = async (entry: CatalogEntry) => {
    setInstallingId(entry.id);
    try {
      await installPack(selectedMode, entry);
      setInstalledPacks(getInstalledPacks(selectedMode));
      toast.success(`${entry.name} installé`);
    } catch (err: any) {
      toast.error(`Échec de l'installation : ${err?.message ?? 'erreur réseau'}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstallPack = (id: string) => {
    uninstallPack(selectedMode, id);
    setInstalledPacks(getInstalledPacks(selectedMode));
    toast.success('Pack désinstallé');
  };

  const handleDeleteOBJ = async (id: string) => {
    await deleteModel(id);
    setObjModels(prev => prev.filter(m => m.id !== id));
  };

  /** Delete an individual item inside an "Importés" group (3D OBJ only). */
  const handleDeleteImported = async (sig: string) => {
    const target = objModels.find(m => normalize(m.id) === sig || normalize(m.name) === sig);
    if (target) await handleDeleteOBJ(target.id);
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
                        {filteredGroups.length === 0 || filteredGroups.every(g => g.items.length === 0) ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            {selectedMode === '2d' ? 'Aucun paquet disponible pour le mode 2D' : 'Aucun élément installé'}
                          </p>
                        ) : (
                          <div className="space-y-2">
                             {filteredGroups.map(group => {
                               // Packs are open by default so their items are immediately visible.
                               const defaultOpen = group.kind === 'pack' || !!searchQuery;
                               const isOpen = openGroups[group.key] ?? defaultOpen;
                              return (
                                <Collapsible
                                  key={group.key}
                                  open={isOpen}
                                  onOpenChange={() => toggleGroup(group.key)}
                                  className="border rounded-md bg-card/40"
                                >
                                  <div className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/40 rounded-t-md">
                                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                      <span className="text-sm font-medium">{group.title}</span>
                                      <Badge variant="outline" className="text-[10px] h-4">
                                        {group.kind === 'built-in' ? 'Intégré' : group.kind === 'imported' ? 'Importé' : 'Pack'}
                                      </Badge>
                                      <span className="text-[10px] text-muted-foreground ml-1">{group.items.length}</span>
                                    </CollapsibleTrigger>
                                    {group.kind === 'pack' && group.packId && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleUninstallPack(group.packId!)}
                                        title="Désinstaller ce pack"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                  <CollapsibleContent>
                                    <div className="px-2 pb-2 pt-1 space-y-0.5">
                                      {group.items.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-2 py-1">Aucun élément</p>
                                      ) : group.items.map(item => (
                                        <div key={item.sig} className="flex items-center justify-between pl-6 pr-2 py-1 rounded hover:bg-muted/30 group">
                                          <span className="text-xs">{item.name}</span>
                                          {group.kind === 'imported' && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                              onClick={() => handleDeleteImported(item.sig)}
                                              title="Supprimer"
                                            >
                                              <Trash2 className="w-3 h-3 text-destructive" />
                                            </Button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="catalog" className="flex-1 m-0 overflow-hidden">
                      <div className="flex items-center gap-4 px-3 pt-2 pb-1">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={catalogKindFilter.pack}
                            onCheckedChange={(v) => setCatalogKindFilter(p => ({ ...p, pack: !!v }))}
                            className="h-3.5 w-3.5"
                          />
                          Packs
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={catalogKindFilter.single}
                            onCheckedChange={(v) => setCatalogKindFilter(p => ({ ...p, single: !!v }))}
                            className="h-3.5 w-3.5"
                          />
                          Objets seuls
                        </label>
                      </div>
                      <ScrollArea className="h-full p-3 pt-1">
                        {catalogLoading ? (
                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Chargement du catalogue...
                          </div>
                        ) : catalogError || catalogItems.length === 0 ? (
                          <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <WifiOff className="w-5 h-5" />
                            <p>Pas de connexion ou pas de packs disponibles</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {catalogItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-md border bg-card">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <Badge variant="outline" className="text-[10px] h-4">
                                      {item.kind === 'pack' ? 'Pack' : 'Seul'}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">par {item.author}</p>
                                </div>
                                {item.installed ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 shrink-0 ml-3"
                                    onClick={() => handleUninstallPack(item.id)}
                                    title="Désinstaller"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Désinstaller
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 shrink-0 ml-3"
                                    disabled={installingId === item.id}
                                    onClick={() => handleInstallCatalog(item)}
                                  >
                                    {installingId === item.id ? (
                                      <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Installation…</>
                                    ) : (
                                      <><Download className="w-3.5 h-3.5 mr-1" /> Installer</>
                                    )}
                                  </Button>
                                )}
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
