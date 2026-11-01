import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  let avatarUrl = session.avatarUrl || session.picture || null;
  try {
    const db = getDb();
    const res = await db.execute({
      sql: 'SELECT avatar_url, contact FROM users WHERE id = ? LIMIT 1',
      args: [session.userId],
    });
    if (res.rows.length > 0) {
      if (res.rows[0].avatar_url) avatarUrl = String(res.rows[0].avatar_url);
    }
  } catch {}

  return NextResponse.json({
    authenticated: true,
    user: {
      ...session,
      avatarUrl,
      picture: avatarUrl,
    },
  });
}
