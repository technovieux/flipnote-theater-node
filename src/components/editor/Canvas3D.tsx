import React, { useRef, useState, Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport, TransformControls } from '@react-three/drei';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
import { setCameraPosition } from '@/hooks/useEditorState';
import { Move, ZoomIn, ZoomOut, RotateCcw, Hand, MousePointer, Move3d, RotateCw, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import * as THREE from 'three';

interface Canvas3DProps {
  objects: EditorObject3D[];
  selectedObjectId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateProperties: (id: string, properties: Partial<Object3DProperties>) => void;
  getInterpolatedProperties: (object: EditorObject3D, time: number) => Object3DProperties;
  currentTime: number;
  isPlaying: boolean;
}

interface Shape3DProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
  isPlaying: boolean;
  controlsRef: React.RefObject<any>;
}

const Shape3D: React.FC<Shape3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  isPlaying,
  controlsRef,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const dragOffsetRef = useRef(new THREE.Vector3());
  const { camera, raycaster } = useThree();

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect();
    if (!isPlaying && meshRef.current) {
      // Disable orbit controls while dragging
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
      setIsDragging(true);
      
      // Create a plane facing the camera for dragging
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        cameraDirection.negate(),
        meshRef.current.position
      );
      
      // Calculate offset from intersection point to object center
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlaneRef.current, intersectionPoint);
      dragOffsetRef.current.subVectors(meshRef.current.position, intersectionPoint);
      
      (e.target as any).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: any) => {
    if (isDragging && !isPlaying) {
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlaneRef.current, intersectionPoint);
      
      if (intersectionPoint) {
        const newPosition = intersectionPoint.add(dragOffsetRef.current);
        onUpdateProperties({
          x: newPosition.x * 100,
          y: newPosition.y * 100,
          z: newPosition.z * 100,
        });
      }
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // Re-enable orbit controls
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
  };

  // Standard Three.js Y-up coordinate system (matches gizmo)
  const position: [number, number, number] = [
    properties.x / 100,
    properties.y / 100,
    properties.z / 100,
  ];

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(properties.rotationX),
    THREE.MathUtils.degToRad(properties.rotationY),
    THREE.MathUtils.degToRad(properties.rotationZ),
  ];

  const scale: [number, number, number] = [
    properties.width / 100,
    properties.height / 100,
    properties.depth / 100,
  ];

  const renderGeometry = () => {
    switch (object.type) {
      case 'cube':
        return <boxGeometry args={[1, 1, 1]} />;
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'cone':
        return <coneGeometry args={[0.5, 1, 32]} />;
      case 'torus':
        return <torusGeometry args={[0.35, 0.15, 16, 48]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {renderGeometry()}
      <meshStandardMaterial
        color={properties.color}
        transparent
        opacity={properties.opacity / 100}
        metalness={0.1}
        roughness={0.5}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(1.05, 1.05, 1.05)]} />
          <lineBasicMaterial color="#00d4ff" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
};

// TransformControls wrapper component
interface TransformableObjectProps {
  object: EditorObject3D;
  properties: Object3DProperties;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
  isPlaying: boolean;
  controlsRef: React.RefObject<any>;
  transformMode: 'translate' | 'rotate' | 'scale';
}

