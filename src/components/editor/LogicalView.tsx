import React from 'react';
import { EditorObject3D, SpotlightEditorObject } from '@/types/editor';

interface LogicalViewProps {
  spotlights: SpotlightEditorObject[];
  objects3D: EditorObject3D[];
  selectedObjectIds: string[];
  onSelect: (id: string | null, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  currentTime: number;
  getInterpolatedSpotlightChannels: (spot: SpotlightEditorObject, time: number) => number[];
  getSpotlightColor: (spot: SpotlightEditorObject, channels: number[]) => string;
}

// Window in ms during which a firework "fires" (visual flash)
const FIRE_WINDOW_MS = 600;

export const LogicalView: React.FC<LogicalViewProps> = ({
  spotlights,
  objects3D,
  selectedObjectIds,
  onSelect,
  currentTime,
  getInterpolatedSpotlightChannels,
  getSpotlightColor,
}) => {
  const fireworks = objects3D.filter(o => o.type === 'firework');

  return (
    <div
      className="w-full h-full bg-muted/30 overflow-auto p-6"
      onClick={() => onSelect(null)}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Spotlights section */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            💡 Projecteurs ({spotlights.length})
          </h2>
          {spotlights.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">Aucun projecteur</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {spotlights.map(s => {
                const channels = getInterpolatedSpotlightChannels(s, currentTime);
                const color = getSpotlightColor(s, channels);
                const isSelected = selectedObjectIds.includes(s.id);
                const lastChan = s.dmxAddress + s.fixture.channels.length - 1;
                return (
                  <button
                    key={s.id}
                    onClick={(e) => { e.stopPropagation(); onSelect(s.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }); }}
                    className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                      isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'
                    } bg-card`}
                  >
                    <div
                      className="w-full h-12 rounded-md mb-2 transition-colors"
                      style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
                    />
                    <div className="text-xs font-medium truncate">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.fixture.name}</div>
                    <div className="text-[10px] mt-1 font-mono text-primary">
                      DMX {s.dmxAddress}–{lastChan}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Fireworks section */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            🎆 Feux d'artifice ({fireworks.length})
          </h2>
          {fireworks.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">Aucun feu d'artifice</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fireworks.map(fw => {
                const launchTime = fw.keyframes[0]?.time;
                const isFiring = launchTime !== undefined &&
                  currentTime >= launchTime &&
                  currentTime <= launchTime + FIRE_WINDOW_MS;
                const baseColor = fw.fireworkProduct?.colors[0] || fw.properties.color;
                const isSelected = selectedObjectIds.includes(fw.id);
                return (
                  <button
                    key={fw.id}
                    onClick={(e) => { e.stopPropagation(); onSelect(fw.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }); }}
                    className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                      isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'
                    } bg-card`}
                  >
                    <div
                      className="w-full h-12 rounded-md mb-2 transition-all flex items-center justify-center text-2xl"
                      style={{
                        backgroundColor: isFiring ? baseColor : 'hsl(var(--muted))',
                        boxShadow: isFiring ? `0 0 24px ${baseColor}, 0 0 48px ${baseColor}` : 'none',
                      }}
                    >
                      {isFiring ? '💥' : '🎆'}
                    </div>
                    <div className="text-xs font-medium truncate">{fw.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {fw.fireworkProduct?.manufacturer || ''}
                    </div>
                    <div className="text-[10px] mt-1 font-mono text-primary">
                      DMX {fw.dmxAddress ?? '—'}
                    </div>
                    {launchTime === undefined && (
                      <div className="text-[10px] text-amber-500 mt-0.5">⚠ Pas de keyframe</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};