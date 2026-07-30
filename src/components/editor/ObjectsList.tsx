import React, { useState, useRef } from 'react';
import { EditorObject } from '@/types/editor';
import { Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ObjectsListProps {
  objects: EditorObject[];
  selectedObjectIds: string[];
  onSelect: (id: string, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onToggleVisibility?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export const ObjectsList: React.FC<ObjectsListProps> = ({
  objects,
  selectedObjectIds,
  onSelect,
  onReorder,
  onDelete,
  onRename,
  onToggleVisibility,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = (obj: EditorObject) => {
    setEditingId(obj.id);
    setEditingName(obj.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRenameSubmit = (id: string) => {
    if (editingName.trim() && onRename) {
      onRename(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      onReorder(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleClick = (e: React.MouseEvent, objId: string) => {
    const target = objects.find(o => o.id === objId);
    if (target && target.visible === false) return;
    onSelect(objId, { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey });
  };

  return (
    <div className="panel h-full">
      <div className="panel-header">
        Layers / Objets
        {selectedObjectIds.length > 1 && (
          <span className="ml-2 text-xs text-primary">({selectedObjectIds.length} sélectionnés)</span>
        )}
      </div>
      <div className="panel-content">
        {objects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Aucun objet. Utilisez Objet → Ajouter pour créer.
          </div>
        ) : (
          objects.map((obj, index) => (
            <div
              key={obj.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`object-item ${selectedObjectIds.includes(obj.id) ? 'selected' : ''} ${obj.visible === false ? 'opacity-50' : ''} ${
                dragOverIndex === index ? 'border-t-2 border-primary' : ''
              } ${draggedIndex === index ? 'opacity-50' : ''}`}
              onClick={(e) => handleClick(e, obj.id)}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                title={obj.visible === false ? 'Afficher' : 'Masquer'}
                onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(obj.id); }}
              >
                {obj.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <div
                className="w-4 h-4 rounded-sm flex-shrink-0"
                style={{ backgroundColor: obj.properties.color }}
              />
              {editingId === obj.id ? (
                <Input
                  ref={inputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRenameSubmit(obj.id)}
                  onKeyDown={(e) => handleKeyDown(e, obj.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span
                  className="flex-1 truncate text-sm cursor-text"
                  onDoubleClick={() => handleDoubleClick(obj)}
                >
                  {obj.name}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
