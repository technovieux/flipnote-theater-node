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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Search, SlidersHorizontal } from 'lucide-react';
import { SpotlightProduct, SpotlightCategory, SpotlightSortBy } from '@/types/spotlights';

interface SpotlightLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSpotlight: (product: SpotlightProduct, category: SpotlightCategory, address: string) => void;
}

const CATEGORY_LABELS: Record<SpotlightCategory, string> = {
  'entry-level': '💡 Basique',
  professional: '✨ Professionnel',
};

const CATEGORY_FILES: Record<SpotlightCategory, string> = {
  'entry-level': '/data/spotlights_library.json',
  professional: '/data/spotlights_library.json',
};

export const SpotlightLibraryDialog: React.FC<SpotlightLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSelectSpotlight,
}) => {
  const [activeCategory, setActiveCategory] = useState<SpotlightCategory>('entry-level');
  const [products, setProducts] = useState<Record<SpotlightCategory, SpotlightProduct[]>>({
    'entry-level': [],
    professional: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SpotlightSortBy>('name');
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SpotlightProduct | null>(null);
  const [dmxAddress, setDmxAddress] = useState('1');

  useEffect(() => {
    if (!open) return;
    
    const loadProducts = async () => {
      if (products['entry-level'].length > 0) return;
      setLoading(true);
      try {
        const res = await fetch('/data/spotlights_library.json');
        const allData: SpotlightProduct[] = await res.json();
        
        // Filter by category
        const entryLevel = allData.filter(p => p.category === 'Entry-Level');
        const professional = allData.filter(p => p.category === 'Professional');
        
        setProducts({
          'entry-level': entryLevel,
          professional: professional,
        });
      } catch (err) {
        console.error('Failed to load spotlights:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadProducts();
  }, [open]);

  const normalizeSearch = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredAndSorted = useMemo(() => {
    let items = products[activeCategory] || [];
    
    if (searchQuery.trim()) {
      const q = normalizeSearch(searchQuery);
      items = items.filter(p =>
        normalizeSearch(p.name).includes(q) ||
        normalizeSearch(p.manufacturer).includes(q) ||
        normalizeSearch(p.beamType).includes(q) ||
        normalizeSearch(p.reference).includes(q)
      );
    }
    
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'manufacturer': return a.manufacturer.localeCompare(b.manufacturer);
        case 'power': return parseInt(a.power) - parseInt(b.power);
        default: return 0;
      }
    });
  }, [products, activeCategory, searchQuery, sortBy]);

  const grouped = useMemo((): Record<string, SpotlightProduct[]> => {
    const groups: Record<string, SpotlightProduct[]> = {};
    for (const item of filteredAndSorted) {
      let key: string;
      switch (sortBy) {
        case 'manufacturer': key = item.manufacturer; break;
        case 'power': key = `${item.power}W`; break;
        default: key = item.name[0]?.toUpperCase() || '?'; break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredAndSorted, sortBy]);

  const handleSelect = (product: SpotlightProduct) => {
    setSelectedProduct(product);
  };

  const handleConfirm = () => {
    if (selectedProduct) {
      const address = `DMX:${dmxAddress}`;
      onSelectSpotlight(selectedProduct, activeCategory, address);
      onOpenChange(false);
      setSelectedProduct(null);
      setDmxAddress('1');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Bibliothèque de projecteurs
          </DialogTitle>
        </DialogHeader>

        {!selectedProduct ? (
          <>
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as SpotlightCategory)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entry-level">{CATEGORY_LABELS['entry-level']}</TabsTrigger>
                <TabsTrigger value="professional">{CATEGORY_LABELS.professional}</TabsTrigger>
              </TabsList>

              <div className="flex gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un projecteur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SpotlightSortBy)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Par nom</SelectItem>
                      <SelectItem value="manufacturer">Par fabricant</SelectItem>
                      <SelectItem value="power">Par puissance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(['entry-level', 'professional'] as SpotlightCategory[]).map(cat => (
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
                      Object.entries(grouped).map(([groupName, items]: [string, SpotlightProduct[]]) => (
                        <div key={groupName} className="mb-4">
                          <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-popover py-1">
                            {groupName}
                          </h3>
                          <div className="space-y-1">
                            {items.map(product => (
                              <Button
                                key={product.reference}
                                variant="ghost"
                                className="w-full justify-start h-auto py-2.5 px-3 hover:bg-accent/10"
                                onClick={() => handleSelect(product)}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="flex -space-x-1">
                                    {product.colors.slice(0, 3).map((color, i) => (
                                      <div
                                        key={i}
                                        className="w-4 h-4 rounded-full border border-background"
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-sm truncate">{product.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {product.manufacturer} · {product.power} · {product.beamAngle}° · {product.beamType}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {product.intensity}%
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
          </>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-start gap-4">
                <div className="flex -space-x-2">
                  {selectedProduct.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-background"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProduct.manufacturer}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge>{selectedProduct.power}</Badge>
                    <Badge variant="outline">{selectedProduct.beamAngle}°</Badge>
                    <Badge variant="outline">{selectedProduct.beamType}</Badge>
                    <Badge variant="outline">Distance: {selectedProduct.focusDistance}m</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse DMX</label>
              <Input
                type="number"
                min="1"
                max="512"
                value={dmxAddress}
                onChange={(e) => setDmxAddress(e.target.value)}
                placeholder="1-512"
              />
              <p className="text-xs text-muted-foreground">
                L'adresse DMX détermine le canal de contrôle du projecteur
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedProduct(null)}>
                Retour
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                Ajouter le projecteur
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
