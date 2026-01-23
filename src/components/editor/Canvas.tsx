import React, { useRef, useState, useCallback, useMemo } from 'react';
import { EditorObject, ObjectProperties } from '@/types/editor';

interface CanvasProps {
  objects: EditorObject[];
  selectedObjectId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateProperties: (id: string, properties: Partial<ObjectProperties>) => void;
  getInterpolatedProperties: (object: EditorObject, time: number) => ObjectProperties;
  currentTime: number;
  backgroundImage: string | null;
  isPlaying: boolean;
}

// Component to render trajectory path for selected object
const TrajectoryPath: React.FC<{
  object: EditorObject;
  getInterpolatedProperties: (object: EditorObject, time: number) => ObjectProperties;
}> = ({ object, getInterpolatedProperties }) => {
  const trajectoryPoints = useMemo(() => {
    if (object.keyframes.length < 2) return null;
    
    const sortedKeyframes = [...object.keyframes].sort((a, b) => a.time - b.time);
    const startTime = sortedKeyframes[0].time;
    const endTime = sortedKeyframes[sortedKeyframes.length - 1].time;
    
    // Sample points along the trajectory
    const points: { x: number; y: number }[] = [];
    const steps = Math.max(50, Math.ceil((endTime - startTime) / 50)); // Sample every 50ms or more
    
    for (let i = 0; i <= steps; i++) {
      const t = startTime + (endTime - startTime) * (i / steps);
      const props = getInterpolatedProperties(object, t);
      points.push({
        x: props.x + props.width / 2,
        y: props.y + props.height / 2,
      });
    }
    
    return {
      points,
      start: points[0],
      end: points[points.length - 1],
    };
  }, [object, getInterpolatedProperties]);
  
  if (!trajectoryPoints) return null;
  
  const { points, start, end } = trajectoryPoints;
  
  // Create SVG path
  const pathD = points.reduce((acc, point, i) => {
    return acc + (i === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
  }, '');
  
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {/* Trajectory line */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      {/* Start square */}
      <rect
        x={start.x - 5}
        y={start.y - 5}
        width={10}
        height={10}
        fill="rgba(255, 255, 255, 0.8)"
        stroke="rgba(100, 100, 100, 0.8)"
        strokeWidth="1"
      />
      {/* End square */}
      <rect
        x={end.x - 5}
        y={end.y - 5}
        width={10}
        height={10}
        fill="rgba(200, 200, 200, 0.8)"
        stroke="rgba(100, 100, 100, 0.8)"
        strokeWidth="1"
      />
      {/* Keyframe markers */}
      {object.keyframes.map((kf, i) => {
        const props = getInterpolatedProperties(object, kf.time);
        const cx = props.x + props.width / 2;
        const cy = props.y + props.height / 2;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={4}
            fill="rgba(0, 212, 255, 0.9)"
            stroke="white"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
};

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

export const Canvas: React.FC<CanvasProps> = ({
  objects,
  selectedObjectId,
  onSelect,
  onUpdateProperties,
  getInterpolatedProperties,
  currentTime,
  backgroundImage,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, objX: 0, objY: 0, objW: 0, objH: 0 });
  
  // Zoom state
  const [zoom, setZoom] = useState(0.5);

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

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.scene === 'true') {
      onSelect(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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
  };

  const renderShape = (obj: EditorObject) => {
    // When playing, use interpolated. When not playing, use object.properties directly for immediate feedback
    const props = isPlaying 
      ? getInterpolatedProperties(obj, currentTime)
      : (selectedObjectId === obj.id ? obj.properties : getInterpolatedProperties(obj, currentTime));
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

  // Calculate scaled dimensions
  const scaledWidth = SCENE_WIDTH * zoom;
  const scaledHeight = SCENE_HEIGHT * zoom;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>Render / Composition View</span>
        <span className="text-xs text-muted-foreground">
          Zoom: {Math.round(zoom * 100)}% | Ctrl+Scroll to zoom
        </span>
      </div>
      <div 
        className="flex-1 overflow-auto"
        onWheel={handleWheel}
      >
        <div
          ref={containerRef}
          className="relative bg-muted/50 flex items-center justify-center"
          style={{ 
            minWidth: scaledWidth + 100,
            minHeight: scaledHeight + 100,
            width: 'fit-content',
            padding: 50,
          }}
          onClick={handleContainerClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Scene container with fixed 1920x1080 */}
          <div
            ref={sceneRef}
            data-scene="true"
            className="relative bg-black shadow-2xl flex-shrink-0"
            style={{
              width: scaledWidth,
              height: scaledHeight,
            }}
          >
            {/* Background image */}
            {backgroundImage && (
              <img
                src={backgroundImage}
                alt="Background"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{ objectFit: 'contain' }}
              />
            )}
            {/* Checkerboard pattern for transparency indication (only show if no background) */}
            {!backgroundImage && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  opacity: 0.3,
                }}
              />
            )}
            {/* Scaled content container */}
            {/* Trajectory visualization for selected object */}
            {selectedObjectId && (() => {
              const selectedObj = objects.find(o => o.id === selectedObjectId);
              if (selectedObj && selectedObj.keyframes.length >= 2) {
                return (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                      width: SCENE_WIDTH,
                      height: SCENE_HEIGHT,
                    }}
                  >
                    <TrajectoryPath
                      object={selectedObj}
                      getInterpolatedProperties={getInterpolatedProperties}
                    />
                  </div>
                );
              }
              return null;
            })()}
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: SCENE_WIDTH,
                height: SCENE_HEIGHT,
              }}
            >
              {reversedObjects.map(renderShape)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};