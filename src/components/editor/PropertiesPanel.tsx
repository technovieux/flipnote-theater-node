import React from 'react';
import { EditorObject, ObjectProperties } from '@/types/editor';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PropertiesPanelProps {
  selectedObjects: EditorObject[];
  onUpdateProperties: (id: string, properties: Partial<ObjectProperties>) => void;
  onUpdateAllSelected: (properties: Partial<ObjectProperties>) => void;
  onAddKeyframe: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedObjects,
  onUpdateProperties,
  onUpdateAllSelected,
  onAddKeyframe,
}) => {
  if (selectedObjects.length === 0) {
    return (
      <div className="panel h-full">
        <div className="panel-header">Propriétés</div>
        <div className="panel-content flex items-center justify-center text-muted-foreground text-sm p-4">
          Sélectionnez un objet pour voir ses propriétés
        </div>
      </div>
    );
  }

  const isMulti = selectedObjects.length > 1;
  // For single selection, use the object's properties directly
  // For multi-selection, compute mixed values
  const firstProps = selectedObjects[0].properties;

  const getMixedValue = (key: keyof ObjectProperties): number | null => {
    if (!isMulti) return firstProps[key] as number;
    const values = selectedObjects.map(o => o.properties[key]);
    return values.every(v => v === values[0]) ? (values[0] as number) : null;
  };

  const getMixedColor = (): string | null => {
    if (!isMulti) return firstProps.color;
    const colors = selectedObjects.map(o => o.properties.color);
    return colors.every(c => c === colors[0]) ? colors[0] : null;
  };

  const handleChange = (key: keyof ObjectProperties, value: number | string) => {
    if (isMulti) {
      onUpdateAllSelected({ [key]: value });
    } else {
      onUpdateProperties(selectedObjects[0].id, { [key]: value });
    }
  };

  const mixedX = getMixedValue('x');
  const mixedY = getMixedValue('y');
  const mixedW = getMixedValue('width');
  const mixedH = getMixedValue('height');
  const mixedOpacity = getMixedValue('opacity');
  const mixedRotation = getMixedValue('rotation');
  const mixedColor = getMixedColor();

  return (
    <div className="panel h-full">
      <div className="panel-header">
        Propriétés
        {isMulti && <span className="ml-2 text-xs text-primary">({selectedObjects.length} objets)</span>}
      </div>
      <div className="panel-content p-2 space-y-1">
        <div className="property-row">
          <span className="property-label">Position X</span>
          <Slider
            value={[mixedX ?? firstProps.x]}
            onValueChange={([v]) => handleChange('x', v)}
            max={800}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{mixedX !== null ? Math.round(mixedX) : '—'}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Position Y</span>
          <Slider
            value={[mixedY ?? firstProps.y]}
            onValueChange={([v]) => handleChange('y', v)}
            max={600}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{mixedY !== null ? Math.round(mixedY) : '—'}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Largeur</span>
          <Slider
            value={[mixedW ?? firstProps.width]}
            onValueChange={([v]) => handleChange('width', v)}
            max={500}
            min={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{mixedW !== null ? Math.round(mixedW) : '—'}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Hauteur</span>
          <Slider
            value={[mixedH ?? firstProps.height]}
            onValueChange={([v]) => handleChange('height', v)}
            max={500}
            min={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{mixedH !== null ? Math.round(mixedH) : '—'}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Opacité (%)</span>
          <Slider
            value={[mixedOpacity ?? firstProps.opacity]}
            onValueChange={([v]) => handleChange('opacity', v)}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{mixedOpacity !== null ? Math.round(mixedOpacity) : '—'}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Rotation (°)</span>
          <Slider
            value={[mixedRotation ?? firstProps.rotation]}
            onValueChange={([v]) => handleChange('rotation', v)}
            max={360}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{mixedRotation !== null ? Math.round(mixedRotation) : '—'}</span>
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
