import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';

export async function GET() {
  await seedDb();
  const db = getDb();
  const result = await db.execute('SELECT * FROM company_profiles WHERE is_default = 1 LIMIT 1');
  return NextResponse.json(
    { profile: result.rows[0] || null },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

export async function PUT(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json();
    const {
      id = 'cmp_jpa_master',
      name,
      tagline,
      gstin,
      address,
      phone,
      email,
      website,
      bank_name,
      account_no,
      ifsc_code,
      branch,
      signatory_name,
      signatory_designation,
      logo_url,
    } = body;

    const now = new Date().toISOString();

    // Check if target profile exists
    const existing = await db.execute({
      sql: 'SELECT id FROM company_profiles WHERE id = ? OR is_default = 1 LIMIT 1',
      args: [id],
    });
    const targetId = existing.rows[0]?.id ? String(existing.rows[0].id) : id;

    await db.execute({
      sql: `UPDATE company_profiles SET 
            name = ?, tagline = ?, gstin = ?, address = ?, phone = ?, email = ?, website = ?,
            bank_name = ?, account_no = ?, ifsc_code = ?, branch = ?,
            signatory_name = ?, signatory_designation = ?, logo_url = ?, updated_at = ?
            WHERE id = ?`,
      args: [
        name,
        tagline || null,
        gstin,
        address,
        phone || null,
        email || null,
        website || null,
        bank_name || null,
        account_no || null,
        ifsc_code || null,
        branch || null,
        signatory_name || null,
        signatory_designation || null,
        logo_url || '/logo-clean.png',
        now,
        targetId,
      ],
    });

    // Ensure all existing quotations link directly to this active company profile
    await db.execute({
      sql: 'UPDATE quotations SET company_profile_id = ? WHERE company_profile_id IS NULL OR company_profile_id = ?',
      args: [targetId, targetId],
    });

    // Fetch the updated record
    const updated = await db.execute({
      sql: 'SELECT * FROM company_profiles WHERE id = ? LIMIT 1',
      args: [targetId],
    });

    return NextResponse.json(
      { success: true, profile: updated.rows[0] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
