import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { seedDb } from '@/lib/db/seed';

export async function GET(req: NextRequest) {
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

export async function PATCH(req: NextRequest) {
  await seedDb();
  const session = await getSession(req);

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role || !['admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid user ID or role' }, { status: 400 });
    }

    const db = getDb();

    // Prevent demoting primary administrator
    if (userId === 'usr_admin_1' && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot demote the primary Administrator account.' }, { status: 400 });
    }

    await db.execute({
      sql: 'UPDATE users SET role = ? WHERE id = ?',
      args: [role, userId],
    });

    return NextResponse.json({ success: true, message: `Role updated to ${role}` });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
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
