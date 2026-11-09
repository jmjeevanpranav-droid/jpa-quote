import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let clientInstance: Client | null = null;
let activeDbDir: string | null = null;

export function getDbKey(): string {
  return path.resolve(process.env.JPA_DATA_DIR || path.join(process.cwd(), 'data'));
}

export function getDb(): Client {
  const dbDir = getDbKey();
  if (clientInstance && activeDbDir === dbDir) {
    return clientInstance;
  }

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'jpa_quote.db');
  clientInstance = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}`,
  });
  activeDbDir = dbDir;

  return clientInstance;
}
