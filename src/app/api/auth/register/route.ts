import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { createSession } from '@/lib/auth/session';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/formatters';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, contact, phnumber, email, gmail, password, rememberMe } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const rawContact = typeof (contact || phnumber) === 'string' ? String(contact || phnumber).trim() : '';
    const cleanEmail = typeof (email || gmail) === 'string' ? String(email || gmail).toLowerCase().trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full name (at least 2 characters).' }, { status: 400 });
    }

    const normPhone = normalizePhoneNumber(rawContact);
    if (!normPhone || normPhone.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit contact phone number.' }, { status: 400 });
    }
    const cleanContact = formatPhoneNumber(rawContact);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please provide a valid Gmail / Email address.' }, { status: 400 });
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    // Check if email or phone number is already registered
    const existing = await db.execute({
      sql: `SELECT id, email, contact FROM users 
            WHERE LOWER(email) = LOWER(?) 
               OR contact IN (?, ?, ?)
            LIMIT 1`,
      args: [cleanEmail, cleanContact, normPhone, `+91${normPhone}`],
    });

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (String(match.email).toLowerCase() === cleanEmail) {
        return NextResponse.json(
          { error: 'An account with this Gmail address already exists. Please sign in.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'An account with this Phone Number already exists. Please sign in.' },
        { status: 409 }
      );
    }

    // Fallback candidate check for any formatting variations
    const phoneCandidates = await db.execute({
      sql: 'SELECT id, contact FROM users WHERE contact LIKE ? LIMIT 5',
      args: [`%${normPhone}%`],
    });
    for (const cand of phoneCandidates.rows) {
      if (cand.contact && normalizePhoneNumber(String(cand.contact)) === normPhone) {
        return NextResponse.json(
          { error: 'An account with this Phone Number already exists. Please sign in.' },
          { status: 409 }
        );
      }
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await bcrypt.hash(cleanPassword, 8);
    const now = new Date().toISOString();

    // Newly registered accounts are Staff / Employees
    const userRole = 'staff';

    await db.execute({
      sql: `INSERT INTO users (id, email, name, contact, role, password_hash, last_sign_in_at, last_active_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, cleanEmail, cleanName, cleanContact, userRole, passwordHash, now, now, now],
    });

    // Audit log employee sign-in / registration
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        'EMPLOYEE_REGISTERED',
        'auth',
        userId,
        JSON.stringify({ email: cleanEmail, name: cleanName, contact: cleanContact, role: userRole, ip }),
        now,
      ],
    });

    // Create session and set cookie
    const token = await createSession(
      {
        userId,
        email: cleanEmail,
        name: cleanName,
        contact: cleanContact,
        role: userRole,
      },
      Boolean(rememberMe)
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: userId,
        userId,
        email: cleanEmail,
        name: cleanName,
        contact: cleanContact,
        role: userRole,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Failed to create new account. Please try again.' }, { status: 500 });
  }
}
