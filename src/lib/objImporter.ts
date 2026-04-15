import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';

export interface ImportedOBJModel {
  id: string;
  name: string;
  fileName: string;
  geometry: SerializedGeometry;
  createdAt: number;
}

export interface SerializedGeometry {
  positions: number[];
  normals: number[];
  indices?: number[];
}

// Parse OBJ content from a string (for bundled/fetched models)
// Parse OBJ without normalization - keeps original coordinates
export const parseOBJContentRaw = (content: string): SerializedGeometry | null => {
  try {
    const loader = new OBJLoader();
    const object = loader.parse(content);

    let geometry: THREE.BufferGeometry | null = null;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && !geometry) {
        geometry = child.geometry as THREE.BufferGeometry;
      }
    });

    if (!geometry) return null;

    const positions = Array.from(geometry.attributes.position.array);
    const normals = geometry.attributes.normal
      ? Array.from(geometry.attributes.normal.array)
      : [];
    const indices = geometry.index
      ? Array.from(geometry.index.array)
      : undefined;

    return { positions, normals, indices };
  } catch (error) {
    console.error('Error parsing OBJ content (raw):', error);
    return null;
  }
};

export const parseOBJContent = (content: string): SerializedGeometry | null => {
  try {
    const loader = new OBJLoader();
    const object = loader.parse(content);

    let geometry: THREE.BufferGeometry | null = null;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && !geometry) {
        geometry = child.geometry as THREE.BufferGeometry;
      }
    });

    if (!geometry) return null;

    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1 / maxDim;

    const center = new THREE.Vector3();
    box.getCenter(center);

    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(scale, scale, scale);

    const positions = Array.from(geometry.attributes.position.array);
    const normals = geometry.attributes.normal
      ? Array.from(geometry.attributes.normal.array)
      : [];
    const indices = geometry.index
      ? Array.from(geometry.index.array)
      : undefined;

    return { positions, normals, indices };
  } catch (error) {
    console.error('Error parsing OBJ content:', error);
    return null;
  }
};

// Parse OBJ file content and extract geometry
export const parseOBJFile = async (file: File): Promise<SerializedGeometry | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const loader = new OBJLoader();
        const object = loader.parse(content);
        
        // Find the first mesh in the loaded object
        let geometry: THREE.BufferGeometry | null = null;
        
        object.traverse((child) => {
          if (child instanceof THREE.Mesh && !geometry) {
            geometry = child.geometry as THREE.BufferGeometry;
          }
        });
        
        if (!geometry) {
          resolve(null);
          return;
        }
        
        // Normalize geometry to fit in a unit box
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1 / maxDim;
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        // Center and scale the geometry
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.scale(scale, scale, scale);
        
        // Serialize geometry
        const positions = Array.from(geometry.attributes.position.array);
        const normals = geometry.attributes.normal 
          ? Array.from(geometry.attributes.normal.array)
          : [];
        const indices = geometry.index 
          ? Array.from(geometry.index.array)
          : undefined;
        
        resolve({ positions, normals, indices });
      } catch (error) {
        console.error('Error parsing OBJ file:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Parse multiple OBJ files from a directory selection
export const parseOBJFilesFromDirectory = async (
  files: FileList
): Promise<{ name: string; fileName: string; geometry: SerializedGeometry }[]> => {
  const results: { name: string; fileName: string; geometry: SerializedGeometry }[] = [];
  
  const objFiles = Array.from(files).filter(file => 
    file.name.toLowerCase().endsWith('.obj')
  );
  
  for (const file of objFiles) {
    try {
      const geometry = await parseOBJFile(file);
      if (geometry) {
        // Extract name from filename (remove extension and path)
        const fileName = file.name;
        const name = fileName.replace(/\.obj$/i, '').replace(/[_-]/g, ' ');
        
        results.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          fileName,
          geometry,
        });
      }
    } catch (error) {
      console.warn(`Failed to parse ${file.name}:`, error);
    }
  }
  
  return results;
};

// Deserialize geometry back to THREE.BufferGeometry
export const deserializeGeometry = (serialized: SerializedGeometry): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(serialized.positions, 3)
  );
  
  if (serialized.normals.length > 0) {
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(serialized.normals, 3)
    );
  } else {
    geometry.computeVertexNormals();
  }
  
  if (serialized.indices) {
    geometry.setIndex(serialized.indices);
  }
  
  return geometry;
};
