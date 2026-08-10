import Database from 'better-sqlite3';
import { createClient, Client } from '@libsql/client';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'megavault.db');
let localDb: Database.Database | null = null;
let tursoClient: Client | null = null;
let tursoInitialized = false; // Guard: run CREATE TABLE only once per process

import os from 'os';

let instanceSecretCache: string | null = null;

function getInstanceSecret(): string {
  if (instanceSecretCache) return instanceSecretCache;
  const secret = process.env.COOKIE_SECRET?.trim();
  if (secret && secret.length >= 16) {
    instanceSecretCache = secret;
    return secret;
  }
  const hostInfo = `${os.hostname()}-${os.arch()}-${os.platform()}-${process.cwd()}`;
  instanceSecretCache = crypto.createHash('sha256').update(`megavault-host-secret-${hostInfo}`).digest('hex');
  if (process.env.NODE_ENV === 'production') {
    console.warn('[MegaVault Security Warning] COOKIE_SECRET environment variable is missing in production. Using host-instance key.');
  }
  return instanceSecretCache;
}

// Encryption Helper — requires ENCRYPTION_KEY or COOKIE_SECRET
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY?.trim();
  if (envKey) {
    if (envKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    // If ENCRYPTION_KEY is provided as a plain passphrase, hash it deterministically to 32 bytes
    return crypto.createHash('sha256').update(envKey).digest();
  }

  const secret = getInstanceSecret();
  return crypto.scryptSync(secret, 'megavault-salt', 32);
}

