import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Box, Layers, Sparkles, Lightbulb } from 'lucide-react';
import { EditorMode } from '@/types/editor';

interface WelcomeDialogProps {
  open: boolean;
  onSelectMode: (mode: EditorMode) => void;
}

export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ open, onSelectMode }) => {
  return (
    <Dialog open={open}>
      <DialogContent 
        className="sm:max-w-2xl border-2 border-primary/20 bg-gradient-to-b from-card to-background [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center py-6 space-y-8">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Bienvenue sur Flipnote
            </h1>
            <p className="text-muted-foreground text-lg">
              Quel type de projet allons-nous créer ?
            </p>
          </div>

          {/* Mode Selection Buttons */}
          <div className="flex gap-6 w-full justify-center flex-wrap">
            {/* 2D Button */}
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center w-40 h-44 gap-3 hover:border-primary hover:bg-primary/5 transition-all duration-300 group"
              onClick={() => onSelectMode('2d')}
            >
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
                <Layers className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">2D</div>
                <div className="text-xs text-muted-foreground">Formes planes</div>
              </div>
            </Button>

            {/* 3D Button */}
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center w-40 h-44 gap-3 hover:border-accent hover:bg-accent/5 transition-all duration-300 group"
              onClick={() => onSelectMode('3d')}
            >
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center group-hover:from-accent/30 group-hover:to-accent/10 transition-all duration-300">
                <Box className="w-10 h-10 text-accent" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">3D</div>
                <div className="text-xs text-muted-foreground">Objets en volume</div>
              </div>
            </Button>

            {/* Fireworks Button */}
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center w-40 h-44 gap-3 hover:border-destructive hover:bg-destructive/5 transition-all duration-300 group"
              onClick={() => onSelectMode('fireworks')}
            >
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center group-hover:from-destructive/30 group-hover:to-destructive/10 transition-all duration-300">
                <Sparkles className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">🎆 Pyro</div>
                <div className="text-xs text-muted-foreground">Feux d'artifice</div>
              </div>
            </Button>

            {/* Spotlights Button */}
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center w-40 h-44 gap-3 hover:border-yellow-500 hover:bg-yellow-500/5 transition-all duration-300 group"
              onClick={() => onSelectMode('spotlights')}
            >
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 flex items-center justify-center group-hover:from-yellow-500/30 group-hover:to-yellow-500/10 transition-all duration-300">
                <Lightbulb className="w-10 h-10 text-yellow-500" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">💡 Spots</div>
                <div className="text-xs text-muted-foreground">Projecteurs lumineux</div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
