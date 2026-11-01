import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { createSession } from '@/lib/auth/session';
import { verifyRecaptchaToken } from '@/lib/auth/recaptcha';
import bcrypt from 'bcryptjs';

// In-memory rate limiter to prevent brute-force attacks
interface LoginAttemptRecord {
  count: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getClientIdentifier(req: NextRequest, email: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
  return `${ip}::${email.toLowerCase().trim()}`;
}

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();
  const now = Date.now();

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, password, recaptchaToken, rememberMe } = body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Valid email and password are required' }, { status: 400 });
    }

    // Google reCAPTCHA v3 Bot Protection Shield
    const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const captchaResult = await verifyRecaptchaToken(recaptchaToken, remoteIp, 'admin_login');
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.error || 'Google reCAPTCHA bot security check failed.' },
        { status: 403 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const clientKey = getClientIdentifier(req, cleanEmail);

    // Check rate limit status
    const attemptRecord = loginAttempts.get(clientKey);
    if (attemptRecord?.lockedUntil && attemptRecord.lockedUntil > now) {
      const remainingMinutes = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to repeated failed attempts. Security protocol active. Please retry in ${remainingMinutes} minute(s).`,
        },
        { status: 429 }
      );
    }

    const result = await db.execute({
      sql: 'SELECT id, email, name, role, password_hash FROM users WHERE email = ? LIMIT 1',
      args: [cleanEmail],
    });

    // Timing-attack prevention: Perform a dummy bcrypt comparison if user doesn't exist
    const DUMMY_HASH = '$2a$10$e8w8GZ5J1BqH3qgZ9vMhE.7h3zU5d1tL5y0j7N2x4k6p8r0t2v4x6';

    if (result.rows.length === 0) {
      await bcrypt.compare(password, DUMMY_HASH).catch(() => false);

      // Record failed attempt
      const currentCount = (attemptRecord?.count || 0) + 1;
      const lockedUntil = currentCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : undefined;
      loginAttempts.set(clientKey, { count: currentCount, lockedUntil });

      // Audit log failed attempt
      await db.execute({
        sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          'unauthenticated',
          'LOGIN_FAILED',
          'auth',
          cleanEmail,
          JSON.stringify({ reason: 'User not found', ip: req.headers.get('x-forwarded-for') || 'unknown' }),
          new Date().toISOString(),
        ],
      });

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, String(user.password_hash));

    if (!passwordValid) {
      const currentCount = (attemptRecord?.count || 0) + 1;
      const lockedUntil = currentCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : undefined;
      loginAttempts.set(clientKey, { count: currentCount, lockedUntil });

      await db.execute({
        sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          String(user.id),
          'LOGIN_FAILED',
          'auth',
          cleanEmail,
          JSON.stringify({ reason: 'Invalid password', attempt: currentCount, ip: req.headers.get('x-forwarded-for') || 'unknown' }),
          new Date().toISOString(),
        ],
      });

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Success: Reset rate limit tracker
    loginAttempts.delete(clientKey);

    const userRole = (user.role as 'admin' | 'staff') || 'staff';
    const nowIso = new Date().toISOString();

    // Update last sign in time and last active timestamp for employee tracking
    await db.execute({
      sql: 'UPDATE users SET last_sign_in_at = ?, last_active_at = ? WHERE id = ?',
      args: [nowIso, nowIso, String(user.id)],
    });

    // Create secure HTTP-only signed session token
    const token = await createSession(
      {
        userId: String(user.id),
        email: String(user.email),
        name: String(user.name),
        role: userRole,
      },
      Boolean(rememberMe)
    );

    // Audit log successful authentication
    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        String(user.id),
        userRole === 'admin' ? 'LOGIN_SUCCESS_ADMIN' : 'LOGIN_SUCCESS_EMPLOYEE',
        'auth',
        String(user.id),
        JSON.stringify({ email: user.email, role: userRole, ip: req.headers.get('x-forwarded-for') || 'unknown' }),
        new Date().toISOString(),
      ],
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: userRole,
      },
    });
  } catch (err: any) {
    console.error('Authentication security error:', err);
    return NextResponse.json({ error: 'Secure authentication failed' }, { status: 500 });
  }
}