function encryptText(text: string): string {
  if (!text) return text;
  // If text is already encrypted (format iv:authTag:encrypted), do not re-encrypt
  if (text.includes(':') && text.split(':').length === 3 && /^[0-9a-fA-F]+$/.test(text.replace(/:/g, ''))) {
    return text;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function getFallbackEncryptionKey(): Buffer {
  const secret = getInstanceSecret();
  return crypto.scryptSync(secret, 'megavault-salt', 32);
}

function getLegacyFallbackEncryptionKey(): Buffer {
  const legacySecret = 'megavault-default-fallback-secret-key-32-chars';
  return crypto.scryptSync(legacySecret, 'megavault-salt', 32);
}

function decryptText(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  // If text is already a plain URL, return it directly!
  if (encryptedText.startsWith('http://') || encryptedText.startsWith('https://')) {
    return encryptedText;
  }

  if (!encryptedText.includes(':')) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText;

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // Attempt 1: Decrypt with primary ENCRYPTION_KEY
  try {
    const primaryKey = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', primaryKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e1) {
    // Attempt 2: Decrypt with fallback COOKIE_SECRET / instance key
    try {
      const fallbackKey = getFallbackEncryptionKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', fallbackKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e2) {
      // Attempt 3: Decrypt with legacy static secret key (for existing DB records)
      try {
        const legacyKey = getLegacyFallbackEncryptionKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', legacyKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (e3) {
        console.error('[MegaVault] Decryption failed with all keys:', e3);
        return encryptedText;
      }
    }
  }
}

// Database Connection Helper with auto libsql:// to https:// HTTP conversion
function getTursoClient(): Client | null {
  let rawUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (rawUrl) {
    if (rawUrl.startsWith('libsql://')) {
      rawUrl = rawUrl.replace('libsql://', 'https://');
    }
    if (!tursoClient) {
      tursoClient = createClient({
        url: rawUrl,
        authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
      });
    }
    return tursoClient;
  }
  return null;
}

// Run DDL exactly once per process lifecycle (not on every query)
async function ensureTursoSchema(client: Client): Promise<void> {
  if (tursoInitialized) return;
  await client.execute(`
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      mega_link TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS video_thumbnails (
      album_id TEXT NOT NULL,
      handle TEXT NOT NULL,
      thumbnail_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (album_id, handle)
    );
  `);
  // Non-destructive migrations: add updated_at and cover_image_url if they don't exist yet
  try {
    await client.execute(`ALTER TABLE albums ADD COLUMN updated_at TEXT;`);
  } catch {}
  try {
    await client.execute(`ALTER TABLE albums ADD COLUMN cover_image_url TEXT;`);
  } catch {}
  tursoInitialized = true;
}

function getLocalDb(): Database.Database {
  if (!localDb) {
    localDb = new Database(dbPath);
    localDb.pragma('journal_mode = WAL');

    localDb.exec(`
      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        mega_link TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        cover_image_url TEXT
      );
      CREATE TABLE IF NOT EXISTS video_thumbnails (
        album_id TEXT NOT NULL,
        handle TEXT NOT NULL,
        thumbnail_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (album_id, handle)
      );
    `);

    try {
      localDb.exec(`ALTER TABLE albums ADD COLUMN updated_at TEXT;`);
    } catch {}
    try {
      localDb.exec(`ALTER TABLE albums ADD COLUMN cover_image_url TEXT;`);
    } catch {}
  }
  return localDb;
}

import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
const backupFilePath = path.join(dataDir, 'albums_backup.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

function syncBackup(albums: DbAlbum[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(backupFilePath, JSON.stringify(albums, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write albums backup:', e);
  }
}

function loadBackup(): DbAlbum[] {
  ensureDataDir();
  try {
    if (fs.existsSync(backupFilePath)) {
      const raw = fs.readFileSync(backupFilePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.error('Failed to read albums backup:', e);
  }
  return [];
}

export interface DbAlbum {
  id: string;
  title: string;
  description?: string | null;
  mega_link: string;
  created_at: string;
  updated_at?: string | null;
  cover_image_url?: string | null;
}

export async function getAllAlbums(): Promise<DbAlbum[]> {
  let albums: DbAlbum[] = [];

  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute('SELECT * FROM albums ORDER BY created_at DESC');
      albums = res.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        mega_link: decryptText(row.mega_link),
        created_at: row.created_at,
        updated_at: row.updated_at,
        cover_image_url: row.cover_image_url,
      }));
    } catch (e) {
      console.error('[MegaVault] Turso DB getAllAlbums error:', e);
    }
  }

  // Fallback to local database if Turso returned 0 items or failed
  if (albums.length === 0) {
    try {
      const db = getLocalDb();
      const statement = db.prepare('SELECT * FROM albums ORDER BY created_at DESC');
      const rows = statement.all() as DbAlbum[];
      if (rows.length > 0) {
        albums = rows.map((row) => ({
          ...row,
          mega_link: decryptText(row.mega_link),
        }));
      }
    } catch (e) {
      console.error('[MegaVault] Local DB getAllAlbums error:', e);
    }
  }

  // Auto-hydration: If DB returned 0 albums but backup exists, restore from backup!
  if (albums.length === 0) {
    const backupAlbums = loadBackup();
    if (backupAlbums.length > 0) {
      console.log(`[MegaVault] Auto-hydrating ${backupAlbums.length} albums from persistent backup...`);
      for (const alb of backupAlbums) {
        try {
          await createAlbumInternal(alb);
        } catch (err) {
          console.error(`Failed to restore album ${alb.id}:`, err);
        }
      }
      return backupAlbums;
    }
  } else {
    // Keep backup in sync
    syncBackup(albums);
  }

  return albums;
}

export async function getAlbumById(id: string): Promise<DbAlbum | undefined> {
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute({
        sql: 'SELECT * FROM albums WHERE id = ?',
        args: [id],
      });
      if (res.rows.length > 0) {
        const row: any = res.rows[0];
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          mega_link: decryptText(row.mega_link),
          created_at: row.created_at,
          updated_at: row.updated_at,
          cover_image_url: row.cover_image_url,
        };
      }
    } catch (e) {
      console.error('Turso DB getAlbumById error:', e);
    }
  }

  try {
    const db = getLocalDb();
    const statement = db.prepare('SELECT * FROM albums WHERE id = ?');
    const row = statement.get(id) as DbAlbum | undefined;
    if (row) {
      return {
        ...row,
        mega_link: decryptText(row.mega_link),
      };
    }
  } catch (e) {
    console.error('Local DB getAlbumById error:', e);
  }

  // Fallback to backup if DB lookup fails
  const backupAlbums = loadBackup();
  return backupAlbums.find((a) => a.id === id);
}

