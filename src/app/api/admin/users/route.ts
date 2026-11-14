import { NextRequest, NextResponse, connection } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { seedDb } from '@/lib/db/seed';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/formatters';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try { await connection(); } catch {}
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only Administrator N Jayakumar can access the Employee Directory.' },
      { status: 403 }
    );
  }

  const db = getDb();
  try {
    // Only return registered employees / team members (exclude master admin)
    const result = await db.execute({
      sql: `SELECT id, email, name, contact, role, avatar_url, last_sign_in_at, last_active_at, created_at 
            FROM users 
            WHERE email NOT IN ('jeevanpranavagencies@gmail.com', 'salesteamjpa@gmail.com')
              AND id != 'usr_admin_1'
            ORDER BY created_at DESC`,
    });

    // Fetch quotation statistics and detailed activities for each employee
    const usersWithStats = await Promise.all(
      result.rows.map(async (row: any) => {
        const empId = String(row.id);
        const empName = String(row.name);
        const empEmail = String(row.email);

        // 1. Fetch Quotation Progress Metrics (Case-insensitive matching by ID, Name, or Email)
        const quoteStats = await db.execute({
          sql: `SELECT 
                  COUNT(*) as quote_count,
                  COALESCE(SUM(grand_total), 0) as total_value,
                  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                  SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
                FROM quotations 
                WHERE created_by_id = ? 
                   OR LOWER(created_by_id) = LOWER(?)
                   OR LOWER(created_by) = LOWER(?) 
                   OR LOWER(created_by) = LOWER(?)`,
          args: [empId, empId, empName, empEmail],
        });

        const statsRow = quoteStats.rows[0] || {};
        const quoteCount = Number(statsRow.quote_count || 0);
        const totalValue = Number(statsRow.total_value || 0);
        const approvedCount = Number(statsRow.approved_count || 0);
        const draftCount = Number(statsRow.draft_count || 0);

        // 2. Fetch Detailed Quotations Created by this Employee
        const quotesRes = await db.execute({
          sql: `SELECT id, quote_number, customer_name, store_name, quote_date, validity_date, status, grand_total, created_at
                FROM quotations 
                WHERE created_by_id = ? 
                   OR LOWER(created_by_id) = LOWER(?)
                   OR LOWER(created_by) = LOWER(?) 
                   OR LOWER(created_by) = LOWER(?)
                ORDER BY created_at DESC LIMIT 50`,
          args: [empId, empId, empName, empEmail],
        });

        // 3. Fetch Activity Timeline from audit_events
        const activityRes = await db.execute({
          sql: `SELECT id, action, entity_type, entity_id, details_json, created_at
                FROM audit_events
                WHERE user_id = ? 
                   OR user_id = ?
                   OR entity_id = ?
                   OR details_json LIKE ? 
                   OR details_json LIKE ?
                ORDER BY created_at DESC LIMIT 50`,
          args: [empId, empEmail, empId, `%${empEmail}%`, `%${empName}%`],
        });

        // 4. Derive accurate Last Sign-In timestamp (backfill if missing from audit trail)
        let lastSignInAt = row.last_sign_in_at ? String(row.last_sign_in_at) : null;
        if (!lastSignInAt) {
          const loginAct = activityRes.rows.find((a: any) =>
            a.action === 'LOGIN_SUCCESS_EMPLOYEE' || a.action === 'EMPLOYEE_REGISTERED'
          );
          if (loginAct) {
            lastSignInAt = String(loginAct.created_at);
            // Persist back to database
            await db.execute({
              sql: 'UPDATE users SET last_sign_in_at = ? WHERE id = ?',
              args: [lastSignInAt, empId],
            }).catch(() => {});
          }
        }

        // 5. Derive accurate Last Active timestamp and event
        const latestActivity = activityRes.rows[0];
        const lastActiveAt = row.last_active_at
          ? String(row.last_active_at)
          : (latestActivity ? String(latestActivity.created_at) : (lastSignInAt || String(row.created_at || '')));
        const lastActiveEvent = latestActivity ? String(latestActivity.action) : (lastSignInAt ? 'SIGN_IN' : 'ACCOUNT_CREATED');

        return {
          id: empId,
          email: empEmail,
          name: empName,
          contact: row.contact ? String(row.contact) : '',
          role: String(row.role),
          avatar_url: row.avatar_url ? String(row.avatar_url) : null,
          last_sign_in_at: lastSignInAt,
          last_active_at: lastActiveAt || null,
          last_active_event: lastActiveEvent,
          created_at: String(row.created_at || ''),
          metrics: {
            quoteCount,
            totalValue,
            approvedCount,
            draftCount,
          },
          quotations: quotesRes.rows.map((q: any) => ({
            id: String(q.id),
            quote_number: String(q.quote_number),
            customer_name: String(q.customer_name),
            store_name: q.store_name ? String(q.store_name) : null,
            quote_date: String(q.quote_date),
            validity_date: String(q.validity_date),
            status: String(q.status),
            grand_total: Number(q.grand_total || 0),
            created_at: String(q.created_at),
          })),
          activities: activityRes.rows.map((a: any) => {
            let details = null;
            try {
              details = JSON.parse(String(a.details_json || '{}'));
            } catch {
              details = {};
            }
            return {
              id: String(a.id),
              action: String(a.action),
              entity_type: String(a.entity_type),
              entity_id: a.entity_id ? String(a.entity_id) : null,
              details,
              created_at: String(a.created_at),
            };
          }),
        };
      })
    );

    return NextResponse.json(
      { success: true, users: usersWithStats },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Failed to fetch employee list:', err);
    return NextResponse.json({ error: 'Failed to load employees' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, contact, phnumber, email, gmail, password, role } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const rawPhone = typeof (contact || phnumber) === 'string' ? String(contact || phnumber).trim() : '';
    const cleanGmail = typeof (email || gmail) === 'string' ? String(email || gmail).toLowerCase().trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanRole = role === 'admin' ? 'admin' : 'staff';

    // Required Field 1: Name
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'Please enter the employee name (at least 2 characters).' }, { status: 400 });
    }

    // Required Field 2: Phnumber (Phone Number)
    const normPhone = normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number.' }, { status: 400 });
    }
    const formattedPhone = formatPhoneNumber(rawPhone);

    // Required Field 3: Gmail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanGmail || !emailRegex.test(cleanGmail)) {
      return NextResponse.json({ error: 'Please provide a valid Gmail / Email address.' }, { status: 400 });
    }

    // Required Field 4: Password
    if (!cleanPassword || cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const db = getDb();

    // Check for duplicate or existing employee by Gmail or Phone Number
    const existing = await db.execute({
      sql: `SELECT id, email, name, contact, role FROM users 
            WHERE LOWER(email) = LOWER(?) 
               OR contact IN (?, ?, ?)
            LIMIT 1`,
      args: [cleanGmail, formattedPhone, normPhone, `+91${normPhone}`],
    });

    let matchedUserId: string | null = null;
    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      const matchId = String(match.id);
      const matchEmail = String(match.email).toLowerCase();

      if (matchId === 'usr_admin_1' || matchEmail === 'jeevanpranavagencies@gmail.com') {
        return NextResponse.json(
          { error: 'Cannot modify or reassign Master Administrator account credentials.' },
          { status: 400 }
        );
      }
      matchedUserId = matchId;
    } else {
      // Additional candidate check for formatted phone variations
      const phoneCandidates = await db.execute({
        sql: 'SELECT id, email, contact FROM users WHERE contact LIKE ? LIMIT 5',
        args: [`%${normPhone}%`],
      });
      for (const cand of phoneCandidates.rows) {
        if (cand.contact && normalizePhoneNumber(String(cand.contact)) === normPhone) {
          const candId = String(cand.id);
          if (candId === 'usr_admin_1') {
            return NextResponse.json(
              { error: 'This phone number is reserved for Master Administrator N Jayakumar.' },
              { status: 400 }
            );
          }
          matchedUserId = candId;
          break;
        }
      }
    }

    // High-grade salted bcrypt hash for bulletproof password encryption
    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const now = new Date().toISOString();

    if (matchedUserId) {
      // Seamlessly sync existing employee: update credentials & set new password
      await db.execute({
        sql: `UPDATE users 
              SET name = ?, contact = ?, email = ?, password_hash = ?, role = ?, last_active_at = ?
              WHERE id = ?`,
        args: [cleanName, formattedPhone, cleanGmail, passwordHash, cleanRole, now, matchedUserId],
      });

      // Audit log employee credential sync/update by administrator
      await db.execute({
        sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          session.userId,
          'EMPLOYEE_SYNCED_BY_ADMIN',
          'user',
          matchedUserId,
          JSON.stringify({
            updatedById: session.userId,
            updatedByName: session.name,
            employeeId: matchedUserId,
            email: cleanGmail,
            name: cleanName,
            contact: formattedPhone,
            role: cleanRole,
            passwordReset: true,
          }),
          now,
        ],
      });

      return NextResponse.json({
        success: true,
        message: `Employee "${cleanName}" credentials synced successfully. Ready to sign in.`,
        user: {
          id: matchedUserId,
          email: cleanGmail,
          name: cleanName,
          contact: formattedPhone,
          role: cleanRole,
          created_at: now,
          last_sign_in_at: null,
          last_active_at: now,
          metrics: { quoteCount: 0, totalValue: 0, approvedCount: 0, draftCount: 0 },
          quotations: [],
          activities: [],
        },
      });
    }

    // Brand new employee account creation
    const userId = `usr_emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await db.execute({
      sql: `INSERT INTO users (id, email, name, contact, role, password_hash, last_sign_in_at, last_active_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
      args: [userId, cleanGmail, cleanName, formattedPhone, cleanRole, passwordHash, now],
    });

    // Audit log employee creation by administrator
    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        session.userId,
        'EMPLOYEE_CREATED_BY_ADMIN',
        'user',
        userId,
        JSON.stringify({
          createdById: session.userId,
          createdByName: session.name,
          employeeId: userId,
          email: cleanGmail,
          name: cleanName,
          contact: formattedPhone,
          role: cleanRole,
        }),
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      message: `Employee "${cleanName}" registered successfully.`,
      user: {
        id: userId,
        email: cleanGmail,
        name: cleanName,
        contact: formattedPhone,
        role: cleanRole,
        created_at: now,
        last_sign_in_at: null,
        last_active_at: null,
        metrics: { quoteCount: 0, totalValue: 0, approvedCount: 0, draftCount: 0 },
        quotations: [],
        activities: [],
      },
    });
  } catch (err: any) {
    console.error('Failed to create employee:', err);
    return NextResponse.json({ error: 'Failed to create employee account' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, name, contact, phnumber, email, gmail, password, role } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const db = getDb();
    const existingUserRes = await db.execute({
      sql: 'SELECT id, email, name, contact, role FROM users WHERE id = ? LIMIT 1',
      args: [userId],
    });

    if (existingUserRes.rows.length === 0) {
      return NextResponse.json({ error: 'Employee account not found.' }, { status: 404 });
    }

    const current = existingUserRes.rows[0];
    const currentEmail = String(current.email || '').toLowerCase();
    const currentName = String(current.name || '');

    // Prevent demoting primary administrator
    const nextRole = role ? (role === 'admin' ? 'admin' : 'staff') : String(current.role);
    if ((userId === 'usr_admin_1' || currentEmail === 'jeevanpranavagencies@gmail.com') && nextRole !== 'admin') {
      return NextResponse.json({ error: 'Cannot demote the primary Administrator account.' }, { status: 400 });
    }

    const updates: string[] = [];
    const args: any[] = [];

    let cleanName = currentName;
    if (name !== undefined) {
      cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length < 2) {
        return NextResponse.json({ error: 'Please enter the employee name (at least 2 characters).' }, { status: 400 });
      }
      updates.push('name = ?');
      args.push(cleanName);
    }

    const rawPhoneInput = contact !== undefined ? contact : phnumber;
    let formattedPhone = String(current.contact || '');
    if (rawPhoneInput !== undefined) {
      const rawPhone = typeof rawPhoneInput === 'string' ? rawPhoneInput.trim() : '';
      const normPhone = normalizePhoneNumber(rawPhone);
      if (!normPhone || normPhone.length < 10) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit phone number.' }, { status: 400 });
      }
      formattedPhone = formatPhoneNumber(rawPhone);

      const phoneCandidates = await db.execute({
        sql: 'SELECT id, contact FROM users WHERE id != ? AND contact LIKE ? LIMIT 10',
        args: [userId, `%${normPhone}%`],
      });
      for (const cand of phoneCandidates.rows) {
        if (cand.contact && normalizePhoneNumber(String(cand.contact)) === normPhone) {
          return NextResponse.json(
            { error: 'Another employee account already uses this Phone Number.' },
            { status: 409 }
          );
        }
      }
      updates.push('contact = ?');
      args.push(formattedPhone);
    }

    const rawEmailInput = email !== undefined ? email : gmail;
    let cleanGmail = currentEmail;
    if (rawEmailInput !== undefined) {
      cleanGmail = typeof rawEmailInput === 'string' ? rawEmailInput.toLowerCase().trim() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanGmail || !emailRegex.test(cleanGmail)) {
        return NextResponse.json({ error: 'Please provide a valid Gmail / Email address.' }, { status: 400 });
      }
      const dupEmail = await db.execute({
        sql: 'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1',
        args: [cleanGmail, userId],
      });
      if (dupEmail.rows.length > 0) {
        return NextResponse.json(
          { error: 'Another employee account already uses this Gmail address.' },
          { status: 409 }
        );
      }
      updates.push('email = ?');
      args.push(cleanGmail);
    }

    if (typeof password === 'string' && password.length > 0) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long.' }, { status: 400 });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      args.push(passwordHash);
    }

    if (role !== undefined && ['admin', 'staff'].includes(role)) {
      updates.push('role = ?');
      args.push(nextRole);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 });
    }

    args.push(userId);
    await db.execute({
      sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    // Keep quotations' created_by display name synced when employee name changes
    if (cleanName !== currentName) {
      await db.execute({
        sql: 'UPDATE quotations SET created_by = ? WHERE created_by_id = ?',
        args: [cleanName, userId],
      });
    }

    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        session.userId,
        'EMPLOYEE_UPDATED_BY_ADMIN',
        'user',
        userId,
        JSON.stringify({
          updatedById: session.userId,
          updatedByEmail: session.email,
          employeeId: userId,
          name: cleanName,
          email: cleanGmail,
          contact: formattedPhone,
          role: nextRole,
          passwordReset: Boolean(typeof password === 'string' && password.length > 0),
        }),
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      message: `Employee "${cleanName}" updated successfully.`,
      user: {
        id: userId,
        name: cleanName,
        email: cleanGmail,
        contact: formattedPhone,
        role: nextRole,
      },
    });
  } catch (err: any) {
    console.error('Failed to update employee:', err);
    return NextResponse.json({ error: 'Failed to update employee details' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
  }

  if (userId === 'usr_admin_1') {
    return NextResponse.json({ error: 'Cannot remove the primary Administrator account.' }, { status: 400 });
  }

  const db = getDb();
  try {
    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [userId],
    });

    return NextResponse.json({ success: true, message: 'Employee account removed' });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
