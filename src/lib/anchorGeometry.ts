import * as THREE from 'three';
import { EditorObject3D, OBJGeometry, CustomGeometry } from '@/types/editor';
import { Anchor, AnchorSource } from '@/types/drone';

const genId = () => Math.random().toString(36).slice(2, 10);

// Build a unit-sized THREE geometry that mirrors what Canvas3D renders for an object.
// Anchors are computed in local geometry space; world placement is handled by the object's transform.
export const getLocalGeometry = (obj: EditorObject3D): THREE.BufferGeometry | null => {
  if (obj.objGeometry) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(obj.objGeometry.positions, 3));
    if (obj.objGeometry.indices) g.setIndex(obj.objGeometry.indices);
    g.computeVertexNormals();
    return g;
  }
  if (obj.customGeometry) {
    const shape = new THREE.Shape();
    const pts = obj.customGeometry.points;
    if (pts.length) {
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
      shape.closePath();
    }
    return new THREE.ExtrudeGeometry(shape, {
      depth: obj.customGeometry.depth / 100,
      bevelEnabled: !!obj.customGeometry.bevelEnabled,
    });
  }
  switch (obj.type) {
    case 'cube':
      return new THREE.BoxGeometry(1, 1, 1);
    case 'sphere':
      return new THREE.SphereGeometry(0.5, 16, 16);
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    case 'cone':
    case 'pyramid':
      return new THREE.ConeGeometry(0.5, 1, obj.type === 'pyramid' ? 4 : 16);
    case 'torus':
      return new THREE.TorusGeometry(0.35, 0.15, 12, 24);
    case 'octahedron':
      return new THREE.OctahedronGeometry(0.5);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(0.5);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(0.5);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(0.5);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.3, 0.5, 4, 12);
    default:
      return null;
  }
};

const dedupVertices = (g: THREE.BufferGeometry): { positions: THREE.Vector3[]; faces: number[][] } => {
  const posAttr = g.getAttribute('position') as THREE.BufferAttribute;
  const idx = g.getIndex();
  const map = new Map<string, number>();
  const positions: THREE.Vector3[] = [];
  const remap: number[] = [];
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const k = `${round(x)}|${round(y)}|${round(z)}`;
    let id = map.get(k);
    if (id === undefined) {
      id = positions.length;
      map.set(k, id);
      positions.push(new THREE.Vector3(x, y, z));
    }
    remap[i] = id;
  }
  const faces: number[][] = [];
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = remap[idx.getX(i)];
      const b = remap[idx.getX(i + 1)];
      const c = remap[idx.getX(i + 2)];
      if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      const a = remap[i], b = remap[i + 1], c = remap[i + 2];
      if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
    }
  }
  return { positions, faces };
};

const uniqueEdges = (faces: number[][]): [number, number][] => {
  const set = new Set<string>();
  const edges: [number, number][] = [];
  for (const [a, b, c] of faces) {
    [[a, b], [b, c], [c, a]].forEach(([u, v]) => {
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (!set.has(key)) {
        set.add(key);
        edges.push([u, v]);
      }
    });
  }
  return edges;
};

export interface AnchorGenOptions {
  mode: AnchorSource;
  /** Subdivisions per edge or N×N grid factor per face. */
  divisions: number;
}

export const generateAnchors = (
  obj: EditorObject3D,
  options: AnchorGenOptions,
): Anchor[] => {
  const geom = getLocalGeometry(obj);
  if (!geom) return [];
  const { positions, faces } = dedupVertices(geom);

  if (options.mode === 'vertex') {
    return positions.map((p, i) => ({
      id: genId(),
      position: { x: p.x, y: p.y, z: p.z },
      source: 'vertex' as const,
      sourceIndex: i,
    }));
  }

  if (options.mode === 'edge') {
    const edges = uniqueEdges(faces);
    const n = Math.max(1, Math.floor(options.divisions));
    const out: Anchor[] = [];
    edges.forEach(([a, b], ei) => {
      const pa = positions[a], pb = positions[b];
      // n points evenly distributed along the edge (excluding endpoints when n>1, including midpoint when n==1)
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        out.push({
          id: genId(),
          position: {
            x: pa.x + (pb.x - pa.x) * t,
            y: pa.y + (pb.y - pa.y) * t,
            z: pa.z + (pb.z - pa.z) * t,
          },
          source: 'edge',
          sourceIndex: ei,
          groupId: `edge-${options.divisions}`,
        });
      }
    });
    return out;
  }

  // Face mode: barycentric NxN grid inside each triangle
  const n = Math.max(1, Math.floor(options.divisions));
  const out: Anchor[] = [];
  faces.forEach(([a, b, c], fi) => {
    const pa = positions[a], pb = positions[b], pc = positions[c];
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = i / Math.max(1, n);
        const v = j / Math.max(1, n);
        const w = 1 - u - v;
        if (w < -0.001) continue;
        out.push({
          id: genId(),
          position: {
            x: pa.x * w + pb.x * u + pc.x * v,
            y: pa.y * w + pb.y * u + pc.y * v,
            z: pa.z * w + pb.z * u + pc.z * v,
          },
          source: 'face',
          sourceIndex: fi,
          groupId: `face-${options.divisions}`,
        });
      }
    }
  });
  return out;
};

// Helper: compute world position of an anchor given the object's editor properties.
// Editor (Z-up, x=east, y=north, z=up) -> Three (Y-up): (x, z, -y)
export const anchorWorldPosition = (obj: EditorObject3D, a: Anchor): [number, number, number] => {
  const scaleX = obj.properties.width / 100;
  const scaleY = obj.properties.depth / 100;
  const scaleZ = obj.properties.height / 100;
  const lx = a.position.x * scaleX;
  const ly = a.position.y * scaleZ; // local Y from geometry maps to editor Z
  const lz = a.position.z * scaleY;
  return [
    obj.properties.x / 100 + lx,
    obj.properties.z / 100 + ly,
    -obj.properties.y / 100 + lz,
  ];
};