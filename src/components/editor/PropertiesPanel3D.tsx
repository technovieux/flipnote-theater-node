import React from 'react';
import { EditorObject3D, Object3DProperties, VideoTrack } from '@/types/editor';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PropertiesPanel3DProps {
  selectedObjects: EditorObject3D[];
  onUpdateProperties: (id: string, properties: Partial<Object3DProperties>) => void;
  onUpdateAllSelected: (properties: Partial<Object3DProperties>) => void;
  onAddKeyframe: () => void;
  videoTracks?: VideoTrack[];
  onPickVideoForProjector?: (projectorId: string) => void;
  onRemoveVideoFromProjector?: (projectorId: string) => void;
  onOpenKeystoneEditor?: (projectorId: string) => void;
}

export const PropertiesPanel3D: React.FC<PropertiesPanel3DProps> = ({
  selectedObjects,
  onUpdateProperties,
  onUpdateAllSelected,
  onAddKeyframe,
  videoTracks,
  onPickVideoForProjector,
  onRemoveVideoFromProjector,
  onOpenKeystoneEditor,
}) => {
  if (selectedObjects.length === 0) {
    return (
      <div className="panel h-full">
        <div className="panel-header">Propriétés 3D</div>
        <div className="panel-content flex items-center justify-center text-muted-foreground text-sm p-4">
          Sélectionnez un objet pour voir ses propriétés
        </div>
      </div>
    );
  }

  const isMulti = selectedObjects.length > 1;
  const firstObj = selectedObjects[0];
  const firstProps = firstObj.properties;
  const isLyre = !isMulti && firstObj.type === 'spotlight_lyre';
  const isParLed = !isMulti && firstObj.type === 'spotlight_par_led';
  const isSpotlight = !isMulti && (firstObj.type === 'spotlight_lyre' || firstObj.type === 'spotlight_par' || firstObj.type === 'spotlight_par_led');
  const isProjector = !isMulti && firstObj.type === 'videoprojector';

  const getMixedValue = (key: keyof Object3DProperties): number | null => {
    if (!isMulti) return firstProps[key] as number;
    const values = selectedObjects.map(o => o.properties[key]);
    return values.every(v => v === values[0]) ? (values[0] as number) : null;
  };

  const getMixedColor = (): string | null => {
    if (!isMulti) return firstProps.color;
    const colors = selectedObjects.map(o => o.properties.color);
    return colors.every(c => c === colors[0]) ? colors[0] : null;
  };

  const handleChange = (key: keyof Object3DProperties, value: number | string) => {
    if (isMulti) {
      onUpdateAllSelected({ [key]: value });
    } else {
      onUpdateProperties(selectedObjects[0].id, { [key]: value });
    }
  };

  const val = (key: keyof Object3DProperties) => getMixedValue(key);
  const mixedColor = getMixedColor();

  return (
    <div className="panel h-full">
      <div className="panel-header">
        Propriétés 3D
        {isMulti && <span className="ml-2 text-xs text-primary">({selectedObjects.length} objets)</span>}
      </div>
      <div className="panel-content p-2 space-y-1 overflow-y-auto max-h-[calc(100%-40px)]">
        <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Position</div>
        
        {(['x', 'y', 'z'] as const).map(axis => (
          <div key={axis} className="property-row">
            <span className="property-label">{axis.toUpperCase()}</span>
            <Slider
              value={[val(axis) ?? firstProps[axis]]}
              onValueChange={([v]) => handleChange(axis, v)}
              max={500}
              min={-500}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-10 text-right">{val(axis) !== null ? Math.round(val(axis)!) : '—'}</span>
          </div>
        ))}

        <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Taille</div>

        {([['width', 'Largeur'], ['height', 'Hauteur'], ['depth', 'Profondeur']] as const).map(([key, label]) => (
          <div key={key} className="property-row">
            <span className="property-label">{label}</span>
            <Slider
              value={[val(key) ?? firstProps[key]]}
              onValueChange={([v]) => handleChange(key, v)}
              max={300}
              min={10}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-10 text-right">{val(key) !== null ? Math.round(val(key)!) : '—'}</span>
          </div>
        ))}

        <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">
          {isLyre ? 'Pan / Tilt' : 'Rotation'}
        </div>

        {isLyre ? (
          <>
            {([['rotationY', 'Pan (°)'], ['rotationX', 'Tilt (°)']] as const).map(([key, label]) => (
              <div key={key} className="property-row">
                <span className="property-label">{label}</span>
                <Slider
                  value={[val(key) ?? firstProps[key]]}
                  onValueChange={([v]) => handleChange(key, v)}
                  max={key === 'rotationY' ? 540 : 270}
                  min={key === 'rotationY' ? -540 : -135}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs w-10 text-right">{val(key) !== null ? Math.round(val(key)!) : '—'}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {([['rotationX', 'Rot. X (°)'], ['rotationY', 'Rot. Y (°)'], ['rotationZ', 'Rot. Z (°)']] as const).map(([key, label]) => (
              <div key={key} className="property-row">
                <span className="property-label">{label}</span>
                <Slider
                  value={[val(key) ?? firstProps[key]]}
                  onValueChange={([v]) => handleChange(key, v)}
                  max={360}
                  min={0}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs w-10 text-right">{val(key) !== null ? Math.round(val(key)!) : '—'}</span>
              </div>
            ))}
          </>
        )}

        <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Apparence</div>

        <div className="property-row">
          <span className="property-label">Opacité (%)</span>
          <Slider
            value={[val('opacity') ?? firstProps.opacity]}
            onValueChange={([v]) => handleChange('opacity', v)}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{val('opacity') !== null ? Math.round(val('opacity')!) : '—'}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Couleur</span>
          <Input
            type="color"
            value={mixedColor ?? firstProps.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="w-16 h-8 p-0 border-0 cursor-pointer"
          />
          {isMulti && mixedColor === null && (
            <span className="text-xs text-muted-foreground">mixte</span>
          )}
        </div>

        {isSpotlight && (
          <>
            <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Spot</div>
            <div className="property-row">
              <span className="property-label">Puissance (%)</span>
              <Slider
                value={[firstProps.spotPower ?? 100]}
                onValueChange={([v]) => handleChange('spotPower' as keyof Object3DProperties, v)}
                max={200}
                min={0}
                step={1}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right">{Math.round(firstProps.spotPower ?? 100)}</span>
            </div>
          </>
        )}

        {isParLed && (
          <>
            <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Canaux LED (DMX 0-255)</div>
            {([
              ['ledDimmer', 'Dimmer', 255],
              ['ledR', 'Rouge', 0],
              ['ledG', 'Vert', 0],
              ['ledB', 'Bleu', 0],
              ['ledW', 'Blanc', 0],
            ] as const).map(([key, label, def]) => {
              const current = (firstProps as any)[key] ?? def;
              return (
                <div key={key} className="property-row">
                  <span className="property-label">{label}</span>
                  <Slider
                    value={[current]}
                    onValueChange={([v]) => handleChange(key as keyof Object3DProperties, v)}
                    max={255}
                    min={0}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs w-10 text-right">{Math.round(current)}</span>
                </div>
              );
            })}
          </>
        )}

        {isProjector && (
          <>
            <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Mapping vidéo</div>
            <div className="property-row">
              <span className="property-label">Distance max (m)</span>
              <Slider
                value={[firstProps.throwDistance ?? 8]}
                onValueChange={([v]) => handleChange('throwDistance' as keyof Object3DProperties, v)}
                max={30}
                min={1}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right">{(firstProps.throwDistance ?? 8).toFixed(1)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Ratio de tir</span>
              <Slider
                value={[firstProps.throwRatio ?? 0.6]}
                onValueChange={([v]) => handleChange('throwRatio' as keyof Object3DProperties, v)}
                max={2}
                min={0.3}
                step={0.05}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right">{(firstProps.throwRatio ?? 0.6).toFixed(2)}</span>
            </div>
            <div className="property-row items-start">
              <span className="property-label">Vidéo</span>
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-xs truncate">
                  {(() => {
                    const t = videoTracks?.find(v => v.id === firstProps.videoTrackId);
                    return t ? t.name : '— aucune —';
                  })()}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" onClick={() => onPickVideoForProjector?.(firstObj.id)}>
                    Charger…
                  </Button>
                  {firstProps.videoTrackId && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRemoveVideoFromProjector?.(firstObj.id)}>
                      Retirer
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="px-3 pt-2">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => onOpenKeystoneEditor?.(firstObj.id)}>
                Éditer le keystone (4 coins)
              </Button>
            </div>
          </>
        )}

        <div className="pt-4 px-3">
          <Button onClick={onAddKeyframe} className="w-full transport-btn-primary">
            Ajouter Keyframe{isMulti ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};
