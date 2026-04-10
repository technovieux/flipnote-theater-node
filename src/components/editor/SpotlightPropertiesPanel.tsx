import React, { useState, useEffect } from 'react';
import { EditorObject3D } from '@/types/editor';
import { SpotlightProduct } from '@/types/spotlights';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface SpotlightPropertiesPanelProps {
  selectedObjects: EditorObject3D[];
  onUpdateProperties: (id: string, properties: any) => void;
  onUpdateAllSelected: (properties: any) => void;
  onAddKeyframe: () => void;
}

// Définition des canaux DMX pour différents types de projecteurs
const getDMXChannels = (product: SpotlightProduct): Array<{ name: string; default: number }> => {
  const baseChannels = [
    { name: 'Intensité', default: 0 },
    { name: 'Rouge', default: 255 },
    { name: 'Vert', default: 255 },
    { name: 'Bleu', default: 255 },
  ];

  // Ajouter des canaux spécifiques selon le type de projecteur
  switch (product.beamType.toLowerCase()) {
    case 'narrow':
    case 'medium':
    case 'wide':
      // Projecteurs RGB avec strobe
      return [
        ...baseChannels,
        { name: 'Strobe', default: 0 },
        { name: 'Mode', default: 0 },
      ];
    case 'very narrow':
    case 'ultra-narrow':
      // Projecteurs professionnels avec plus de contrôle
      return [
        ...baseChannels,
        { name: 'Strobe', default: 0 },
        { name: 'Mode', default: 0 },
        { name: 'Pan', default: 128 },
        { name: 'Tilt', default: 128 },
        { name: 'Pan Fine', default: 0 },
        { name: 'Tilt Fine', default: 0 },
      ];
    default:
      return baseChannels;
  }
};

export const SpotlightPropertiesPanel: React.FC<SpotlightPropertiesPanelProps> = ({
  selectedObjects,
  onUpdateProperties,
  onUpdateAllSelected,
  onAddKeyframe,
}) => {
  const [dmxValues, setDmxValues] = useState<Record<string, number[]>>({});

  // Initialiser les valeurs DMX pour les objets sélectionnés
  useEffect(() => {
    const newDmxValues: Record<string, number[]> = {};

    selectedObjects.forEach(obj => {
      if (obj.type === 'spotlight' && obj.spotlightProduct) {
        const channels = getDMXChannels(obj.spotlightProduct);
        const currentValues = obj.dmxValues || channels.map(ch => ch.default);
        newDmxValues[obj.id] = currentValues;
      }
    });

    setDmxValues(newDmxValues);
  }, [selectedObjects]);

  const isMulti = selectedObjects.length > 1;
  const firstObj = selectedObjects[0];
  const product = firstObj.spotlightProduct!;

  const channels = getDMXChannels(product);

  const handleDMXChange = (channelIndex: number, value: number, objectId?: string) => {
    const targetId = objectId || firstObj.id;
    const currentValues = dmxValues[targetId] || channels.map(ch => ch.default);
    const updatedValues = currentValues.map((v, i) => i === channelIndex ? value : v);

    setDmxValues(prev => ({
      ...prev,
      [targetId]: updatedValues,
    }));

    onUpdateProperties(targetId, { dmxValues: updatedValues });

    // Ajouter automatiquement une keyframe
    setTimeout(() => onAddKeyframe(), 10);
  };

  const handleNameChange = (name: string) => {
    if (isMulti) {
      onUpdateAllSelected({ name });
    } else {
      onUpdateProperties(firstObj.id, { name });
    }
  };

  const handleAddressChange = (address: string) => {
    if (isMulti) {
      onUpdateAllSelected({ spotlightAddress: address });
    } else {
      onUpdateProperties(firstObj.id, { spotlightAddress: address });
    }
  };

  const getMixedValue = (key: keyof EditorObject3D): string | null => {
    if (!isMulti) return firstObj[key] as string;
    const values = selectedObjects.map(o => o[key]);
    return values.every(v => v === values[0]) ? (values[0] as string) : null;
  };

  return (
    <div className="panel h-full">
      <div className="panel-header">
        Propriétés Projecteur
        {isMulti && <span className="ml-2 text-xs text-primary">({selectedObjects.length} objets)</span>}
      </div>
      <div className="panel-content p-2 space-y-3 overflow-y-auto max-h-[calc(100%-40px)]">

        {/* Informations générales */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Informations</div>

          <div className="space-y-2">
            <Label htmlFor="spotlight-name" className="text-xs">Nom</Label>
            <Input
              id="spotlight-name"
              value={getMixedValue('name') ?? firstObj.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nom du projecteur"
              className="text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spotlight-address" className="text-xs">Adresse DMX</Label>
            <Input
              id="spotlight-address"
              value={getMixedValue('spotlightAddress') ?? firstObj.spotlightAddress ?? ''}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="DMX:1"
              className="text-xs"
            />
          </div>
        </div>

        {/* Informations du produit */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Produit</div>
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <div className="font-medium">{product.name}</div>
            <div>{product.manufacturer} • {product.power} • {product.beamAngle}°</div>
          </div>
        </div>

        {/* Canaux DMX */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Canaux DMX ({channels.length} canaux)
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {channels.map((channel, index) => {
              const currentValue = isMulti
                ? null // Valeur mixte pour multi-sélection
                : dmxValues[firstObj.id]?.[index] ?? channel.default;

              return (
                <div key={index} className="property-row">
                  <span className="property-label text-xs">{channel.name}</span>
                  <Slider
                    value={[currentValue ?? channel.default]}
                    onValueChange={([v]) => handleDMXChange(index, v)}
                    max={255}
                    min={0}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs w-10 text-right">
                    {currentValue !== null ? currentValue : channel.default}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bouton keyframe */}
        <div className="pt-2">
          <Button onClick={onAddKeyframe} className="w-full transport-btn-primary text-xs">
            Ajouter Keyframe{isMulti ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};