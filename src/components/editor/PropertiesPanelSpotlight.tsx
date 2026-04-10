import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { SpotlightChannel } from '@/types/spotlight';

export interface SpotlightObjectData {
  id: string;
  name: string;
  fixtureName: string;
  dmxAddress: number;
  channels: SpotlightChannel[];
  channelValues: number[];
  x: number;
  y: number;
}

interface PropertiesPanelSpotlightProps {
  selectedSpotlights: SpotlightObjectData[];
  onUpdateDmxAddress: (id: string, address: number) => void;
  onUpdateChannelValue: (id: string, channelIndex: number, value: number) => void;
  onAddKeyframe: () => void;
}

const CHANNEL_TYPE_ICONS: Record<SpotlightChannel['type'], string> = {
  dimmer: '💡',
  color: '🎨',
  position: '🎯',
  gobo: '⚙️',
  other: '🔧',
};

export const PropertiesPanelSpotlight: React.FC<PropertiesPanelSpotlightProps> = ({
  selectedSpotlights,
  onUpdateDmxAddress,
  onUpdateChannelValue,
  onAddKeyframe,
}) => {
  if (selectedSpotlights.length === 0) {
    return (
      <div className="h-full bg-card border border-panel-border rounded-sm p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Sélectionnez un projecteur pour modifier ses propriétés
        </p>
      </div>
    );
  }

  const spot = selectedSpotlights[0];
  const isMulti = selectedSpotlights.length > 1;

  return (
    <div className="h-full bg-card border border-panel-border rounded-sm flex flex-col overflow-hidden">
      <div className="p-3 border-b border-panel-border bg-muted/30 flex items-center justify-between">
        <span className="text-sm font-medium truncate">
          {isMulti ? `${selectedSpotlights.length} projecteurs` : spot.name}
        </span>
        <span className="text-xs text-muted-foreground">{spot.fixtureName}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* DMX Address */}
        <div className="space-y-1.5">
          <Label className="text-xs">Adresse DMX</Label>
          <Input
            type="number"
            min={1}
            max={512}
            value={spot.dmxAddress}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              onUpdateDmxAddress(spot.id, Math.max(1, Math.min(512, val)));
            }}
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Canaux {spot.dmxAddress} - {spot.dmxAddress + spot.channels.length - 1}
          </p>
        </div>

        {/* Channel Sliders */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Canaux</Label>
          {spot.channels.map((channel, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {CHANNEL_TYPE_ICONS[channel.type]} {channel.name}
                </span>
                <span className="text-xs font-mono w-8 text-right">
                  {spot.channelValues[idx] ?? 0}
                </span>
              </div>
              <Slider
                min={0}
                max={255}
                step={1}
                value={[spot.channelValues[idx] ?? 0]}
                onValueChange={([val]) => onUpdateChannelValue(spot.id, idx, val)}
              />
            </div>
          ))}
        </div>

        {/* Add Keyframe */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddKeyframe}
        >
          + Ajouter Keyframe
        </Button>
      </div>
    </div>
  );
};
