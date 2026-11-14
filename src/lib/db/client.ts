import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let clientInstance: Client | null = null;
let activeDbDir: string | null = null;

export function getDbKey(): string {
  if (process.env.JPA_DATA_DIR) {
    return path.resolve(process.env.JPA_DATA_DIR);
  }
  if (process.env.VERCEL) {
    return '/tmp/jpa-data';
  }
  return path.resolve(path.join(process.cwd(), 'data'));
}

export function getDb(): Client {
  if (process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL) {
    const remoteUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL!;
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
    if (clientInstance && activeDbDir === remoteUrl) {
      return clientInstance;
    }
    clientInstance = createClient({
      url: remoteUrl,
      authToken: authToken,
    });
    activeDbDir = remoteUrl;
    return clientInstance;
  }

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
