import React from 'react';
import { EditorObject } from '@/types/editor';
import { ChevronUp, ChevronDown, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ObjectsListProps {
  objects: EditorObject[];
  selectedObjectId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export const ObjectsList: React.FC<ObjectsListProps> = ({
  objects,
  selectedObjectId,
  onSelect,
  onReorder,
  onDelete,
}) => {
  const moveUp = (index: number) => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < objects.length - 1) {
      onReorder(index, index + 1);
    }
  };

  return (
    <div className="panel h-full">
      <div className="panel-header">Layers / Objets</div>
      <div className="panel-content">
        {objects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Aucun objet. Utilisez Objet → Ajouter pour créer.
          </div>
        ) : (
          objects.map((obj, index) => (
            <div
              key={obj.id}
              className={`object-item ${selectedObjectId === obj.id ? 'selected' : ''}`}
              onClick={() => onSelect(obj.id)}
            >
              <div
                className="w-4 h-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: obj.properties.color }}
              />
              <span className="flex-1 truncate text-sm">{obj.name}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveUp(index); }}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveDown(index); }}
                  disabled={index === objects.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
