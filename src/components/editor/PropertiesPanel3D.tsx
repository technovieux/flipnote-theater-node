import React from 'react';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PropertiesPanel3DProps {
  selectedObjects: EditorObject3D[];
  onUpdateProperties: (id: string, properties: Partial<Object3DProperties>) => void;
  onUpdateAllSelected: (properties: Partial<Object3DProperties>) => void;
  onAddKeyframe: () => void;
}

export const PropertiesPanel3D: React.FC<PropertiesPanel3DProps> = ({
  selectedObjects,
  onUpdateProperties,
  onUpdateAllSelected,
  onAddKeyframe,
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

        <div className="pt-4 px-3">
          <Button onClick={onAddKeyframe} className="w-full transport-btn-primary">
            Ajouter Keyframe{isMulti ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};
