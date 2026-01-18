import React, { useRef, useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EditorObject3D, Object3DProperties } from '@/types/editor';
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
}

const Shape3D: React.FC<Shape3DProps> = ({
  object,
  properties,
  isSelected,
  onSelect,
  onUpdateProperties,
  isPlaying,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, z: 0 });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect();
    if (!isPlaying) {
      setIsDragging(true);
      setDragStart({ x: properties.x, y: properties.y, z: properties.z });
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: any) => {
    if (isDragging && !isPlaying) {
      const deltaX = (e.point.x - dragStart.x);
      const deltaY = (e.point.y - dragStart.y);
      onUpdateProperties({
        x: e.point.x,
        y: e.point.y,
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

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

export const Canvas3D: React.FC<Canvas3DProps> = ({
  objects,
  selectedObjectId,
  onSelect,
  onUpdateProperties,
  getInterpolatedProperties,
  currentTime,
  isPlaying,
}) => {
  const handleBackgroundClick = () => {
    onSelect(null);
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>Vue 3D</span>
        <span className="text-xs text-muted-foreground">
          Clic gauche: rotation | Clic droit: déplacer | Molette: zoom
        </span>
      </div>
      <div className="flex-1 bg-background">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          onPointerMissed={handleBackgroundClick}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            
            <Environment preset="studio" />
            
            <Grid
              args={[20, 20]}
              position={[0, -0.01, 0]}
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
                />
              );
            })}
            
            <OrbitControls
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
