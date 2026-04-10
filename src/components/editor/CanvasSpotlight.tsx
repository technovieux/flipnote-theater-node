import React, { useRef, useState, useCallback, useMemo } from 'react';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import { SpotlightSimulation } from './SpotlightSimulation';

interface CanvasSpotlightProps {
  objects: EditorObject3D[];
  selectedObjectIds: string[];
  onSelect: (id: string | null, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  onUpdateProperties: (id: string, properties: Partial<Object3DProperties>) => void;
  getInterpolatedProperties: (object: EditorObject3D, time: number) => Object3DProperties;
  currentTime: number;
  backgroundImage: string | null;
  isPlaying: boolean;
}

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

export const CanvasSpotlight: React.FC<CanvasSpotlightProps> = ({
  objects,
  selectedObjectIds,
  onSelect,
  onUpdateProperties,
  getInterpolatedProperties,
  currentTime,
  backgroundImage,
  isPlaying,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, objX: 0, objY: 0 });
  const [dragInitialPositions, setDragInitialPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [zoom, setZoom] = useState(0.5);

  // Filter only spotlight objects
  const spotlightObjects = useMemo(() => {
    return objects.filter(obj => obj.type === 'spotlight' && obj.spotlightProduct);
  }, [objects]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.1, Math.min(3, prev + delta)));
    }
  }, []);

  const getSceneCoordinates = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent, objId: string) => {
    e.stopPropagation();
    
    const isAlreadySelected = selectedObjectIds.includes(objId);
    
    if (e.ctrlKey || e.metaKey) {
      onSelect(objId, { ctrlKey: true });
      return;
    }
    
    if (e.shiftKey) {
      onSelect(objId, { shiftKey: true });
      return;
    }
    
    if (!isAlreadySelected) {
      onSelect(objId);
    }
    
    const coords = getSceneCoordinates(e.clientX, e.clientY);
    if (!coords) return;
    
    const obj = spotlightObjects.find(o => o.id === objId);
    if (!obj) return;
    
    const props = getInterpolatedProperties(obj, currentTime);
    
    setDragging(objId);
    setDragStart({
      x: coords.x,
      y: coords.y,
      objX: props.x,
      objY: props.y,
    });
    
    const activeIds = isAlreadySelected ? selectedObjectIds : [objId];
    const positions = new Map<string, { x: number; y: number }>();
    activeIds.forEach(id => {
      const o = spotlightObjects.find(ob => ob.id === id);
      if (o) {
        const p = getInterpolatedProperties(o, currentTime);
        positions.set(id, { x: p.x, y: p.y });
      }
    });
    setDragInitialPositions(positions);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'rect') {
      onSelect(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const coords = getSceneCoordinates(e.clientX, e.clientY);
      if (!coords) return;
      
      const deltaX = coords.x - dragStart.x;
      const deltaY = coords.y - dragStart.y;
      
      dragInitialPositions.forEach((initPos, id) => {
        onUpdateProperties(id, {
          x: initPos.x + deltaX,
          y: initPos.y + deltaY,
        });
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setDragInitialPositions(new Map());
  };

  const scaledWidth = SCENE_WIDTH * zoom;
  const scaledHeight = SCENE_HEIGHT * zoom;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>Spotlight Layout</span>
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
          {/* SVG Scene */}
          <svg
            ref={svgRef}
            className="flex-shrink-0 shadow-2xl"
            width={scaledWidth}
            height={scaledHeight}
            viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <defs>
              <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background checkerboard */}
            <defs>
              <pattern id="checkerboard" patternUnits="userSpaceOnUse" width="40" height="40">
                <rect x="0" y="0" width="40" height="40" fill="#0a0a0a" />
                <rect x="0" y="0" width="20" height="20" fill="#1a1a1a" />
                <rect x="20" y="20" width="20" height="20" fill="#1a1a1a" />
              </pattern>
            </defs>
            <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill="url(#checkerboard)" />

            {/* Spotlight objects */}
            {spotlightObjects.map(obj => {
              const props = isPlaying 
                ? getInterpolatedProperties(obj, currentTime)
                : (selectedObjectIds.includes(obj.id) ? obj.properties : getInterpolatedProperties(obj, currentTime));
              
              const isSelected = selectedObjectIds.includes(obj.id);

              return (
                <g key={obj.id}>
                  {/* Spotlight rect */}
                  <g
                    style={{ cursor: 'move' }}
                    onClick={() => {}}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleMouseDown(e as any, obj.id);
                    }}
                  >
                    <rect
                      x={props.x - props.width / 2}
                      y={props.y - props.height / 2}
                      width={props.width}
                      height={props.height}
                      fill={props.color}
                      opacity={0.6}
                      rx="4"
                      stroke={isSelected ? '#3b82f6' : props.color}
                      strokeWidth={isSelected ? '3' : '1'}
                    />

                    {/* Label */}
                    <text
                      x={props.x}
                      y={props.y + props.height / 2 + 25}
                      textAnchor="middle"
                      fontSize="14"
                      fill="white"
                      opacity="0.8"
                      pointerEvents="none"
                    >
                      {obj.spotlightAddress} {obj.name}
                    </text>
                  </g>

                  {/* Selection indicator */}
                  {isSelected && (
                    <rect
                      x={props.x - props.width / 2 - 6}
                      y={props.y - props.height / 2 - 6}
                      width={props.width + 12}
                      height={props.height + 12}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      rx="4"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

            {/* Spotlight Simulation (animations) */}
            {isPlaying && (
              <SpotlightSimulation
                objects={spotlightObjects}
                currentTime={currentTime}
                isPlaying={isPlaying}
                canvasWidth={SCENE_WIDTH}
                canvasHeight={SCENE_HEIGHT}
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
