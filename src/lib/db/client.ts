import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let clientInstance: Client | null = null;

export function getDb(): Client {
  if (clientInstance) {
    return clientInstance;
  }

  const dbDir = process.env.JPA_DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'jpa_quote.db');
  clientInstance = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}`,
  });

  return clientInstance;
}
