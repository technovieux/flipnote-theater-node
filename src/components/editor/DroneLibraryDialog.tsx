import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Plane, Battery, Gauge, Weight } from 'lucide-react';
import { DroneProduct } from '@/types/drone';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DroneLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: DroneProduct) => void;
}

export const DroneLibraryDialog: React.FC<DroneLibraryDialogProps> = ({ open, onOpenChange, onSelect }) => {
  const [library, setLibrary] = useState<DroneProduct[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open && library.length === 0) {
      fetch('/data/drones.json').then(r => r.json()).then(setLibrary).catch(console.error);
    }
  }, [open, library.length]);

  const filtered = useMemo(() => library.filter(d =>
    !search || `${d.name} ${d.manufacturer}`.toLowerCase().includes(search.toLowerCase())
  ), [library, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" /> Bibliothèque de drones
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un drone…"
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-[480px] pr-2">
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(d => (
              <button
                key={d.id}
                onClick={() => { onSelect(d); onOpenChange(false); }}
                className="text-left rounded-lg border border-border bg-card hover:border-primary hover:bg-accent transition p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.manufacturer}</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono shrink-0">
                    {d.ledColor}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{d.description}</p>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border">
                  <div className="flex items-center gap-1"><Weight className="h-3 w-3" /> {d.weight} g</div>
                  <div className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {d.maxSpeed} m/s</div>
                  <div className="flex items-center gap-1"><Battery className="h-3 w-3" /> {d.flightTime} min</div>
                  <div className="flex items-center gap-1">Ø {d.diameter} mm</div>
                </div>
              </button>
            ))}
            {library.length === 0 && (
              <div className="col-span-2 text-sm text-muted-foreground italic text-center py-8">
                Chargement…
              </div>
            )}
            {library.length > 0 && filtered.length === 0 && (
              <div className="col-span-2 text-sm text-muted-foreground italic text-center py-8">
                Aucun drone ne correspond.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};