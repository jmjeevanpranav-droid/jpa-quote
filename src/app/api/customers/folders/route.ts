import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';
import { normalizeCompanyName } from '@/lib/utils/formatters';

export async function GET(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const foldersRes = await db.execute('SELECT * FROM company_folders ORDER BY name ASC');
    const customersRes = await db.execute('SELECT id, company_name, trade_name, store_code, folder_name FROM customers');

    // Aggregate counts and units per folder
    const folderMap = new Map<string, { id: string; name: string; description?: string; gstin?: string; billing_address?: string; logo_url?: string; unitsCount: number; units: any[] }>();

    for (const f of foldersRes.rows) {
      const fName = String(f.name);
      folderMap.set(fName.toLowerCase(), {
        id: String(f.id),
        name: fName,
        description: f.description ? String(f.description) : undefined,
        gstin: f.gstin ? String(f.gstin) : undefined,
        billing_address: f.billing_address ? String(f.billing_address) : undefined,
        logo_url: f.logo_url ? String(f.logo_url) : undefined,
        unitsCount: 0,
        units: [],
      });
    }

    // Assign customer units to their folder
    for (const c of customersRes.rows) {
      const explicitFolder = c.folder_name ? String(c.folder_name).trim() : '';
      const derivedFolder = explicitFolder || normalizeCompanyName(String(c.company_name || ''));
      const key = derivedFolder.toLowerCase();

      if (!folderMap.has(key)) {
        folderMap.set(key, {
          id: `folder_auto_${key.replace(/\s+/g, '_')}`,
          name: derivedFolder,
          unitsCount: 0,
          units: [],
        });
      }

      const target = folderMap.get(key)!;
      target.unitsCount += 1;
      target.units.push({
        id: String(c.id),
        company_name: String(c.company_name),
        trade_name: c.trade_name ? String(c.trade_name) : null,
        store_code: c.store_code ? String(c.store_code) : null,
      });
    }

    const folders = Array.from(folderMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ folders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json();
    const { name, description, gstin, billingAddress, logoUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const folderName = name.trim();
    const folderId = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO company_folders (id, name, description, gstin, billing_address, logo_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET 
              description = COALESCE(excluded.description, company_folders.description),
              gstin = COALESCE(excluded.gstin, company_folders.gstin),
              billing_address = COALESCE(excluded.billing_address, company_folders.billing_address),
              logo_url = COALESCE(excluded.logo_url, company_folders.logo_url),
              updated_at = excluded.updated_at`,
      args: [
        folderId,
        folderName,
        description || null,
        gstin || null,
        billingAddress || null,
        logoUrl || null,
        now,
        now,
      ],
    });

    return NextResponse.json({ success: true, folderId, folderName, logoUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const body = await req.json();
    const { name, logoUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const folderName = name.trim();
    const now = new Date().toISOString();

    // Upsert or update logo_url for folder
    await db.execute({
      sql: `INSERT INTO company_folders (id, name, logo_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET 
              logo_url = excluded.logo_url,
              updated_at = excluded.updated_at`,
      args: [
        `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        folderName,
        logoUrl || null,
        now,
        now,
      ],
    });

    return NextResponse.json({ success: true, folderName, logoUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const name = url.searchParams.get('name');

    if (!id && !name) {
      return NextResponse.json({ error: 'Folder ID or name is required' }, { status: 400 });
    }

    if (id) {
      await db.execute({ sql: 'DELETE FROM company_folders WHERE id = ?', args: [id] });
    } else if (name) {
      await db.execute({ sql: 'DELETE FROM company_folders WHERE name = ?', args: [name] });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

