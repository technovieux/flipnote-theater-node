import React from 'react';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PropertiesPanel3DProps {
  selectedObject: EditorObject3D | null;
  onUpdateProperties: (id: string, properties: Partial<Object3DProperties>) => void;
  onAddKeyframe: () => void;
}

export const PropertiesPanel3D: React.FC<PropertiesPanel3DProps> = ({
  selectedObject,
  onUpdateProperties,
  onAddKeyframe,
}) => {
  if (!selectedObject) {
    return (
      <div className="panel h-full">
        <div className="panel-header">Propriétés 3D</div>
        <div className="panel-content flex items-center justify-center text-muted-foreground text-sm p-4">
          Sélectionnez un objet pour voir ses propriétés
        </div>
      </div>
    );
  }

  const { properties } = selectedObject;

  const handleChange = (key: keyof Object3DProperties, value: number | string) => {
    onUpdateProperties(selectedObject.id, { [key]: value });
  };

  return (
    <div className="panel h-full">
      <div className="panel-header">Propriétés 3D</div>
      <div className="panel-content p-2 space-y-1 overflow-y-auto max-h-[calc(100%-40px)]">
        <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Position</div>
        
        <div className="property-row">
          <span className="property-label">X</span>
          <Slider
            value={[properties.x]}
            onValueChange={([v]) => handleChange('x', v)}
            max={500}
            min={-500}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.x)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Y</span>
          <Slider
            value={[properties.y]}
            onValueChange={([v]) => handleChange('y', v)}
            max={500}
            min={-500}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.y)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Z</span>
          <Slider
            value={[properties.z]}
            onValueChange={([v]) => handleChange('z', v)}
            max={500}
            min={-500}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.z)}</span>
        </div>

        <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Taille</div>

        <div className="property-row">
          <span className="property-label">Largeur</span>
          <Slider
            value={[properties.width]}
            onValueChange={([v]) => handleChange('width', v)}
            max={300}
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
            max={300}
            min={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.height)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Profondeur</span>
          <Slider
            value={[properties.depth]}
            onValueChange={([v]) => handleChange('depth', v)}
            max={300}
            min={10}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.depth)}</span>
        </div>

        <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Rotation</div>

        <div className="property-row">
          <span className="property-label">Rot. X (°)</span>
          <Slider
            value={[properties.rotationX]}
            onValueChange={([v]) => handleChange('rotationX', v)}
            max={360}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.rotationX)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Rot. Y (°)</span>
          <Slider
            value={[properties.rotationY]}
            onValueChange={([v]) => handleChange('rotationY', v)}
            max={360}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.rotationY)}</span>
        </div>

        <div className="property-row">
          <span className="property-label">Rot. Z (°)</span>
          <Slider
            value={[properties.rotationZ]}
            onValueChange={([v]) => handleChange('rotationZ', v)}
            max={360}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-10 text-right">{Math.round(properties.rotationZ)}</span>
        </div>

        <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Apparence</div>

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
