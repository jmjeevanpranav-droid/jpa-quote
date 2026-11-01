import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { seedDb } from '@/lib/db/seed';

export async function POST(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Please sign in to update profile photo.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { avatarUrl, userId } = body;

    // Authorization: Staff can only update their own avatar; Admin can update their own or employee avatar
    const targetUserId = session.role === 'admin' && userId ? String(userId) : session.userId;

    if (avatarUrl && typeof avatarUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid photo data provided' }, { status: 400 });
    }

    // Protect against excessively huge payload (limit 15MB)
    if (avatarUrl && avatarUrl.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo size too large. Please use a smaller crop.' }, { status: 413 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    const check = await db.execute({
      sql: 'SELECT id, name, email FROM users WHERE id = ? OR email = ? LIMIT 1',
      args: [targetUserId, targetUserId],
    });

    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const targetUser = check.rows[0];
    const finalUserId = String(targetUser.id);

    await db.execute({
      sql: 'UPDATE users SET avatar_url = ?, last_active_at = ? WHERE id = ?',
      args: [avatarUrl || null, now, finalUserId],
    });

    // Record audit event
    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        session.userId,
        avatarUrl ? 'UPDATE_PROFILE_PHOTO' : 'REMOVE_PROFILE_PHOTO',
        'user',
        finalUserId,
        JSON.stringify({
          updatedBy: session.email,
          targetEmail: targetUser.email,
          targetName: targetUser.name,
          hasPhoto: Boolean(avatarUrl),
        }),
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      avatarUrl: avatarUrl || null,
      userId: finalUserId,
    });
  } catch (err: any) {
    console.error('Error updating avatar:', err);
    return NextResponse.json({ error: 'Failed to update profile photo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get('userId');
  const targetUserId = session.role === 'admin' && requestedUserId ? requestedUserId : session.userId;

  const db = getDb();
  try {
    await db.execute({
      sql: 'UPDATE users SET avatar_url = NULL WHERE id = ? OR email = ?',
      args: [targetUserId, targetUserId],
    });

    return NextResponse.json({ success: true, avatarUrl: null });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
  }
}
