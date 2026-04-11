import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Box, Layers, Sparkles, Lightbulb, Combine, Radio, Settings } from 'lucide-react';
import { EditorMode } from '@/types/editor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WelcomeDialogProps {
  open: boolean;
  onSelectMode: (mode: EditorMode) => void;
}

interface HexButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  colorClass: string;
}

const HexButton: React.FC<HexButtonProps> = ({ icon, label, sublabel, onClick, disabled, colorClass }) => {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={`group relative w-[100px] h-[115px] flex items-center justify-center transition-all duration-300 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
          >
            {/* Hexagon SVG shape */}
            <svg viewBox="0 0 100 115" className="absolute inset-0 w-full h-full">
              <polygon
                points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75"
                className={`fill-card stroke-border transition-all duration-300 ${!disabled ? `group-hover:${colorClass} group-hover:stroke-transparent` : ''}`}
                strokeWidth="2"
                style={!disabled ? {} : {}}
              />
            </svg>
            {/* Icon */}
            <div className="relative z-10 flex items-center justify-center">
              {icon}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-center">
          <p className="font-semibold">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ open, onSelectMode }) => {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-lg border-2 border-primary/20 bg-gradient-to-b from-card to-background [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center py-6 space-y-4">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Bienvenue sur Flipnote
            </h1>
            <p className="text-muted-foreground text-lg">
              Quel type de projet allons-nous créer ?
            </p>
          </div>

          {/* Honeycomb layout */}
          <div className="flex flex-col items-center -space-y-[29px]">
            {/* Row 1: 2D, 3D */}
            <div className="flex gap-2">
              <HexButton
                icon={<Layers className="w-8 h-8 text-primary" />}
                label="2D"
                sublabel="Formes planes"
                colorClass="fill-primary/20"
                onClick={() => onSelectMode('2d')}
              />
              <HexButton
                icon={<Box className="w-8 h-8 text-accent" />}
                label="3D"
                sublabel="Objets en volume"
                colorClass="fill-accent/20"
                onClick={() => onSelectMode('3d')}
              />
            </div>

            {/* Row 2: Fireworks, Combined, Spotlights */}
            <div className="flex gap-2">
              <HexButton
                icon={<Sparkles className="w-8 h-8 text-destructive" />}
                label="🎆 Pyro"
                sublabel="Feux d'artifice"
                colorClass="fill-destructive/20"
                onClick={() => onSelectMode('fireworks')}
              />
              <HexButton
                icon={<Combine className="w-8 h-8 text-muted-foreground" />}
                label="Combiné"
                sublabel="Bientôt disponible"
                colorClass="fill-muted/20"
                disabled
              />
              <HexButton
                icon={<Lightbulb className="w-8 h-8 text-yellow-500" />}
                label="💡 Spot"
                sublabel="Projecteurs DMX"
                colorClass="fill-yellow-500/20"
                onClick={() => onSelectMode('spotlight')}
              />
            </div>

            {/* Row 3: Drones, Settings */}
            <div className="flex gap-2">
              <HexButton
                icon={<Radio className="w-8 h-8 text-muted-foreground" />}
                label="🚁 Drones"
                sublabel="Bientôt disponible"
                colorClass="fill-muted/20"
                disabled
              />
              <HexButton
                icon={<Settings className="w-8 h-8 text-muted-foreground" />}
                label="⚙️ Paramètres"
                sublabel="Configuration générale"
                colorClass="fill-muted/20"
                disabled
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
