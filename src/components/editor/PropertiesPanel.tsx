import React from 'react';
import { EditorObject, ObjectProperties } from '@/types/editor';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PropertiesPanelProps {
  selectedObject: EditorObject | null;
  onUpdateProperties: (id: string, properties: Partial<ObjectProperties>) => void;
  onAddKeyframe: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedObject,
  onUpdateProperties,
  onAddKeyframe,
}) => {
  if (!selectedObject) {
    return (
      <div className="panel h-full">
        <div className="panel-header">Propriétés</div>
        <div className="panel-content flex items-center justify-center text-muted-foreground text-sm p-4">
          Sélectionnez un objet pour voir ses propriétés
        </div>
      </div>
    );
  }

  const { properties } = selectedObject;

  const handleChange = (key: keyof ObjectProperties, value: number | string) => {
    onUpdateProperties(selectedObject.id, { [key]: value });
  };

  return (
    <div className="panel h-full">
      <div className="panel-header">Propriétés</div>
      <div className="panel-content p-2 space-y-1">
        <div className="property-row">
          <span className="property-label">Position X</span>
          <Slider
            value={[properties.x]}
            onValueChange={([v]) => handleChange('x', v)}
            max={800}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.x)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Position Y</span>
          <Slider
            value={[properties.y]}
            onValueChange={([v]) => handleChange('y', v)}
            max={600}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.y)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Largeur</span>
          <Slider
            value={[properties.width]}
            onValueChange={([v]) => handleChange('width', v)}
            max={500}
            min={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.width)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Hauteur</span>
          <Slider
            value={[properties.height]}
            onValueChange={([v]) => handleChange('height', v)}
            max={500}
            min={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.height)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Opacité (%)</span>
          <Slider
            value={[properties.opacity]}
            onValueChange={([v]) => handleChange('opacity', v)}
            max={100}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.opacity)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Rotation (°)</span>
          <Slider
            value={[properties.rotation]}
            onValueChange={([v]) => handleChange('rotation', v)}
            max={360}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.rotation)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Couleur</span>
          <Input
            type="color"
            value={properties.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="w-16 h-8 p-0 border-0 cursor-pointer"
          />
        </div>

        <div className="pt-4 px-3">
          <Button onClick={onAddKeyframe} className="w-full transport-btn-primary">
            Ajouter Keyframe
          </Button>
        </div>
      </div>
    </div>
  );
};
