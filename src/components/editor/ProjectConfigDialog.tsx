import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProjectConfig } from '@/types/editor';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface ProjectConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ProjectConfig;
  onUpdateConfig: (config: Partial<ProjectConfig>) => void;
}

const LocationPicker: React.FC<{
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
}> = ({ position, onPositionChange }) => {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return <Marker position={position} />;
};

export const ProjectConfigDialog: React.FC<ProjectConfigDialogProps> = ({
  open,
  onOpenChange,
  config,
  onUpdateConfig,
}) => {
  const [startTime, setStartTime] = useState(config.startTime);
  const [startDate, setStartDate] = useState(config.startDate);
  const [lat, setLat] = useState(config.latitude);
  const [lng, setLng] = useState(config.longitude);
  const [locationName, setLocationName] = useState(config.locationName);

  useEffect(() => {
    if (open) {
      setStartTime(config.startTime);
      setStartDate(config.startDate);
      setLat(config.latitude);
      setLng(config.longitude);
      setLocationName(config.locationName);
    }
  }, [open, config]);

  const handleSave = () => {
    onUpdateConfig({
      startTime,
      startDate,
      latitude: lat,
      longitude: lng,
      locationName,
    });
    onOpenChange(false);
  };

  const handleMapClick = (newLat: number, newLng: number) => {
    setLat(Math.round(newLat * 10000) / 10000);
    setLng(Math.round(newLng * 10000) / 10000);
    setLocationName(`${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configuration du projet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date du spectacle</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Heure de départ</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lieu : {locationName}</Label>
            <div className="text-xs text-muted-foreground">
              Lat: {lat} — Lon: {lng}
            </div>
            <div className="h-[300px] rounded-md overflow-hidden border border-border">
              <MapContainer
                center={[lat, lng]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationPicker
                  position={[lat, lng]}
                  onPositionChange={handleMapClick}
                />
              </MapContainer>
            </div>
          </div>

          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            💡 La luminosité ambiante de la scène 3D sera calculée automatiquement en fonction de la date, l'heure et la position géographique choisies.
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
