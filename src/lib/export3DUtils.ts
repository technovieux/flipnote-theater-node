import * as THREE from 'three';
import { EditorState, EditorObject3D, Object3DProperties, CameraPosition, Keyframe3D } from '@/types/editor';
import { interpolateColor } from '@/lib/colorUtils';

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

// Get interpolated 3D properties at a specific time
export const getInterpolatedProperties3DAt = (
  object: EditorObject3D,
  time: number,
  animatedMode: boolean = true
): Object3DProperties => {
  if (object.keyframes.length === 0) return object.properties;

  const sortedKeyframes = [...object.keyframes].sort((a, b) => a.time - b.time);

  let prevKf: Keyframe3D | null = null;
  let nextKf: Keyframe3D | null = null;

  for (const kf of sortedKeyframes) {
    if (kf.time <= time) {
      prevKf = kf;
    } else if (!nextKf && kf.time > time) {
      nextKf = kf;
      break;
    }
  }

  if (!prevKf && !nextKf) return object.properties;
  if (!prevKf) return nextKf!.properties;
  if (!nextKf) return prevKf.properties;

  if (!animatedMode) {
    return prevKf.properties;
  }

  const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);
  const interpolate = (a: number, b: number) => a + (b - a) * progress;

  return {
    x: interpolate(prevKf.properties.x, nextKf.properties.x),
    y: interpolate(prevKf.properties.y, nextKf.properties.y),
    z: interpolate(prevKf.properties.z, nextKf.properties.z),
    width: interpolate(prevKf.properties.width, nextKf.properties.width),
    height: interpolate(prevKf.properties.height, nextKf.properties.height),
    depth: interpolate(prevKf.properties.depth, nextKf.properties.depth),
    rotationX: interpolate(prevKf.properties.rotationX, nextKf.properties.rotationX),
    rotationY: interpolate(prevKf.properties.rotationY, nextKf.properties.rotationY),
    rotationZ: interpolate(prevKf.properties.rotationZ, nextKf.properties.rotationZ),
    opacity: interpolate(prevKf.properties.opacity, nextKf.properties.opacity),
    color: interpolateColor(prevKf.properties.color, nextKf.properties.color, progress),
  };
};

// Get interpolated camera position at a specific time
export const getInterpolatedCameraAt = (
  objects3D: EditorObject3D[],
  time: number,
  animatedMode: boolean = true
): CameraPosition | null => {
  // Collect all keyframes with camera data across all objects
  const allKeyframesWithCamera: Keyframe3D[] = [];
  
  for (const obj of objects3D) {
    for (const kf of obj.keyframes) {
      if (kf.camera) {
        allKeyframesWithCamera.push(kf);
      }
    }
  }

  if (allKeyframesWithCamera.length === 0) {
    return null;
  }

  // Sort by time
  allKeyframesWithCamera.sort((a, b) => a.time - b.time);

  let prevKf: Keyframe3D | null = null;
  let nextKf: Keyframe3D | null = null;

  for (const kf of allKeyframesWithCamera) {
    if (kf.time <= time) {
      prevKf = kf;
    } else if (!nextKf && kf.time > time) {
      nextKf = kf;
      break;
    }
  }

  if (!prevKf && !nextKf) return null;
  if (!prevKf) return nextKf!.camera!;
  if (!nextKf) return prevKf.camera!;

  if (!animatedMode) {
    return prevKf.camera!;
  }

  // Interpolate camera position
  const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);
  const interpolate = (a: number, b: number) => a + (b - a) * progress;

  const prevCam = prevKf.camera!;
  const nextCam = nextKf.camera!;

  return {
    position: {
      x: interpolate(prevCam.position.x, nextCam.position.x),
      y: interpolate(prevCam.position.y, nextCam.position.y),
      z: interpolate(prevCam.position.z, nextCam.position.z),
    },
    target: {
      x: interpolate(prevCam.target.x, nextCam.target.x),
      y: interpolate(prevCam.target.y, nextCam.target.y),
      z: interpolate(prevCam.target.z, nextCam.target.z),
    },
    fov: interpolate(prevCam.fov, nextCam.fov),
  };
};

// Render 3D scene to canvas using Three.js
export const render3DSceneToCanvas = async (
  state: EditorState,
  time: number,
  backgroundColor: string,
  includeOverlay: boolean = false
): Promise<HTMLCanvasElement> => {
  // Create offscreen renderer
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    preserveDrawingBuffer: true,
    alpha: true 
  });
  renderer.setSize(SCENE_WIDTH, SCENE_HEIGHT);
  renderer.setPixelRatio(1);

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // Get interpolated camera position
  const cameraPos = getInterpolatedCameraAt(state.objects3D, time, state.animatedMode);
  
  // Create camera with interpolated position
  const camera = new THREE.PerspectiveCamera(
    cameraPos?.fov || 50,
    SCENE_WIDTH / SCENE_HEIGHT,
    0.1,
    10000
  );

  if (cameraPos) {
    camera.position.set(cameraPos.position.x, cameraPos.position.y, cameraPos.position.z);
    camera.lookAt(cameraPos.target.x, cameraPos.target.y, cameraPos.target.z);
  } else {
    // Default camera position matching Canvas3D default
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
  }

  // Add grid helper for reference (matching Canvas3D scale)
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
  scene.add(gridHelper);

  // Add 3D objects with interpolated properties
  for (const obj of state.objects3D) {
    const props = getInterpolatedProperties3DAt(obj, time, state.animatedMode);
    const mesh = create3DMesh(obj.type, props);
    if (mesh) {
      scene.add(mesh);
    }
  }

  // Render
  renderer.render(scene, camera);

  // Get canvas with rendered scene
  const canvas = renderer.domElement;

  // Add overlay if requested
  if (includeOverlay) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Import overlay drawing is complex with WebGL canvas, we'll handle this differently
      // For now, we'll create a composite canvas
    }
  }

  // Create final canvas (for overlay if needed)
  if (includeOverlay) {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = SCENE_WIDTH;
    finalCanvas.height = SCENE_HEIGHT;
    const ctx = finalCanvas.getContext('2d')!;
    
    // Draw 3D render
    ctx.drawImage(canvas, 0, 0);
    
    // Draw overlay
    drawOverlay(ctx, state, time);
    
    // Cleanup
    renderer.dispose();
    
    return finalCanvas;
  }

  // Cleanup Three.js resources
  renderer.dispose();
  
  // Return the canvas (need to copy it since renderer will be disposed)
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = SCENE_WIDTH;
  resultCanvas.height = SCENE_HEIGHT;
  const ctx = resultCanvas.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  
  return resultCanvas;
};

