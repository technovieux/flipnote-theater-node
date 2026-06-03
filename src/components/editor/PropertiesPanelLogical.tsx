import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { EditorObject3D } from '@/types/editor';

interface PropertiesPanelLogicalProps {
  selectedObjects: EditorObject3D[];
  onUpdateDmxAddress: (id: string, address: number) => void;
  onUpdateColor: (id: string, color: string) => void;
  /** Drone mode — edit the time at which a shape's drones converge. */
  onUpdateShapeTime?: (id: string, time: number) => void;
}

export const PropertiesPanelLogical: React.FC<PropertiesPanelLogicalProps> = ({
  selectedObjects,
  onUpdateDmxAddress,
  onUpdateColor,
  onUpdateShapeTime,
}) => {
  if (selectedObjects.length === 0) {
    return (
      <div className="h-full bg-card border border-panel-border rounded-sm p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Sélectionnez un appareil dans la vue logique
        </p>
      </div>
    );
  }

  const obj = selectedObjects[0];
  const isFirework = obj.type === 'firework';
  const isSpotlight = obj.type === 'spotlight_lyre';
  const isDrone = obj.type === 'drone';
  const hasAnchors = !!(obj.anchors && obj.anchors.length > 0);

  // Drone properties (drone mode)
  if (isDrone) {
    return (
      <div className="h-full bg-card border border-panel-border rounded-sm flex flex-col overflow-hidden">
        <div className="p-3 border-b border-panel-border bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium truncate">{obj.name}</span>
          <span className="text-xs text-muted-foreground">Drone</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Modèle</Label>
            <div className="text-sm">{obj.droneProduct?.name ?? '—'}</div>
            <div className="text-[11px] text-muted-foreground">
              {obj.droneProduct?.manufacturer} · vitesse max {obj.droneProduct?.maxSpeed} m/s · LED {obj.droneProduct?.ledColor}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Adresse DMX</Label>
            <Input
              type="number" min={1} max={512}
              value={obj.dmxAddress ?? 1}
              onChange={(e) => onUpdateDmxAddress(obj.id, parseInt(e.target.value) || 1)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Couleur LED</Label>
            <div className="flex items-center gap-2">
              <input
                type="color" value={obj.properties.color}
                onChange={(e) => onUpdateColor(obj.id, e.target.value)}
                className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={obj.properties.color}
                onChange={(e) => onUpdateColor(obj.id, e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Anchor-shape properties (drone mode)
  if (hasAnchors && onUpdateShapeTime) {
    return (
      <div className="h-full bg-card border border-panel-border rounded-sm flex flex-col overflow-hidden">
        <div className="p-3 border-b border-panel-border bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium truncate">{obj.name}</span>
          <span className="text-xs text-muted-foreground">Forme</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Ancrages</Label>
            <div className="text-sm font-mono">{obj.anchors!.length}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Instant de la forme (secondes)</Label>
            <Input
              type="number" min={0} step={0.1}
              value={((obj.shapeTime ?? 0) / 1000).toFixed(2)}
              onChange={(e) => onUpdateShapeTime(obj.id, Math.round((parseFloat(e.target.value) || 0) * 1000))}
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Moment où les drones assignés doivent occuper leurs ancrages.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isFirework && !isSpotlight) {
    return (
      <div className="h-full bg-card border border-panel-border rounded-sm p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Cet objet n'a pas de propriétés DMX
        </p>
      </div>
    );
  }

  const fx = obj.spotlightFixture;
  const channelCount = isFirework ? 1 : (fx?.channels.length ?? 1);
  const base = obj.dmxAddress ?? 1;

  return (
    <div className="h-full bg-card border border-panel-border rounded-sm flex flex-col overflow-hidden">
      <div className="p-3 border-b border-panel-border bg-muted/30 flex items-center justify-between">
        <span className="text-sm font-medium truncate">{obj.name}</span>
        <span className="text-xs text-muted-foreground">
          {isFirework ? 'Feu d\u2019artifice' : (fx?.name ?? 'Projecteur')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Adresse DMX</Label>
          <Input
            type="number"
            min={1}
            max={512}
            value={base}
            onChange={(e) => onUpdateDmxAddress(obj.id, parseInt(e.target.value) || 1)}
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Canaux {base} – {base + channelCount - 1}
          </p>
        </div>

        {isFirework && (
          <div className="space-y-1.5">
            <Label className="text-xs">Couleur</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={obj.properties.color}
                onChange={(e) => onUpdateColor(obj.id, e.target.value)}
                className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={obj.properties.color}
                onChange={(e) => onUpdateColor(obj.id, e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
