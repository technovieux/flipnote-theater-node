import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Search, SlidersHorizontal } from 'lucide-react';
import { FireworkProduct, FireworkCategory, FireworkSortBy } from '@/types/fireworks';

interface FireworkLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFirework: (product: FireworkProduct, category: FireworkCategory) => void;
}

const CATEGORY_LABELS: Record<FireworkCategory, string> = {
  consumer: '🎆 Particuliers',
  professional: '🎇 Professionnel',
  european: '🇪🇺 Européen',
};

const CATEGORY_FILES: Record<FireworkCategory, string> = {
  consumer: '/data/consumer_fireworks.json',
  professional: '/data/professionnal_fireworks.json',
  european: '/data/european_fireworks.json',
};

const TYPE_LABELS: Record<string, string> = {
  shell: 'Bombe',
  battery: 'Batterie',
  roman_candle: 'Chandelle romaine',
  fountain: 'Fontaine',
  mine: 'Mine',
  cake: 'Compact',
  rocket: 'Fusée',
  sparkler: 'Cierge magique',
  firecracker: 'Pétard',
  crossette: 'Crossette',
  comet: 'Comète',
  waterfall: 'Cascade',
  wheel: 'Roue',
};

export const FireworkLibraryDialog: React.FC<FireworkLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSelectFirework,
}) => {
  const [activeCategory, setActiveCategory] = useState<FireworkCategory>('consumer');
  const [products, setProducts] = useState<Record<FireworkCategory, FireworkProduct[]>>({
    consumer: [],
    professional: [],
    european: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<FireworkSortBy>('name');
  const [loading, setLoading] = useState(false);

  // Load products for a category
  useEffect(() => {
    if (!open) return;
    
    const loadCategory = async (cat: FireworkCategory) => {
      if (products[cat].length > 0) return; // already loaded
      setLoading(true);
      try {
        const res = await fetch(CATEGORY_FILES[cat]);
        const data: FireworkProduct[] = await res.json();
        setProducts(prev => ({ ...prev, [cat]: data }));
      } catch (err) {
        console.error(`Failed to load ${cat} fireworks:`, err);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategory(activeCategory);
  }, [open, activeCategory]);

  const normalizeSearch = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredAndSorted = useMemo(() => {
    let items = products[activeCategory] || [];
    
    if (searchQuery.trim()) {
      const q = normalizeSearch(searchQuery);
      items = items.filter(p =>
        normalizeSearch(p.name).includes(q) ||
        normalizeSearch(p.manufacturer).includes(q) ||
        normalizeSearch(TYPE_LABELS[p.type] || p.type).includes(q)
      );
    }
    
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'manufacturer': return a.manufacturer.localeCompare(b.manufacturer);
        case 'type': return a.type.localeCompare(b.type);
        default: return 0;
      }
    });
  }, [products, activeCategory, searchQuery, sortBy]);

  // Group items by sort field
  const grouped = useMemo(() => {
    const groups: Record<string, FireworkProduct[]> = {};
    for (const item of filteredAndSorted) {
      let key: string;
      switch (sortBy) {
        case 'manufacturer': key = item.manufacturer; break;
        case 'type': key = TYPE_LABELS[item.type] || item.type; break;
        default: key = item.name[0]?.toUpperCase() || '?'; break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredAndSorted, sortBy]);

  const handleSelect = (product: FireworkProduct) => {
    onSelectFirework(product, activeCategory);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-destructive" />
            Bibliothèque de feux d'artifice
          </DialogTitle>
        </DialogHeader>

        {/* Category tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as FireworkCategory)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="consumer">{CATEGORY_LABELS.consumer}</TabsTrigger>
            <TabsTrigger value="professional">{CATEGORY_LABELS.professional}</TabsTrigger>
            <TabsTrigger value="european">{CATEGORY_LABELS.european}</TabsTrigger>
          </TabsList>

          {/* Search + Sort bar */}
          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un feu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as FireworkSortBy)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Par nom</SelectItem>
                  <SelectItem value="manufacturer">Par fabricant</SelectItem>
                  <SelectItem value="type">Par type</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(['consumer', 'professional', 'european'] as FireworkCategory[]).map(cat => (
            <TabsContent key={cat} value={cat} className="mt-2">
              <ScrollArea className="h-[400px] pr-3">
                {loading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Chargement...
                  </div>
                ) : Object.keys(grouped).length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Aucun résultat
                  </div>
                ) : (
                  Object.entries(grouped).map(([groupName, items]) => (
                    <div key={groupName} className="mb-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-popover py-1">
                        {groupName}
                      </h3>
                      <div className="space-y-1">
                        {items.map(product => (
                          <Button
                            key={product.id}
                            variant="ghost"
                            className="w-full justify-start h-auto py-2.5 px-3 hover:bg-accent/10"
                            onClick={() => handleSelect(product)}
                          >
                            <div className="flex items-center gap-3 w-full">
                              {/* Color preview */}
                              <div className="flex -space-x-1">
                                {product.effects[0]?.colors.slice(0, 3).map((color, i) => (
                                  <div
                                    key={i}
                                    className="w-4 h-4 rounded-full border border-background"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              {/* Info */}
                              <div className="flex-1 text-left min-w-0">
                                <div className="font-medium text-sm truncate">{product.name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {product.manufacturer} · {product.caliber}mm · {product.shotCount} tir{product.shotCount > 1 ? 's' : ''}
                                </div>
                              </div>
                              {/* Type badge */}
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {TYPE_LABELS[product.type] || product.type}
                              </Badge>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
