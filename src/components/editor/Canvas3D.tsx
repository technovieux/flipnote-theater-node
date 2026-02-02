import React, { useRef, useState, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EditorObject3D, Object3DProperties, CameraPosition, CustomGeometry } from '@/types/editor';
import { setCameraPosition } from '@/hooks/useEditorState';
import { Move, ZoomIn, ZoomOut, RotateCcw, Hand, MousePointer } from 'lucide-react';
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
  customGeometry?: CustomGeometry;
}

// Helper to create extruded shape geometry from points
const createExtrudedGeometry = (customGeom: CustomGeometry): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape();
  const points = customGeom.points;
  
  if (points.length > 0) {
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }
    shape.closePath();
  }
  
  const extrudeSettings = {
    depth: customGeom.depth / 100,
    bevelEnabled: customGeom.bevelEnabled || false,
    bevelThickness: customGeom.bevelThickness || 0.02,
    bevelSize: customGeom.bevelSize || 0.02,
    bevelSegments: 3,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

// Create gear geometry
const createGearGeometry = (): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape();
  const teeth = 8;
  const outerRadius = 1;
  const innerRadius = 0.7;
  const toothWidth = 0.2;
  
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const nextAngle = ((i + 1) / teeth) * Math.PI * 2;
    const midAngle = angle + (nextAngle - angle) * 0.25;
    const endMidAngle = angle + (nextAngle - angle) * 0.75;
    
    if (i === 0) {
      shape.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    }
    shape.lineTo(Math.cos(midAngle) * innerRadius, Math.sin(midAngle) * innerRadius);
    shape.lineTo(Math.cos(midAngle) * outerRadius, Math.sin(midAngle) * outerRadius);
    shape.lineTo(Math.cos(endMidAngle) * outerRadius, Math.sin(endMidAngle) * outerRadius);
    shape.lineTo(Math.cos(endMidAngle) * innerRadius, Math.sin(endMidAngle) * innerRadius);
    shape.lineTo(Math.cos(nextAngle) * innerRadius, Math.sin(nextAngle) * innerRadius);
  }
  
  // Add center hole
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, 0.2, 0, Math.PI * 2, true);
  shape.holes.push(holePath);
  
  return new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
};

// Create stairs geometry
const createStairsGeometry = (): THREE.BufferGeometry => {
  const group = new THREE.Group();
  const steps = 5;
  const stepWidth = 1;
  const stepHeight = 0.2;
  const stepDepth = 0.3;
  
  const geometry = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
  const mergedGeometry = new THREE.BufferGeometry();
  const geometries: THREE.BufferGeometry[] = [];
  
  for (let i = 0; i < steps; i++) {
    const stepGeom = geometry.clone();
    stepGeom.translate(0, i * stepHeight + stepHeight / 2, i * stepDepth);
    geometries.push(stepGeom);
  }
  
  return mergeBufferGeometries(geometries);
};

// Simple merge for buffer geometries
const mergeBufferGeometries = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const merged = new THREE.BufferGeometry();
  let totalVertices = 0;
  let totalIndices = 0;
  
  geometries.forEach(geom => {
    totalVertices += geom.attributes.position.count;
    if (geom.index) totalIndices += geom.index.count;
  });
  
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  let posOffset = 0;
  
  geometries.forEach(geom => {
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal?.array;
    
    for (let i = 0; i < pos.length; i++) {
      positions[posOffset + i] = pos[i];
      if (norm) normals[posOffset + i] = norm[i];
    }
    posOffset += pos.length;
  });
  
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.computeVertexNormals();
  
  return merged;
};

