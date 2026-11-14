import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { createSession } from '@/lib/auth/session';
import { verifyRecaptchaToken } from '@/lib/auth/recaptcha';
import { normalizePhoneNumber } from '@/lib/utils/formatters';
import bcrypt from 'bcryptjs';

// In-memory rate limiter to prevent brute-force attacks
interface LoginAttemptRecord {
  count: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getClientIdentifier(req: NextRequest, identifier: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
  return `${ip}::${identifier.toLowerCase().trim()}`;
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

    const { identifier, email, phone, password, recaptchaToken, rememberMe } = body;
    const rawIdentifier = String(identifier || email || phone || '').trim();

    if (!rawIdentifier || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Valid Gmail or Phone Number and Password are required.' }, { status: 400 });
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

    const clientKey = getClientIdentifier(req, rawIdentifier);

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

    // Look up user flexibly by EITHER Gmail/Email OR Phone Number
    let userRow: any = null;

    if (rawIdentifier.includes('@')) {
      // 1. Direct Email / Gmail Lookup
      const cleanEmail = rawIdentifier.toLowerCase();
      const result = await db.execute({
        sql: 'SELECT id, email, name, contact, role, password_hash, avatar_url FROM users WHERE LOWER(email) = ? LIMIT 1',
        args: [cleanEmail],
      });
      if (result.rows.length > 0) {
        userRow = result.rows[0];
      }
    } else {
      // 2. Phone Number Lookup with comprehensive formatting tolerance
      const normPhone = normalizePhoneNumber(rawIdentifier);
      if (normPhone.length >= 7) {
        // Match common Indian format variants: +91 9790600971, +919790600971, 9790600971, 09790600971
        const phoneVariants = [
          `+91 ${normPhone}`,
          `+91${normPhone}`,
          normPhone,
          `0${normPhone}`,
          rawIdentifier,
        ];

        const phoneResult = await db.execute({
          sql: `SELECT id, email, name, contact, role, password_hash, avatar_url 
                FROM users 
                WHERE contact IN (?, ?, ?, ?, ?) 
                   OR LOWER(email) = LOWER(?)
                LIMIT 1`,
          args: [...phoneVariants, rawIdentifier],
        });

        if (phoneResult.rows.length > 0) {
          userRow = phoneResult.rows[0];
        } else {
          // Fallback: Scan candidates with LIKE match
          const candidateResult = await db.execute({
            sql: `SELECT id, email, name, contact, role, password_hash, avatar_url 
                  FROM users 
                  WHERE contact LIKE ? OR contact LIKE ? LIMIT 10`,
            args: [`%${normPhone}%`, `%${rawIdentifier}%`],
          });

          for (const cand of candidateResult.rows) {
            if (cand.contact && normalizePhoneNumber(String(cand.contact)) === normPhone) {
              userRow = cand;
              break;
            }
          }
        }
      }
    }

    // General fallback: query by exact email or contact match
    if (!userRow) {
      const fallbackResult = await db.execute({
        sql: 'SELECT id, email, name, contact, role, password_hash, avatar_url FROM users WHERE LOWER(email) = LOWER(?) OR contact = ? LIMIT 1',
        args: [rawIdentifier, rawIdentifier],
      });
      if (fallbackResult.rows.length > 0) {
        userRow = fallbackResult.rows[0];
      }
    }

    // Timing-attack prevention: Perform a dummy bcrypt comparison if user doesn't exist
    const DUMMY_HASH = '$2a$10$e8w8GZ5J1BqH3qgZ9vMhE.7h3zU5d1tL5y0j7N2x4k6p8r0t2v4x6';

    if (!userRow) {
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
          rawIdentifier,
          JSON.stringify({ reason: 'User not found', identifier: rawIdentifier, ip: remoteIp }),
          new Date().toISOString(),
        ],
      });

      return NextResponse.json({ error: 'Invalid Gmail, Phone Number or Password' }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, String(userRow.password_hash));

    if (!passwordValid) {
      const currentCount = (attemptRecord?.count || 0) + 1;
      const lockedUntil = currentCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : undefined;
      loginAttempts.set(clientKey, { count: currentCount, lockedUntil });

      await db.execute({
        sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          String(userRow.id),
          'LOGIN_FAILED',
          'auth',
          rawIdentifier,
          JSON.stringify({ reason: 'Invalid password', attempt: currentCount, ip: remoteIp }),
          new Date().toISOString(),
        ],
      });

      return NextResponse.json({ error: 'Invalid Gmail, Phone Number or Password' }, { status: 401 });
    }

    // Success: Reset rate limit tracker
    loginAttempts.delete(clientKey);

    const userRole = (userRow.role as 'admin' | 'staff') || 'staff';
    const nowIso = new Date().toISOString();

    // Update last sign in time and last active timestamp for employee tracking
    await db.execute({
      sql: 'UPDATE users SET last_sign_in_at = ?, last_active_at = ? WHERE id = ?',
      args: [nowIso, nowIso, String(userRow.id)],
    });

    // Create secure HTTP-only signed session token (avatarUrl fetched on demand via /api/auth/me to prevent HTTP 431)
    const token = await createSession(
      {
        userId: String(userRow.id),
        email: String(userRow.email),
        name: String(userRow.name),
        contact: userRow.contact ? String(userRow.contact) : undefined,
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
        String(userRow.id),
        userRole === 'admin' ? 'LOGIN_SUCCESS_ADMIN' : 'LOGIN_SUCCESS_EMPLOYEE',
        'auth',
        String(userRow.id),
        JSON.stringify({ email: userRow.email, contact: userRow.contact, role: userRole, ip: remoteIp }),
        new Date().toISOString(),
      ],
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: userRow.id,
        userId: userRow.id,
        email: userRow.email,
        name: userRow.name,
        contact: userRow.contact || '',
        role: userRole,
        avatarUrl: userRow.avatar_url || null,
      },
    });
  } catch (err: any) {
    console.error('Authentication security error:', err);
    return NextResponse.json({ error: 'Secure authentication failed' }, { status: 500 });
  }
}
