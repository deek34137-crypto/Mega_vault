import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'megavault.db');
let db: Database.Database;

// AES-256-GCM Link Encryption Helper
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.COOKIE_SECRET || 'megavault-super-secret-key-32chars!',
  'megavault-salt',
  32
);

function encryptText(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptText(encryptedText: string): string {
  try {
    if (!encryptedText.includes(':')) return encryptedText; // Fallback if plain text
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText; // Graceful fallback
  }
}

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Initialize Schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        mega_link TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Seed initial sample album if empty
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM albums');
    const result = countStmt.get() as { count: number };

    if (result.count === 0) {
      const insertStmt = db.prepare(`
        INSERT INTO albums (id, title, description, mega_link, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        'alb-family',
        'Family Summer Vacation',
        'Beach sunset photos and drone highlight videos',
        encryptText('https://mega.nz/folder/example#key1'),
        new Date().toISOString()
      );
    }
  }

  return db;
}

export interface DbAlbum {
  id: string;
  title: string;
  description?: string | null;
  mega_link: string;
  created_at: string;
}

export function getAllAlbums(): DbAlbum[] {
  const statement = getDb().prepare('SELECT * FROM albums ORDER BY created_at DESC');
  const rows = statement.all() as DbAlbum[];
  return rows.map((row) => ({
    ...row,
    mega_link: decryptText(row.mega_link),
  }));
}

export function getAlbumById(id: string): DbAlbum | undefined {
  const statement = getDb().prepare('SELECT * FROM albums WHERE id = ?');
  const row = statement.get(id) as DbAlbum | undefined;
  if (!row) return undefined;
  return {
    ...row,
    mega_link: decryptText(row.mega_link),
  };
}

export function createAlbum(album: { id: string; title: string; description?: string; megaLink: string }): DbAlbum {
  const createdAt = new Date().toISOString();
  const encryptedLink = encryptText(album.megaLink);

  const statement = getDb().prepare(`
    INSERT INTO albums (id, title, description, mega_link, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  statement.run(album.id, album.title, album.description || null, encryptedLink, createdAt);

  return {
    id: album.id,
    title: album.title,
    description: album.description || null,
    mega_link: album.megaLink,
    created_at: createdAt,
  };
}

export function deleteAlbum(id: string): boolean {
  const statement = getDb().prepare('DELETE FROM albums WHERE id = ?');
  const info = statement.run(id);
  return info.changes > 0;
}