const Shape3D: React.FC<Shape3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  isPlaying,
  controlsRef,
  customGeometry,
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

  // Z-up coordinate system: swap Y and Z for display
  const position: [number, number, number] = [
    properties.x / 100,
    properties.z / 100, // Z becomes Y (up)
    -properties.y / 100, // Y becomes -Z (forward)
  ];

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(properties.rotationX),
    THREE.MathUtils.degToRad(properties.rotationZ),
    THREE.MathUtils.degToRad(-properties.rotationY),
  ];

  const scale: [number, number, number] = [
    properties.width / 100,
    properties.depth / 100,
    properties.height / 100,
  ];

  // Memoize custom geometry
  const extrudedGeom = useMemo(() => {
    if (customGeometry || object.customGeometry) {
      return createExtrudedGeometry(customGeometry || object.customGeometry!);
    }
    return null;
  }, [customGeometry, object.customGeometry]);

  const renderGeometry = () => {
    // Custom geometry takes priority
    if (extrudedGeom) {
      return <primitive object={extrudedGeom} attach="geometry" />;
    }

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
      // Geometric shapes
      case 'pyramid':
        return <coneGeometry args={[0.5, 1, 4]} />;
      case 'octahedron':
        return <octahedronGeometry args={[0.5]} />;
      case 'dodecahedron':
        return <dodecahedronGeometry args={[0.5]} />;
      case 'icosahedron':
        return <icosahedronGeometry args={[0.5]} />;
      case 'tetrahedron':
        return <tetrahedronGeometry args={[0.5]} />;
      case 'torusknot':
        return <torusKnotGeometry args={[0.3, 0.1, 100, 16]} />;
      case 'capsule':
        return <capsuleGeometry args={[0.3, 0.5, 4, 16]} />;
      case 'ring':
        return <ringGeometry args={[0.3, 0.5, 32]} />;
      case 'tube':
        return <torusGeometry args={[0.4, 0.1, 8, 32]} />;
      // Stairs
      case 'stairs':
        return <primitive object={createStairsGeometry()} attach="geometry" />;
      // Gear
      case 'gear':
        return <primitive object={createGearGeometry()} attach="geometry" />;
      // Everyday objects - composed forms
      case 'table':
        return <boxGeometry args={[1.5, 0.1, 1]} />; // Simplified as a box
      case 'chair':
        return <boxGeometry args={[0.5, 0.8, 0.5]} />; // Simplified
      case 'tree':
        return <coneGeometry args={[0.5, 1.5, 8]} />; // Simplified as cone
      case 'house':
        return <boxGeometry args={[1, 0.8, 1]} />; // Simplified as box
      case 'car':
        return <boxGeometry args={[1, 0.4, 0.5]} />; // Simplified
      case 'lamp':
        return <cylinderGeometry args={[0.1, 0.3, 0.6, 16]} />; // Simplified
      case 'bottle':
        return <cylinderGeometry args={[0.15, 0.2, 0.8, 16]} />;
      case 'cup':
        return <cylinderGeometry args={[0.2, 0.15, 0.3, 16]} />;
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

// Component to track camera position
const CameraTracker: React.FC = () => {
  const { camera } = useThree();
  
  useEffect(() => {
    const updateCameraPosition = () => {
      const target = new THREE.Vector3(0, 0, 0);
      setCameraPosition({
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: target.x, y: target.y, z: target.z },
        fov: (camera as THREE.PerspectiveCamera).fov || 50,
      });
    };
    
    updateCameraPosition();
    const interval = setInterval(updateCameraPosition, 100);
    
    return () => clearInterval(interval);
  }, [camera]);
  
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
}

const NavigationControls: React.FC<NavigationControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  mode,
  onModeChange,
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
  const [navMode, setNavMode] = useState<'select' | 'pan' | 'rotate'>('select');
  const [cameraState, setCameraState] = useState({ zoom: 1 });

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
        />
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50, up: [0, 1, 0] }}
          onPointerMissed={handleBackgroundClick}
        >
          <Suspense fallback={null}>
            <CameraTracker />
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
                <Shape3D
                  key={obj.id}
                  object={obj}
                  properties={props}
                  isSelected={selectedObjectId === obj.id}
                  onSelect={() => onSelect(obj.id)}
                  onUpdateProperties={(p) => onUpdateProperties(obj.id, p)}
                  isPlaying={isPlaying}
                  controlsRef={controlsRef}
                  customGeometry={obj.customGeometry}
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
