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
    const db = getDb();
    const now = new Date().toISOString();

    let check: any;
    if (session.role === 'admin' && userId) {
      const lookupKey = String(userId).trim();
      check = await db.execute({
        sql: 'SELECT id, name, email FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
        args: [lookupKey, lookupKey],
      });
    } else {
      // Self-service photo change: strictly resolve target from authenticated session
      check = await db.execute({
        sql: 'SELECT id, name, email FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
        args: [session.userId, (session.email || '').toLowerCase().trim()],
      });

      // If user row is missing from users (e.g. legacy account or post-reset session),
      // verify unambiguous link from quotations or registration audit trail before reconciling
      if (check.rows.length === 0 && session.email) {
        const cleanEmail = session.email.toLowerCase().trim();
        const cleanName = (session.name || '').toLowerCase().trim();
        const legacyQuote = await db.execute({
          sql: 'SELECT created_by, created_by_id FROM quotations WHERE LOWER(created_by_id) = LOWER(?) OR LOWER(created_by) = LOWER(?) OR LOWER(created_by) = LOWER(?) LIMIT 1',
          args: [session.userId, cleanEmail, cleanName],
        });
        const legacyAudit = await db.execute({
          sql: "SELECT entity_id, details_json FROM audit_events WHERE action IN ('EMPLOYEE_REGISTERED', 'LOGIN_SUCCESS_EMPLOYEE') AND (user_id = ? OR details_json LIKE ?) LIMIT 1",
          args: [session.userId, `%${cleanEmail}%`],
        });

        if (legacyQuote.rows.length > 0 || legacyAudit.rows.length > 0) {
          const empId = session.userId || `usr_${Date.now()}_linked`;
          const empName = session.name || 'Employee';
          await db.execute({
            sql: `INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, 'staff', 'legacy_session_linked', ?)`,
            args: [empId, cleanEmail, empName, now],
          });
          check = await db.execute({
            sql: 'SELECT id, name, email FROM users WHERE id = ? LIMIT 1',
            args: [empId],
          });
        }
      }
    }

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

  const db = getDb();
  try {
    let check: any;
    if (session.role === 'admin' && requestedUserId) {
      const lookupKey = requestedUserId.trim();
      check = await db.execute({
        sql: 'SELECT id FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
        args: [lookupKey, lookupKey],
      });
    } else {
      check = await db.execute({
        sql: 'SELECT id FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
        args: [session.userId, (session.email || '').toLowerCase().trim()],
      });
    }

    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const finalUserId = String(check.rows[0].id);
    await db.execute({
      sql: 'UPDATE users SET avatar_url = NULL WHERE id = ?',
      args: [finalUserId],
    });

    return NextResponse.json({ success: true, avatarUrl: null });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
  }
}
