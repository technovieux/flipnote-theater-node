import React, { useRef, useState, useEffect, useCallback } from 'react';
import { EditorObject, ObjectProperties } from '@/types/editor';

interface CanvasProps {
  objects: EditorObject[];
  selectedObjectId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateProperties: (id: string, properties: Partial<ObjectProperties>) => void;
  getInterpolatedProperties: (object: EditorObject, time: number) => ObjectProperties;
  currentTime: number;
}

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

export const Canvas: React.FC<CanvasProps> = ({
  objects,
  selectedObjectId,
  onSelect,
  onUpdateProperties,
  getInterpolatedProperties,
  currentTime,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, objX: 0, objY: 0, objW: 0, objH: 0 });
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.1, Math.min(3, prev + delta)));
    }
  }, []);

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

  const handlePanStart = (e: React.MouseEvent) => {
    // Only start panning if clicking on the container background or scene background
    if (e.target === containerRef.current || e.target === sceneRef.current) {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y });
      } else if (e.button === 0) {
        onSelect(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setPan({ x: panStart.panX + deltaX, y: panStart.panY + deltaY });
      return;
    }
    
    if (dragging) {
      const deltaX = (e.clientX - dragStart.x) / zoom;
      const deltaY = (e.clientY - dragStart.y) / zoom;
      
      onUpdateProperties(dragging, {
        x: dragStart.objX + deltaX,
        y: dragStart.objY + deltaY,
      });
    } else if (resizing) {
      const deltaX = (e.clientX - dragStart.x) / zoom;
      const deltaY = (e.clientY - dragStart.y) / zoom;
      
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
    setIsPanning(false);
  };

  const renderShape = (obj: EditorObject) => {
    const props = getInterpolatedProperties(obj, currentTime);
    const isSelected = selectedObjectId === obj.id;
    
    const shapeStyle: React.CSSProperties = {
      position: 'absolute',
      left: props.x,
      top: props.y,
      width: props.width,
      height: props.height,
      transform: `rotate(${props.rotation}deg)`,
      opacity: props.opacity / 100,
      backgroundColor: obj.type !== 'triangle' ? props.color : 'transparent',
      cursor: 'move',
    };

    if (obj.type === 'circle') {
      shapeStyle.borderRadius = '50%';
    }

    if (obj.type === 'triangle') {
      shapeStyle.width = 0;
      shapeStyle.height = 0;
      shapeStyle.backgroundColor = 'transparent';
      shapeStyle.borderLeft = `${props.width / 2}px solid transparent`;
      shapeStyle.borderRight = `${props.width / 2}px solid transparent`;
      shapeStyle.borderBottom = `${props.height}px solid ${props.color}`;
    }

    // Selection box wrapper
    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: props.x - 4,
      top: props.y - 4,
      width: props.width + 8,
      height: props.height + 8,
      transform: `rotate(${props.rotation}deg)`,
      pointerEvents: 'none',
    };

    return (
      <React.Fragment key={obj.id}>
        <div
          style={shapeStyle}
          onMouseDown={(e) => handleMouseDown(e, obj.id)}
        />
        {isSelected && (
          <div style={wrapperStyle}>
            {/* Dotted border */}
            <div 
              className="absolute inset-0 border-2 border-dashed border-primary pointer-events-none"
              style={{ borderColor: 'hsl(var(--primary))' }}
            />
            {/* Resize handles */}
            <div
              className="resize-handle -top-1.5 -left-1.5 cursor-nw-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'nw')}
            />
            <div
              className="resize-handle -top-1.5 -right-1.5 cursor-ne-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'ne')}
            />
            <div
              className="resize-handle -bottom-1.5 -left-1.5 cursor-sw-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'sw')}
            />
            <div
              className="resize-handle -bottom-1.5 -right-1.5 cursor-se-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, obj.id, 'se')}
            />
          </div>
        )}
      </React.Fragment>
    );
  };

  // Render objects in reverse order (first in array = on top)
  const reversedObjects = [...objects].reverse();

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>Render / Composition View</span>
        <span className="text-xs text-muted-foreground">
          Zoom: {Math.round(zoom * 100)}% | Alt+Drag to pan | Ctrl+Scroll to zoom
        </span>
      </div>
      <div
        ref={containerRef}
        className="panel-content relative flex-1 bg-muted/50 overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseDown={handlePanStart}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        {/* Scene container with fixed 1920x1080 */}
        <div
          ref={sceneRef}
          className="absolute bg-black shadow-2xl"
          style={{
            width: SCENE_WIDTH,
            height: SCENE_HEIGHT,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            left: '50%',
            top: '50%',
            marginLeft: -(SCENE_WIDTH * zoom) / 2 + pan.x,
            marginTop: -(SCENE_HEIGHT * zoom) / 2 + pan.y,
          }}
        >
          {/* Checkerboard pattern for transparency indication */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              opacity: 0.3,
            }}
          />
          {reversedObjects.map(renderShape)}
        </div>
      </div>
    </div>
  );
};