const TransformableObject: React.FC<TransformableObjectProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  isPlaying,
  controlsRef,
  transformMode,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformControlsRef = useRef<any>(null);

  // Handle transform changes
  const handleTransformChange = () => {
    if (!meshRef.current || isPlaying) return;
    
    const mesh = meshRef.current;
    
    if (transformMode === 'translate') {
      onUpdateProperties({
        x: mesh.position.x * 100,
        y: mesh.position.y * 100,
        z: mesh.position.z * 100,
      });
    } else if (transformMode === 'rotate') {
      onUpdateProperties({
        rotationX: THREE.MathUtils.radToDeg(mesh.rotation.x),
        rotationY: THREE.MathUtils.radToDeg(mesh.rotation.y),
        rotationZ: THREE.MathUtils.radToDeg(mesh.rotation.z),
      });
    } else if (transformMode === 'scale') {
      onUpdateProperties({
        width: mesh.scale.x * 100,
        height: mesh.scale.y * 100,
        depth: mesh.scale.z * 100,
      });
    }
  };

  // Disable orbit controls when dragging transform
  useEffect(() => {
    if (!transformControlsRef.current || !controlsRef.current) return;
    
    const controls = transformControlsRef.current;
    
    const handleDraggingChanged = (event: any) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
    };
    
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [controlsRef]);

  // Position, rotation, scale
  const position: [number, number, number] = [
    properties.x / 100,
    properties.y / 100,
    properties.z / 100,
  ];

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(properties.rotationX),
    THREE.MathUtils.degToRad(properties.rotationY),
    THREE.MathUtils.degToRad(properties.rotationZ),
  ];

  const scale: [number, number, number] = [
    properties.width / 100,
    properties.height / 100,
    properties.depth / 100,
  ];

  const renderGeometry = () => {
    switch (object.type) {
      case 'cube':
        return <boxGeometry args={[1, 1, 1]} />;
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'cone':
        return <coneGeometry args={[0.5, 1, 32]} />;
      case 'torus':
        return <torusGeometry args={[0.35, 0.15, 16, 48]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {renderGeometry()}
        <meshStandardMaterial
          color={properties.color}
          transparent
          opacity={properties.opacity / 100}
          metalness={0.1}
          roughness={0.5}
        />
        {isSelected && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(1.05, 1.05, 1.05)]} />
            <lineBasicMaterial color="#00d4ff" linewidth={2} />
          </lineSegments>
        )}
      </mesh>
      {isSelected && !isPlaying && meshRef.current && (
        <TransformControls
          ref={transformControlsRef}
          object={meshRef.current}
          mode={transformMode}
          size={0.75}
          onObjectChange={handleTransformChange}
        />
      )}
    </>
  );
}

// Component to track camera position (used when creating 3D keyframes)
const CameraTracker: React.FC<{ controlsRef: React.RefObject<any> }> = ({
  controlsRef,
}) => {
  const { camera } = useThree();

  useEffect(() => {
    const updateCameraPosition = () => {
      const target = controlsRef.current?.target
        ? (controlsRef.current.target as THREE.Vector3)
        : new THREE.Vector3(0, 0, 0);

      setCameraPosition({
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: target.x, y: target.y, z: target.z },
        fov: (camera as THREE.PerspectiveCamera).fov || 50,
      });
    };

    updateCameraPosition();
    const interval = setInterval(updateCameraPosition, 100);

    return () => clearInterval(interval);
  }, [camera, controlsRef]);

  return null;
};

// Navigation controls component
interface NavigationControlsProps {
  controlsRef: React.RefObject<any>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  mode: 'select' | 'pan' | 'rotate';
  onModeChange: (mode: 'select' | 'pan' | 'rotate') => void;
  transformMode: 'translate' | 'rotate' | 'scale';
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  hasSelection: boolean;
}

const NavigationControls: React.FC<NavigationControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  mode,
  onModeChange,
  transformMode,
  onTransformModeChange,
  hasSelection,
}) => {
  return (
    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === 'select' ? 'default' : 'secondary'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onModeChange('select')}
          >
            <MousePointer className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Sélectionner / Déplacer objets</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === 'pan' ? 'default' : 'secondary'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onModeChange('pan')}
          >
            <Hand className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Déplacer la vue (Pan)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === 'rotate' ? 'default' : 'secondary'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onModeChange('rotate')}
          >
            <Move className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Rotation de la vue</TooltipContent>
      </Tooltip>
      
      {/* Transform mode buttons - only show when object selected */}
      {hasSelection && (
        <>
          <div className="h-px bg-border my-1" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={transformMode === 'translate' ? 'default' : 'secondary'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onTransformModeChange('translate')}
              >
                <Move3d className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Déplacer (G)</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={transformMode === 'rotate' ? 'default' : 'secondary'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onTransformModeChange('rotate')}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Rotation (R)</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={transformMode === 'scale' ? 'default' : 'secondary'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onTransformModeChange('scale')}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Échelle (S)</TooltipContent>
          </Tooltip>
        </>
      )}
      
      <div className="h-px bg-border my-1" />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={onZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom avant</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={onZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom arrière</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={onResetView}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Réinitialiser la vue</TooltipContent>
      </Tooltip>
    </div>
  );
};

