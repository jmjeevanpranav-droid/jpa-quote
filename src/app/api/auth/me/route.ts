import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/auth/session';
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

  // Issue a fresh, lightweight signed session token (< 500 bytes) to heal any bloated client tokens
  const freshToken = await createSession(
    {
      userId: session.userId,
      email: session.email,
      name: session.name,
      contact: session.contact,
      role: session.role,
    },
    true
  );

  return NextResponse.json({
    authenticated: true,
    token: freshToken,
    user: {
      ...session,
      id: session.userId,
      avatarUrl,
      picture: avatarUrl,
    },
  });
}
