import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';

export async function GET() {
  await seedDb();
  const db = getDb();
  const res = await db.execute('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 50');
  return NextResponse.json({ events: res.rows });
}
