import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { createSession } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, contact, email, password, rememberMe } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanContact = typeof contact === 'string' ? contact.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full name (at least 2 characters).' }, { status: 400 });
    }

    if (!cleanContact || cleanContact.length < 5) {
      return NextResponse.json({ error: 'Please enter a valid contact phone number.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    // Check if email already registered
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
      args: [cleanEmail],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 409 }
      );
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await bcrypt.hash(cleanPassword, 10);
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

