import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';
import { getFixtureDefinitions, FixtureDefinition } from '@/lib/fixtureLoader';

interface FixtureLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFixture: (fixture: FixtureDefinition) => void;
}

export const FixtureLibraryDialog: React.FC<FixtureLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSelectFixture,
}) => {
  const [fixtures, setFixtures] = useState<FixtureDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && fixtures.length === 0) {
      setLoading(true);
      getFixtureDefinitions()
        .then(setFixtures)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, fixtures.length]);

  const handleSelect = (fixture: FixtureDefinition) => {
    onSelectFixture(fixture);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Bibliothèque de spots 3D
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Chargement...
            </div>
          ) : fixtures.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Aucun fixture disponible
            </div>
          ) : (
            <div className="space-y-2">
              {fixtures.map((fixture) => (
                <Button
                  key={fixture.id}
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
                        {fixture.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {fixture.parts.length} pièces
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {fixture.channels.length} canaux DMX
                      </Badge>
                      {fixture.parts.filter(p => p.rotatable).map(p => (
                        <Badge key={p.name} className="text-xs bg-green-500/20 text-green-400">
                          🎯 {p.label || p.axis}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fixture.dimensions.width * 100}×{fixture.dimensions.height * 100}×{fixture.dimensions.depth * 100} cm
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
