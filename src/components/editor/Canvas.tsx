import React, { useRef, useState, useEffect } from 'react';
import { EditorObject, ObjectProperties } from '@/types/editor';

interface CanvasProps {
  objects: EditorObject[];
  selectedObjectId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateProperties: (id: string, properties: Partial<ObjectProperties>) => void;
  getInterpolatedProperties: (object: EditorObject, time: number) => ObjectProperties;
  currentTime: number;
}

export const Canvas: React.FC<CanvasProps> = ({
  objects,
  selectedObjectId,
  onSelect,
  onUpdateProperties,
  getInterpolatedProperties,
  currentTime,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, objX: 0, objY: 0, objW: 0, objH: 0 });

  const handleMouseDown = (e: React.MouseEvent, objId: string, handle?: string) => {
    e.stopPropagation();
    onSelect(objId);
    
    const obj = objects.find(o => o.id === objId);
    if (!obj) return;
    
    const props = getInterpolatedProperties(obj, currentTime);
    
    if (handle) {
      setResizing({ id: objId, handle });
    } else {
      setDragging(objId);
    }
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      objX: props.x,
      objY: props.y,
      objW: props.width,
      objH: props.height,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    if (dragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      onUpdateProperties(dragging, {
        x: dragStart.objX + deltaX,
        y: dragStart.objY + deltaY,
      });
    } else if (resizing) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newProps: Partial<ObjectProperties> = {};
      
      switch (resizing.handle) {
        case 'nw':
          newProps = {
            x: dragStart.objX + deltaX,
            y: dragStart.objY + deltaY,
            width: Math.max(20, dragStart.objW - deltaX),
            height: Math.max(20, dragStart.objH - deltaY),
          };
          break;
        case 'ne':
          newProps = {
            y: dragStart.objY + deltaY,
            width: Math.max(20, dragStart.objW + deltaX),
            height: Math.max(20, dragStart.objH - deltaY),
          };
          break;
        case 'sw':
          newProps = {
            x: dragStart.objX + deltaX,
            width: Math.max(20, dragStart.objW - deltaX),
            height: Math.max(20, dragStart.objH + deltaY),
          };
          break;
        case 'se':
          newProps = {
            width: Math.max(20, dragStart.objW + deltaX),
            height: Math.max(20, dragStart.objH + deltaY),
          };
          break;
      }
      
      onUpdateProperties(resizing.id, newProps);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onSelect(null);
    }
  };

  const renderShape = (obj: EditorObject) => {
    const props = getInterpolatedProperties(obj, currentTime);
    const isSelected = selectedObjectId === obj.id;
    
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: props.x,
      top: props.y,
      width: props.width,
      height: props.height,
      transform: `rotate(${props.rotation}deg)`,
      opacity: props.opacity / 100,
      backgroundColor: obj.type !== 'triangle' ? props.color : 'transparent',
      cursor: 'move',
      outline: isSelected ? '2px dashed hsl(var(--primary))' : 'none',
      outlineOffset: '4px',
    };

    if (obj.type === 'circle') {
      baseStyle.borderRadius = '50%';
    }

    if (obj.type === 'triangle') {
      baseStyle.width = 0;
      baseStyle.height = 0;
      baseStyle.backgroundColor = 'transparent';
      baseStyle.borderLeft = `${props.width / 2}px solid transparent`;
      baseStyle.borderRight = `${props.width / 2}px solid transparent`;
      baseStyle.borderBottom = `${props.height}px solid ${props.color}`;
    }

    return (
      <div
        key={obj.id}
        style={baseStyle}
        onMouseDown={(e) => handleMouseDown(e, obj.id)}
      >
        {isSelected && obj.type !== 'triangle' && (
          <>
            <div
              className="resize-handle -top-1 -left-1 cursor-nw-resize"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'nw')}
            />
            <div
              className="resize-handle -top-1 -right-1 cursor-ne-resize"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'ne')}
            />
            <div
              className="resize-handle -bottom-1 -left-1 cursor-sw-resize"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'sw')}
            />
            <div
              className="resize-handle -bottom-1 -right-1 cursor-se-resize"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'se')}
            />
          </>
        )}
      </div>
    );
  };

  // Render objects in reverse order (first in array = on top)
  const reversedObjects = [...objects].reverse();

  return (
    <div className="panel h-full">
      <div className="panel-header">Render / Composition View</div>
      <div
        ref={containerRef}
        className="panel-content relative bg-muted overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        style={{ minHeight: 300 }}
      >
        {reversedObjects.map(renderShape)}
      </div>
    </div>
  );
};
