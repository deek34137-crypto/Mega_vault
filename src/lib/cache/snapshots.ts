import fs from 'fs';
import path from 'path';
import { MegaFolderResult } from '@/lib/mega';

const dataDir = path.join(process.cwd(), 'data');
const snapshotsFilePath = path.join(dataDir, 'folder_snapshots.json');

let memorySnapshots: Record<string, MegaFolderResult> | null = null;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

function loadSnapshotsFromDisk(): Record<string, MegaFolderResult> {
  if (memorySnapshots !== null) return memorySnapshots;

  ensureDataDir();
  try {
    if (fs.existsSync(snapshotsFilePath)) {
      const raw = fs.readFileSync(snapshotsFilePath, 'utf8');
      memorySnapshots = JSON.parse(raw);
      return memorySnapshots || {};
    }
  } catch (e) {
    console.error('Failed to read folder snapshots from disk:', e);
  }

  memorySnapshots = {};
  return memorySnapshots;
}

function saveSnapshotsToDisk(): void {
  if (!memorySnapshots) return;
  ensureDataDir();
  try {
    fs.writeFileSync(snapshotsFilePath, JSON.stringify(memorySnapshots, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write folder snapshots to disk:', e);
  }
}

export function getFolderSnapshot(cacheKey: string): MegaFolderResult | null {
  const snapshots = loadSnapshotsFromDisk();
  return snapshots[cacheKey] || null;
}

export function saveFolderSnapshot(cacheKey: string, result: MegaFolderResult): void {
  // Only save non-empty or valid snapshot results so we don't snapshot empty failure responses
  if (!result || (result.items.length === 0 && result.subfolders.length === 0 && (!result.mediaCount || result.mediaCount.total === 0))) {
    return;
  }

  const snapshots = loadSnapshotsFromDisk();
  snapshots[cacheKey] = {
    ...result,
    isFromSnapshot: true,
  } as MegaFolderResult;
  saveSnapshotsToDisk();
}

export function removeFolderSnapshot(cacheKeyPrefix: string): void {
  const snapshots = loadSnapshotsFromDisk();
  let modified = false;
  for (const key of Object.keys(snapshots)) {
    if (key.startsWith(cacheKeyPrefix)) {
      delete snapshots[key];
      modified = true;
    }
  }
  if (modified) {
    saveSnapshotsToDisk();
  }
}
