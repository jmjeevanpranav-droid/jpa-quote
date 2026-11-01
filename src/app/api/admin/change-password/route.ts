import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { seedDb } from '@/lib/db/seed';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  await seedDb();
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized: Administrator access required to change master credentials.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long.' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New password and confirmation do not match.' }, { status: 400 });
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, email, password_hash FROM users WHERE id = ? LIMIT 1',
      args: [session.userId],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Administrator user account not found.' }, { status: 404 });
    }

    const user = userRes.rows[0];
    const isCurrentValid = await bcrypt.compare(currentPassword, String(user.password_hash));

    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Current password entered is incorrect.' }, { status: 400 });
    }

    // Secure server-side bcrypt hashing
    const newHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, last_active_at = ? WHERE id = ?',
      args: [newHash, now, session.userId],
    });

    // Record audit event for password reset
    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        session.userId,
        'ADMIN_PASSWORD_CHANGED',
        'auth',
        session.userId,
        JSON.stringify({ message: 'Administrator password reset with server-side bcrypt hash', email: session.email }),
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Administrator password updated and securely hashed on the server.',
    });
  } catch (err: any) {
    console.error('Password reset error:', err);
    return NextResponse.json({ error: 'Failed to securely update password.' }, { status: 500 });
  }
}
