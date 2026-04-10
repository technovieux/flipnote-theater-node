import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SpotlightFixture, SpotlightChannel } from '@/types/spotlight';
import { Search, Lightbulb } from 'lucide-react';

interface SpotlightLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFixture: (fixture: SpotlightFixture) => void;
}

const CHANNEL_TYPE_COLORS: Record<SpotlightChannel['type'], string> = {
  dimmer: 'bg-yellow-500/20 text-yellow-400',
  color: 'bg-blue-500/20 text-blue-400',
  position: 'bg-green-500/20 text-green-400',
  gobo: 'bg-purple-500/20 text-purple-400',
  other: 'bg-muted text-muted-foreground',
};

export const SpotlightLibraryDialog: React.FC<SpotlightLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSelectFixture,
}) => {
  const [fixtures, setFixtures] = useState<SpotlightFixture[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && fixtures.length === 0) {
      setLoading(true);
      fetch('/data/spotlight_fixtures.json')
        .then(r => r.json())
        .then((data: SpotlightFixture[]) => setFixtures(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, fixtures.length]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return fixtures;
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return fixtures.filter(f => {
      const name = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mfr = f.manufacturer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name.includes(q) || mfr.includes(q);
    });
  }, [fixtures, searchQuery]);

  const handleSelect = (fixture: SpotlightFixture) => {
    onSelectFixture(fixture);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Bibliothèque de projecteurs
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projecteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[400px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Aucun résultat
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((fixture, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => handleSelect(fixture)}
                >
                  <div className="flex flex-col items-start gap-1.5 w-full">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{fixture.name}</span>
                      <span className="text-xs text-muted-foreground">{fixture.manufacturer}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {fixture.channels.length} canaux
                      </Badge>
                      {Array.from(new Set(fixture.channels.map(c => c.type))).map(type => (
                        <Badge key={type} className={`text-xs ${CHANNEL_TYPE_COLORS[type]}`}>
                          {type === 'dimmer' ? '💡 Dimmer' :
                           type === 'color' ? '🎨 Couleur' :
                           type === 'position' ? '🎯 Position' :
                           type === 'gobo' ? '⚙️ Gobo' : '🔧 Autre'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