// Camera controller inside Canvas
interface CameraControllerProps {
  controlsRef: React.RefObject<any>;
  mode: 'select' | 'pan' | 'rotate';
}

const CameraController: React.FC<CameraControllerProps> = ({ controlsRef, mode }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    if (controlsRef.current) {
      // In select mode, disable orbit controls mouse buttons except scroll
      if (mode === 'select') {
        controlsRef.current.enableRotate = false;
        controlsRef.current.enablePan = false;
        controlsRef.current.enableZoom = true;
      } else if (mode === 'pan') {
        controlsRef.current.enableRotate = false;
        controlsRef.current.enablePan = true;
        controlsRef.current.enableZoom = true;
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
      } else if (mode === 'rotate') {
        controlsRef.current.enableRotate = true;
        controlsRef.current.enablePan = false;
        controlsRef.current.enableZoom = true;
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        };
      }
    }
  }, [mode, controlsRef]);
  
  return null;
};

export const Canvas3D: React.FC<Canvas3DProps> = ({
  objects,
  selectedObjectId,
  onSelect,
  onUpdateProperties,
  getInterpolatedProperties,
  currentTime,
  isPlaying,
}) => {
  const controlsRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const [navMode, setNavMode] = useState<'select' | 'pan' | 'rotate'>('select');
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [cameraState, setCameraState] = useState({ zoom: 1 });

  // Keyboard shortcuts for transform modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedObjectId) return;
      if (e.key === 'g' || e.key === 'G') {
        setTransformMode('translate');
      } else if (e.key === 'r' || e.key === 'R') {
        setTransformMode('rotate');
      } else if (e.key === 's' || e.key === 'S') {
        setTransformMode('scale');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId]);

  // Get selected object for TransformControls
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  const handleBackgroundClick = () => {
    onSelect(null);
  };

  const handleZoomIn = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.multiplyScalar(0.8);
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.multiplyScalar(1.25);
      controlsRef.current.update();
    }
  };

  const handleResetView = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.set(5, 5, 5);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const getModeLabel = () => {
    switch (navMode) {
      case 'select': return 'Mode: Sélection | Molette: zoom';
      case 'pan': return 'Mode: Déplacement | Clic: pan | Molette: zoom';
      case 'rotate': return 'Mode: Rotation | Clic: orbite | Molette: zoom';
    }
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>Vue 3D</span>
        <span className="text-xs text-muted-foreground">
          {getModeLabel()}
        </span>
      </div>
      <div className="flex-1 bg-background relative">
        <NavigationControls
          controlsRef={controlsRef}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          mode={navMode}
          onModeChange={setNavMode}
          transformMode={transformMode}
          onTransformModeChange={setTransformMode}
          hasSelection={!!selectedObjectId}
        />
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50, up: [0, 1, 0] }}
          onPointerMissed={handleBackgroundClick}
        >
          <Suspense fallback={null}>
            <CameraTracker controlsRef={controlsRef} />
            <CameraController controlsRef={controlsRef} mode={navMode} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            
            <Environment preset="studio" />
            
            {/* Grid on XY plane (Z-up) */}
            <Grid
              args={[20, 20]}
              position={[0, 0, 0]}
              rotation={[0, 0, 0]}
              cellSize={0.5}
              cellThickness={0.5}
              cellColor="#444"
              sectionSize={2}
              sectionThickness={1}
              sectionColor="#666"
              fadeDistance={30}
              fadeStrength={1}
              followCamera={false}
            />
            
            {objects.map((obj) => {
              const props = isPlaying
                ? getInterpolatedProperties(obj, currentTime)
                : (selectedObjectId === obj.id ? obj.properties : getInterpolatedProperties(obj, currentTime));
              
              return (
                <TransformableObject
                  key={obj.id}
                  object={obj}
                  properties={props}
                  isSelected={selectedObjectId === obj.id}
                  onSelect={() => onSelect(obj.id)}
                  onUpdateProperties={(p) => onUpdateProperties(obj.id, p)}
                  isPlaying={isPlaying}
                  controlsRef={controlsRef}
                  transformMode={transformMode}
                />
              );
            })}
            
            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              makeDefault
            />
            
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={['#f44', '#4f4', '#44f']} labelColor="white" />
            </GizmoHelper>
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
};
