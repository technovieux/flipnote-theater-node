import React, { useState, useRef, useEffect } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { Trash2, Plus, Undo2, RotateCcw } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface CustomShapeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateShape: (name: string, points: Point[], depth: number, bevel: boolean) => void;
}

export const CustomShapeEditor: React.FC<CustomShapeEditorProps> = ({
  open,
  onOpenChange,
  onCreateShape,
}) => {
  const [shapeName, setShapeName] = useState('Forme personnalisée');
  const [points, setPoints] = useState<Point[]>([]);
  const [depth, setDepth] = useState(50);
  const [bevel, setBevel] = useState(false);
  const [isDrawing, setIsDrawing] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canvasSize = 400;
  const gridSize = 20;

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid
    ctx.strokeStyle = 'hsl(var(--border))';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvasSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize);
      ctx.stroke();
    }
    for (let y = 0; y <= canvasSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize, y);
      ctx.stroke();
    }

    // Draw center crosshair
    ctx.strokeStyle = 'hsl(var(--muted-foreground))';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvasSize / 2, 0);
    ctx.lineTo(canvasSize / 2, canvasSize);
    ctx.moveTo(0, canvasSize / 2);
    ctx.lineTo(canvasSize, canvasSize / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw shape
    if (points.length > 0) {
      // Draw filled shape
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (!isDrawing && points.length > 2) {
        ctx.closePath();
        ctx.fillStyle = 'hsla(var(--primary), 0.3)';
        ctx.fill();
      }

      // Draw outline
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw points
      points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = index === 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Instructions
    if (points.length === 0) {
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cliquez pour placer des points', canvasSize / 2, canvasSize / 2 - 10);
      ctx.fillText('Double-cliquez pour fermer la forme', canvasSize / 2, canvasSize / 2 + 10);
    }
  }, [points, isDrawing]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Snap to grid
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;

    setPoints([...points, { x: snappedX, y: snappedY }]);
  };

  const handleDoubleClick = () => {
    if (points.length >= 3) {
      setIsDrawing(false);
    }
  };

  const handleReset = () => {
    setPoints([]);
    setIsDrawing(true);
  };

  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
      if (!isDrawing) setIsDrawing(true);
    }
  };

  const handleCreate = () => {
    if (points.length < 3) return;

    // Convert canvas coordinates to normalized coordinates (-1 to 1)
    const normalizedPoints = points.map(p => ({
      x: (p.x - canvasSize / 2) / (canvasSize / 4),
      y: -(p.y - canvasSize / 2) / (canvasSize / 4), // Invert Y for 3D
    }));

    onCreateShape(shapeName, normalizedPoints, depth, bevel);
    onOpenChange(false);
    
    // Reset for next time
    setPoints([]);
    setIsDrawing(true);
    setShapeName('Forme personnalisée');
    setDepth(50);
    setBevel(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>✏️</span> Éditeur de forme personnalisée
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shapeName">Nom de la forme</Label>
            <Input
              id="shapeName"
              value={shapeName}
              onChange={(e) => setShapeName(e.target.value)}
              placeholder="Entrez un nom..."
            />
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={points.length === 0}>
              <Undo2 className="w-4 h-4 mr-1" /> Annuler
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Réinitialiser
            </Button>
          </div>

          <div 
            ref={containerRef}
            className="flex justify-center border rounded-lg overflow-hidden"
          >
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              onClick={handleCanvasClick}
              onDoubleClick={handleDoubleClick}
              className="cursor-crosshair"
            />
          </div>

          <div className="text-xs text-center text-muted-foreground">
            {isDrawing ? (
              points.length === 0 
                ? "Cliquez pour placer des points. Double-cliquez pour fermer."
                : `${points.length} points placés. Double-cliquez pour fermer la forme.`
            ) : (
              "Forme fermée. Ajustez les paramètres ci-dessous."
            )}
          </div>

          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Profondeur d'extrusion</Label>
                <span className="text-sm text-muted-foreground">{depth}px</span>
              </div>
              <Slider
                value={[depth]}
                onValueChange={([v]) => setDepth(v)}
                min={10}
                max={200}
                step={10}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bevel"
                checked={bevel}
                onChange={(e) => setBevel(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="bevel" className="cursor-pointer">
                Ajouter un biseau (bevel)
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={points.length < 3 || isDrawing}>
            <Plus className="w-4 h-4 mr-1" /> Créer la forme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