// Create 3D mesh based on type and properties
const create3DMesh = (type: string, props: Object3DProperties): THREE.Mesh | null => {
  let geometry: THREE.BufferGeometry;

  // Use unit geometries + scale, matching Canvas3D (which divides by 100)
  switch (type) {
    case 'cube':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.5, 32, 32);
      break;
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      break;
    case 'cone':
      geometry = new THREE.ConeGeometry(0.5, 1, 32);
      break;
    case 'torus':
      geometry = new THREE.TorusGeometry(0.35, 0.15, 16, 48);
      break;
    case 'pyramid':
      geometry = new THREE.ConeGeometry(0.5, 1, 4);
      break;
    case 'octahedron':
      geometry = new THREE.OctahedronGeometry(0.5);
      break;
    case 'dodecahedron':
      geometry = new THREE.DodecahedronGeometry(0.5);
      break;
    case 'icosahedron':
      geometry = new THREE.IcosahedronGeometry(0.5);
      break;
    case 'tetrahedron':
      geometry = new THREE.TetrahedronGeometry(0.5);
      break;
    case 'torusknot':
      geometry = new THREE.TorusKnotGeometry(0.3, 0.1, 100, 16);
      break;
    case 'capsule':
      geometry = new THREE.CapsuleGeometry(0.3, 0.5, 4, 16);
      break;
    case 'ring':
      geometry = new THREE.RingGeometry(0.3, 0.5, 32);
      break;
    case 'tube':
      geometry = new THREE.TorusGeometry(0.4, 0.1, 8, 32);
      break;
    case 'table':
      geometry = new THREE.BoxGeometry(1.5, 0.1, 1);
      break;
    case 'chair':
      geometry = new THREE.BoxGeometry(0.5, 0.8, 0.5);
      break;
    case 'tree':
      geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
      break;
    case 'house':
      geometry = new THREE.BoxGeometry(1, 0.8, 1);
      break;
    case 'car':
      geometry = new THREE.BoxGeometry(1, 0.4, 0.5);
      break;
    case 'lamp':
      geometry = new THREE.CylinderGeometry(0.1, 0.3, 0.6, 16);
      break;
    case 'bottle':
      geometry = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 16);
      break;
    case 'cup':
      geometry = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 16);
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(props.color),
    transparent: props.opacity < 100,
    opacity: props.opacity / 100,
  });

  const mesh = new THREE.Mesh(geometry, material);
  
  // Position: match Canvas3D coordinate system (divide by 100, Z-up swap)
  mesh.position.set(
    props.x / 100,
    props.z / 100,    // Z becomes Y (up)
    -props.y / 100    // Y becomes -Z (forward)
  );
  
  // Scale: match Canvas3D (divide by 100)
  mesh.scale.set(
    props.width / 100,
    props.depth / 100,
    props.height / 100
  );
  
  // Rotation (in radians, matching Canvas3D swap)
  mesh.rotation.set(
    THREE.MathUtils.degToRad(props.rotationX),
    THREE.MathUtils.degToRad(props.rotationZ),
    THREE.MathUtils.degToRad(-props.rotationY)
  );

  return mesh;
};

// Draw overlay with scene info
const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  time: number
) => {
  const scene = getSceneAtTime(state.scenes, time);
  const modificationDate = new Date().toLocaleString('fr-FR');

  ctx.save();

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, 400, 120);

  // Text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Scène ${scene.number}`, 20, 35);

  ctx.font = '20px sans-serif';
  ctx.fillText(scene.name, 20, 60);
  ctx.fillText(formatTimecode(time), 20, 85);
  ctx.fillText(modificationDate, 20, 110);

  ctx.restore();
};

// Get scene at a given time
const getSceneAtTime = (scenes: { time: number; number: number; name: string }[], time: number) => {
  const sortedScenes = [...scenes].sort((a, b) => a.time - b.time);
  let currentScene = { number: 0, name: 'Sans titre' };

  for (const scene of sortedScenes) {
    if (scene.time <= time) {
      currentScene = { number: scene.number, name: scene.name };
    } else {
      break;
    }
  }

  return currentScene;
};

// Format timecode
const formatTimecode = (ms: number): string => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const frames = Math.floor((ms % 1000) / 40); // 25fps

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

// Get all unique keyframe times for 3D objects
export const getAllKeyframeTimes3D = (state: EditorState): number[] => {
  const times = new Set<number>();
  times.add(0); // Always include start

  for (const obj of state.objects3D) {
    for (const kf of obj.keyframes) {
      times.add(kf.time);
    }
  }

  return Array.from(times).sort((a, b) => a - b);
};