async function createAlbumInternal(album: {
  id: string;
  title: string;
  description?: string | null;
  mega_link: string;
  created_at?: string;
  updated_at?: string | null;
}): Promise<DbAlbum> {
  const now = album.created_at || new Date().toISOString();
  const encryptedLink = encryptText(album.mega_link);
  const updated = album.updated_at || now;

  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      await client.execute({
        sql: `INSERT OR REPLACE INTO albums (id, title, description, mega_link, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [album.id, album.title, album.description || null, encryptedLink, now, updated],
      });
      console.log(`[MegaVault] Successfully saved album ${album.title} (${album.id}) to Turso Cloud DB.`);
    } catch (e) {
      console.error('[MegaVault CRITICAL ERROR] Failed to save album to Turso Cloud DB:', e);
    }
  }

  try {
    const db = getLocalDb();
    const statement = db.prepare(`
      INSERT OR REPLACE INTO albums (id, title, description, mega_link, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    statement.run(album.id, album.title, album.description || null, encryptedLink, now, updated);
  } catch (e) {
    console.error('Local DB createAlbumInternal error:', e);
  }

  return {
    id: album.id,
    title: album.title,
    description: album.description || null,
    mega_link: album.mega_link,
    created_at: now,
    updated_at: updated,
  };
}

export async function createAlbum(album: {
  id: string;
  title: string;
  description?: string;
  megaLink: string;
}): Promise<DbAlbum> {
  const created = await createAlbumInternal({
    id: album.id,
    title: album.title,
    description: album.description,
    mega_link: album.megaLink,
  });

  // Sync with persistent backup file
  const currentBackup = loadBackup();
  const filtered = currentBackup.filter((a) => a.id !== created.id);
  filtered.unshift(created);
  syncBackup(filtered);

  return created;
}

export async function deleteAlbum(id: string): Promise<boolean> {
  let success = false;
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute({
        sql: 'DELETE FROM albums WHERE id = ?',
        args: [id],
      });
      if (res.rowsAffected > 0) success = true;
    } catch (e) {
      console.error('Turso DB deleteAlbum error:', e);
    }
  }

  try {
    const db = getLocalDb();
    const statement = db.prepare('DELETE FROM albums WHERE id = ?');
    const info = statement.run(id);
    if (info.changes > 0) success = true;
  } catch (e) {
    console.error('Local DB deleteAlbum error:', e);
  }

  // Also remove from persistent backup file
  const currentBackup = loadBackup();
  const updatedBackup = currentBackup.filter((a) => a.id !== id);
  if (updatedBackup.length !== currentBackup.length) {
    syncBackup(updatedBackup);
    success = true;
  }

  return success;
}

// ─── VIDEO THUMBNAILS DATABASE HELPERS ───

export async function saveVideoThumbnail(albumId: string, handle: string, thumbnailData: string): Promise<void> {
  const now = new Date().toISOString();
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      await client.execute({
        sql: `INSERT OR REPLACE INTO video_thumbnails (album_id, handle, thumbnail_data, created_at) VALUES (?, ?, ?, ?)`,
        args: [albumId, handle, thumbnailData, now],
      });
    } catch (e) {
      console.error('[MegaVault] Turso DB saveVideoThumbnail error:', e);
    }
  }

  try {
    const db = getLocalDb();
    const stmt = db.prepare(`INSERT OR REPLACE INTO video_thumbnails (album_id, handle, thumbnail_data, created_at) VALUES (?, ?, ?, ?)`);
    stmt.run(albumId, handle, thumbnailData, now);
  } catch (e) {
    console.error('Local DB saveVideoThumbnail error:', e);
  }
}

export async function getVideoThumbnail(albumId: string, handle: string): Promise<string | null> {
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute({
        sql: 'SELECT thumbnail_data FROM video_thumbnails WHERE album_id = ? AND handle = ?',
        args: [albumId, handle],
      });
      if (res.rows.length > 0) {
        return res.rows[0].thumbnail_data as string;
      }
    } catch (e) {
      console.error('Turso DB getVideoThumbnail error:', e);
    }
  }

  try {
    const db = getLocalDb();
    const stmt = db.prepare('SELECT thumbnail_data FROM video_thumbnails WHERE album_id = ? AND handle = ?');
    const row = stmt.get(albumId, handle) as { thumbnail_data: string } | undefined;
    if (row) return row.thumbnail_data;
  } catch (e) {
    console.error('Local DB getVideoThumbnail error:', e);
  }

  return null;
}

export async function getVideoThumbnailsForAlbum(albumId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute({
        sql: 'SELECT handle, thumbnail_data FROM video_thumbnails WHERE album_id = ?',
        args: [albumId],
      });
      for (const row of res.rows) {
        map.set(row.handle as string, row.thumbnail_data as string);
      }
      return map;
    } catch (e) {
      console.error('Turso DB getVideoThumbnailsForAlbum error:', e);
    }
  }

  try {
    const db = getLocalDb();
    const stmt = db.prepare('SELECT handle, thumbnail_data FROM video_thumbnails WHERE album_id = ?');
    const rows = stmt.all(albumId) as { handle: string; thumbnail_data: string }[];
    for (const r of rows) {
      map.set(r.handle, r.thumbnail_data);
    }
  } catch (e) {
    console.error('Local DB getVideoThumbnailsForAlbum error:', e);
  }

  return map;
}

export async function updateAlbumCoverImage(albumId: string, coverImageUrl: string): Promise<void> {
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      await client.execute({
        sql: 'UPDATE albums SET cover_image_url = ? WHERE id = ?',
        args: [coverImageUrl, albumId],
      });
    } catch (e) {
      console.error('Turso DB updateAlbumCoverImage error:', e);
    }
  }

  try {
    const db = getLocalDb();
    const stmt = db.prepare('UPDATE albums SET cover_image_url = ? WHERE id = ?');
    stmt.run(coverImageUrl, albumId);
  } catch (e) {
    console.error('Local DB updateAlbumCoverImage error:', e);
  }
}

