import Database from 'better-sqlite3';
import { createClient, Client } from '@libsql/client';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'megavault.db');
let localDb: Database.Database | null = null;
let tursoClient: Client | null = null;
let tursoInitialized = false; // Guard: run CREATE TABLE only once per process

// Encryption Helper — requires ENCRYPTION_KEY (64-char hex) or COOKIE_SECRET (min 32 chars)
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY?.trim();
  if (envKey) {
    if (envKey.length !== 64) {
      throw new Error('[MegaVault] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
    }
    return Buffer.from(envKey, 'hex');
  }

  const secret = process.env.COOKIE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      '[MegaVault] COOKIE_SECRET env var is missing or too short (min 32 chars). Set it in Render environment variables.'
    );
  }
  return crypto.scryptSync(secret, 'megavault-salt', 32);
}

function encryptText(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptText(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;

    const [ivHex, authTagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
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
  // Non-destructive migration: add updated_at if it doesn't exist yet
  try {
    await client.execute(`ALTER TABLE albums ADD COLUMN updated_at TEXT;`);
  } catch {
    // Column already exists — ignore
  }
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
        updated_at TEXT
      );
    `);

    // Non-destructive migration: add updated_at if it doesn't exist yet
    try {
      localDb.exec(`ALTER TABLE albums ADD COLUMN updated_at TEXT;`);
    } catch {
      // Column already exists — ignore
    }

    // Database table ready
  }
  return localDb;
}

export interface DbAlbum {
  id: string;
  title: string;
  description?: string | null;
  mega_link: string;
  created_at: string;
  updated_at?: string | null;
}

export async function getAllAlbums(): Promise<DbAlbum[]> {
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute('SELECT * FROM albums ORDER BY created_at DESC');
      return res.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        mega_link: decryptText(row.mega_link),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (e) {
      console.error('Turso DB getAllAlbums error:', e);
    }
  }

  const db = getLocalDb();
  const statement = db.prepare('SELECT * FROM albums ORDER BY created_at DESC');
  const rows = statement.all() as DbAlbum[];
  return rows.map((row) => ({
    ...row,
    mega_link: decryptText(row.mega_link),
  }));
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
      if (res.rows.length === 0) return undefined;
      const row: any = res.rows[0];
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        mega_link: decryptText(row.mega_link),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (e) {
      console.error('Turso DB getAlbumById error:', e);
    }
  }

  const db = getLocalDb();
  const statement = db.prepare('SELECT * FROM albums WHERE id = ?');
  const row = statement.get(id) as DbAlbum | undefined;
  if (!row) return undefined;
  return {
    ...row,
    mega_link: decryptText(row.mega_link),
  };
}

export async function createAlbum(album: {
  id: string;
  title: string;
  description?: string;
  megaLink: string;
}): Promise<DbAlbum> {
  const now = new Date().toISOString();
  const encryptedLink = encryptText(album.megaLink);

  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      await client.execute({
        sql: `INSERT INTO albums (id, title, description, mega_link, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [album.id, album.title, album.description || null, encryptedLink, now, now],
      });
      return {
        id: album.id,
        title: album.title,
        description: album.description || null,
        mega_link: album.megaLink,
        created_at: now,
        updated_at: now,
      };
    } catch (e) {
      console.error('Turso DB createAlbum error:', e);
    }
  }

  const db = getLocalDb();
  const statement = db.prepare(`
    INSERT INTO albums (id, title, description, mega_link, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  statement.run(album.id, album.title, album.description || null, encryptedLink, now, now);

  return {
    id: album.id,
    title: album.title,
    description: album.description || null,
    mega_link: album.megaLink,
    created_at: now,
    updated_at: now,
  };
}

export async function deleteAlbum(id: string): Promise<boolean> {
  const client = getTursoClient();
  if (client) {
    try {
      await ensureTursoSchema(client);
      const res = await client.execute({
        sql: 'DELETE FROM albums WHERE id = ?',
        args: [id],
      });
      return res.rowsAffected > 0;
    } catch (e) {
      console.error('Turso DB deleteAlbum error:', e);
    }
  }

  const db = getLocalDb();
  const statement = db.prepare('DELETE FROM albums WHERE id = ?');
  const info = statement.run(id);
  return info.changes > 0;
}
