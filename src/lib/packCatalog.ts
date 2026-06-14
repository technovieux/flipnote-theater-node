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
 * Each manifest.json is an array of entries:
 *   [{ "id": "pack1", "name": "...", "description": "...", "author": "...",
 *      "kind": "pack" | "single", "file": "pack1.json" }, ...]
 *
 * Each referenced JSON file is the pack payload (any JSON).
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
  file: string;
  /** Source folder on GitHub (helps when several folders feed one mode). */
  folder: string;
}

export interface InstalledPack extends CatalogEntry {
  installedAt: number;
  payload: unknown;
}

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
 * Fetch the remote catalog for a mode. Returns the merged list of entries
 * across all source folders for that mode. Throws on network failure.
 */
export const fetchCatalog = async (mode: PackMode): Promise<CatalogEntry[]> => {
  const folders = MODE_FOLDERS[mode] ?? [];
  const results = await Promise.allSettled(folders.map(async (folder) => {
    const url = `${RAW_BASE}/${folder}/manifest.json`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${folder}`);
    const data = await res.json() as Array<Omit<CatalogEntry, 'folder'>>;
    return data.map(e => ({ ...e, folder }));
  }));

  const merged: CatalogEntry[] = [];
  let hadSuccess = false;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      hadSuccess = true;
      merged.push(...r.value);
    }
  }
  // If every folder failed, surface the failure to the caller so the UI can
  // distinguish "no connection" from "no packs available".
  if (!hadSuccess && folders.length > 0) {
    throw new Error('catalog_unreachable');
  }
  return merged;
};

/**
 * Install a pack: download its JSON payload and persist it in localStorage.
 */
export const installPack = async (mode: PackMode, entry: CatalogEntry): Promise<InstalledPack> => {
  const url = `${RAW_BASE}/${entry.folder}/${entry.file}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to download pack (HTTP ${res.status})`);
  const payload = await res.json();

  const pack: InstalledPack = { ...entry, installedAt: Date.now(), payload };
  const current = getInstalledPacks(mode).filter(p => p.id !== entry.id);
  setInstalledPacks(mode, [...current, pack]);
  return pack;
};

/** Uninstall any pack — built-in or downloaded — by id. */
export const uninstallPack = (mode: PackMode, id: string): void => {
  const next = getInstalledPacks(mode).filter(p => p.id !== id);
  setInstalledPacks(mode, next);
};