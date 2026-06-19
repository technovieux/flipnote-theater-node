/**
 * Remote pack catalog hosted on GitHub.
 *
 * Layout (in the repo `technovieux/flipnote-database`, branch `main`):
 *   2D/manifest.json
 *   3D/manifest.json
 *   spots2D/manifest.json
 *   spots3D/manifest.json
 *   fireworks/manifest.json
 *
 * Each manifest.json is an array of entries. Two flavours are supported:
 *   1. Leaf pack — points to a JSON payload file (array of items):
 *        { "id": "acme-2024", "name": "ACME 2024",
 *          "description": "Catalogue ACME", "author": "ACME",
 *          "kind": "pack", "file": "acme/pack.json" }
 *   2. Sub-folder — points to a nested manifest.json (recursive):
 *        { "id": "manufacturer-acme", "name": "ACME",
 *          "kind": "pack", "subfolder": "acme" }
 *
 * The payload file referenced by `file` is expected to be an array of items
 * matching the mode (firework products, spotlight fixtures, 3D shapes, …).
 *
 * Installed packs are stored in localStorage so they survive offline and are
 * available when the app is bundled as a desktop binary (Tauri).
 */

const REPO = 'technovieux/flipnote-database';
const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

export type PackMode = '2d' | '3d' | 'fireworks' | 'spotlight';
export type PackKind = 'pack' | 'single';

export interface CatalogEntry {
  id: string;
  name: string;
  description?: string;
  author?: string;
  kind: PackKind;
  /** Path to the payload JSON, relative to the entry's folder. */
  file?: string;
  /** Path to a sub-folder containing a nested manifest.json. */
  subfolder?: string;
  /** Source folder on GitHub (helps when several folders feed one mode). */
  folder: string;
}

export interface InstalledPack extends CatalogEntry {
  installedAt: number;
  payload: unknown;
}

export const getPackPayloadItems = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const data = payload as Record<string, any>;
  for (const key of ['items', 'products', 'fireworks', 'data']) {
    if (Array.isArray(data[key])) return data[key];
  }

  const grouped: any[] = [];
  for (const category of ['consumer', 'professional', 'european']) {
    if (Array.isArray(data[category])) {
      grouped.push(...data[category].map((item: any) => ({ ...item, targetCategory: item?.targetCategory ?? category })));
    }
  }
  return grouped;
};

const MODE_FOLDERS: Record<PackMode, string[]> = {
  '2d': ['2D'],
  '3d': ['3D'],
  'spotlight': ['spots2D', 'spots3D'],
  'fireworks': ['fireworks'],
};

const storageKey = (mode: PackMode) => `flipnote.installedPacks.${mode}`;

export const getInstalledPacks = (mode: PackMode): InstalledPack[] => {
  try {
    const raw = localStorage.getItem(storageKey(mode));
    return raw ? JSON.parse(raw) as InstalledPack[] : [];
  } catch {
    return [];
  }
};

const setInstalledPacks = (mode: PackMode, packs: InstalledPack[]) => {
  localStorage.setItem(storageKey(mode), JSON.stringify(packs));
};

export const isInstalled = (mode: PackMode, id: string): boolean => {
  return getInstalledPacks(mode).some(p => p.id === id);
};

/**
 * Recursively walk a folder and resolve all leaf packs.
 * `folder` is the path from the repo root (joined with '/').
 */
const walkFolder = async (folder: string, depth = 0): Promise<CatalogEntry[]> => {
  if (depth > 4) return []; // safety
  const url = `${RAW_BASE}/${folder}/manifest.json`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${folder}`);
  const data = await res.json() as Array<Omit<CatalogEntry, 'folder'>>;

  const out: CatalogEntry[] = [];
  for (const entry of data) {
    if (entry.subfolder) {
      try {
        const nested = await walkFolder(`${folder}/${entry.subfolder}`, depth + 1);
        out.push(...nested);
      } catch {
        // skip missing sub-manifests but keep walking siblings
      }
    } else if (entry.file) {
      out.push({ ...entry, folder });
    }
  }
  return out;
};

/**
 * Fetch the remote catalog for a mode. Returns the merged list of LEAF
 * entries across all source folders (and sub-folders) for that mode.
 */
export const fetchCatalog = async (mode: PackMode): Promise<CatalogEntry[]> => {
  const folders = MODE_FOLDERS[mode] ?? [];
  const results = await Promise.allSettled(folders.map(f => walkFolder(f)));

  const merged: CatalogEntry[] = [];
  let hadSuccess = false;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      hadSuccess = true;
      merged.push(...r.value);
    }
  }
  if (!hadSuccess && folders.length > 0) {
    throw new Error('catalog_unreachable');
  }
  return merged;
};

/**
 * Install a pack: download its JSON payload and persist it in localStorage.
 */
export const installPack = async (mode: PackMode, entry: CatalogEntry): Promise<InstalledPack> => {
  if (!entry.file) throw new Error('Cette entrée ne contient pas de pack à installer');
  const url = `${RAW_BASE}/${entry.folder}/${entry.file}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to download pack (HTTP ${res.status})`);
  const payload = await res.json();

  const pack: InstalledPack = { ...entry, installedAt: Date.now(), payload };
  const current = getInstalledPacks(mode).filter(p => p.id !== entry.id);
  setInstalledPacks(mode, [...current, pack]);
  return pack;
};

export const refreshEmptyInstalledPacks = async (mode: PackMode): Promise<InstalledPack[]> => {
  const packs = getInstalledPacks(mode);
  let changed = false;

  const next = await Promise.all(packs.map(async (pack) => {
    if (!pack.file || getPackPayloadItems(pack.payload).length > 0) return pack;
    try {
      const res = await fetch(`${RAW_BASE}/${pack.folder}/${pack.file}`, { cache: 'no-cache' });
      if (!res.ok) return pack;
      const payload = await res.json();
      changed = true;
      return { ...pack, payload, installedAt: Date.now() };
    } catch {
      return pack;
    }
  }));

  if (changed) setInstalledPacks(mode, next);
  return next;
};

/** Uninstall any pack — built-in or downloaded — by id. */
export const uninstallPack = (mode: PackMode, id: string): void => {
  const next = getInstalledPacks(mode).filter(p => p.id !== id);
  setInstalledPacks(mode, next);
};