import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditorObject3D } from '@/types/editor';
import { AnchorSource } from '@/types/drone';
import { generateAnchors } from '@/lib/anchorGeometry';
import { Boxes, Grid3x3, Move3d, Trash2, X } from 'lucide-react';

interface AnchorEditorProps {
  object: EditorObject3D;
  onSetAnchors: (id: string, anchors: EditorObject3D['anchors']) => void;
  onClose: () => void;
}

export const AnchorEditor: React.FC<AnchorEditorProps> = ({ object, onSetAnchors, onClose }) => {
  const [mode, setMode] = useState<AnchorSource>('vertex');
  const [divisions, setDivisions] = useState(2);

  const anchorCount = object.anchors?.length ?? 0;

  const handleGenerate = () => {
    const anchors = generateAnchors(object, { mode, divisions });
    onSetAnchors(object.id, anchors);
  };

  const handleAppend = () => {
    const fresh = generateAnchors(object, { mode, divisions });
    onSetAnchors(object.id, [...(object.anchors || []), ...fresh]);
  };

  const handleClear = () => onSetAnchors(object.id, []);

  return (
    <div className="absolute top-2 left-2 z-20 w-72 bg-card/95 backdrop-blur border border-border rounded-md shadow-xl text-foreground">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Move3d className="h-4 w-4 text-primary" /> Ancrages — {object.name}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Source géométrique</Label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            <Button
              size="sm"
              variant={mode === 'vertex' ? 'default' : 'outline'}
              onClick={() => setMode('vertex')}
              className="h-8 text-xs"
            >
              Sommets
            </Button>
            <Button
              size="sm"
              variant={mode === 'edge' ? 'default' : 'outline'}
              onClick={() => setMode('edge')}
              className="h-8 text-xs"
            >
              Arêtes
            </Button>
            <Button
              size="sm"
              variant={mode === 'face' ? 'default' : 'outline'}
              onClick={() => setMode('face')}
              className="h-8 text-xs"
            >
              Faces
            </Button>
          </div>
        </div>

        {(mode === 'edge' || mode === 'face') && (
          <div>
            <Label className="text-xs">
              {mode === 'edge' ? 'Points par arête' : 'Subdivisions par face (N)'}
            </Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={divisions}
              onChange={e => setDivisions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="h-8 mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {mode === 'edge'
                ? `${divisions} point(s) répartis sur chaque arête.`
                : `Grille barycentrique N=${divisions} par triangle.`}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          <Button size="sm" onClick={handleGenerate} className="h-8 gap-2">
            <Grid3x3 className="h-3.5 w-3.5" /> Générer ancrages (remplace)
          </Button>
          <Button size="sm" variant="outline" onClick={handleAppend} className="h-8 gap-2">
            <Boxes className="h-3.5 w-3.5" /> Ajouter à l'existant
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            disabled={anchorCount === 0}
            className="h-8 gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Effacer tout
          </Button>
        </div>

        <div className="text-[11px] text-muted-foreground pt-2 border-t border-border">
          Total : <span className="font-mono text-foreground">{anchorCount}</span> ancrage(s)
        </div>
      </div>
    </div>
  );
};