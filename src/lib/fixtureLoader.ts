import * as THREE from 'three';
import { parseOBJContent } from './objImporter';

export interface FixtureMaterial {
  color: string;
  metalness?: number;
  roughness?: number;
}

export interface FixtureLens {
  color: string;
  emissive?: boolean;
  position: [number, number, number];
  radius: number;
}

export interface FixturePart {
  name: string;
  file: string;
  parent: string | null;
  pivot: [number, number, number];
  rotatable: boolean;
  axis?: 'X' | 'Y' | 'Z';
  range?: [number, number];
  property?: string;
  label?: string;
  headOrientation?: string;
  material: FixtureMaterial;
  lens?: FixtureLens;
}

export interface FixtureChannel {
  name: string;
  defaultValue: number;
  type: 'dimmer' | 'color' | 'position' | 'gobo' | 'other';
}

export interface FixtureDefinition {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  folder: string;
  parts: FixturePart[];
  channels: FixtureChannel[];
  dimensions: { width: number; height: number; depth: number };
}

export interface FixtureManifest {
  fixtures: FixtureDefinition[];
}

export interface LoadedFixturePart {
  name: string;
  geometry: THREE.BufferGeometry;
  material: FixtureMaterial;
  pivot: [number, number, number];
  parent: string | null;
  rotatable: boolean;
  axis?: 'X' | 'Y' | 'Z';
  range?: [number, number];
  property?: string;
  label?: string;
  lens?: FixtureLens;
}

export interface LoadedFixture {
  definition: FixtureDefinition;
  parts: LoadedFixturePart[];
}

// Cache for loaded fixtures
const fixtureCache = new Map<string, LoadedFixture>();
const manifestCache: { data: FixtureManifest | null } = { data: null };

export const loadManifest = async (): Promise<FixtureManifest> => {
  if (manifestCache.data) return manifestCache.data;
  const res = await fetch('/data/fixtures/manifest.json');
  manifestCache.data = await res.json();
  return manifestCache.data!;
};

export const getFixtureDefinitions = async (): Promise<FixtureDefinition[]> => {
  const manifest = await loadManifest();
  return manifest.fixtures;
};

export const loadFixture = async (fixtureId: string): Promise<LoadedFixture | null> => {
  if (fixtureCache.has(fixtureId)) return fixtureCache.get(fixtureId)!;

  const manifest = await loadManifest();
  const def = manifest.fixtures.find(f => f.id === fixtureId);
  if (!def) return null;

  const loadedParts: LoadedFixturePart[] = [];

  for (const part of def.parts) {
    const url = `/data/fixtures/${def.folder}/${part.file}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      const serialized = parseOBJContent(text);
      if (!serialized) continue;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(serialized.positions, 3));
      if (serialized.normals && serialized.normals.length > 0) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(serialized.normals, 3));
      }
      if (serialized.indices && serialized.indices.length > 0) {
        geometry.setIndex(serialized.indices);
      }
      geometry.computeVertexNormals();

      loadedParts.push({
        name: part.name,
        geometry,
        material: part.material,
        pivot: part.pivot,
        parent: part.parent,
        rotatable: part.rotatable,
        axis: part.axis,
        range: part.range,
        property: part.property,
        label: part.label,
        lens: part.lens,
      });
    } catch (e) {
      console.warn(`Failed to load fixture part: ${url}`, e);
    }
  }

  const loaded: LoadedFixture = { definition: def, parts: loadedParts };
  fixtureCache.set(fixtureId, loaded);
  return loaded;
};

export const clearFixtureCache = () => {
  fixtureCache.forEach(f => f.parts.forEach(p => p.geometry.dispose()));
  fixtureCache.clear();
};
