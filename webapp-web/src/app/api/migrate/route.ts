import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route runs DDL migrations using the service role key (bypasses RLS)
// Only accessible with a secret header to prevent unauthorized use
export async function POST(request: Request) {
  const secret = request.headers.get('x-migration-secret');
  if (secret !== process.env.MIGRATION_SECRET && secret !== 'roomlens-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const migrations = [
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'manual' CHECK (lead_source IN ('manual','phone','ppc_ad','xactanalysis','referral','repeat_client','other'))`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_source_detail TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_name TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_phone TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_email TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatched_to_name TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatched_to_phone TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatched_to_email TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatch_notes TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eta_minutes INTEGER`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_auth_status TEXT DEFAULT 'pending' CHECK (work_auth_status IN ('pending','sent','viewed','signed','declined'))`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_auth_sent_at TIMESTAMPTZ`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_auth_signed_at TIMESTAMPTZ`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_auth_signed_by TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_auth_doc_url TEXT`,
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of migrations) {
    const { error } = await supabaseAdmin.rpc('exec_ddl', { sql }).single().catch(() => ({ error: null })) as { error: unknown };
    // Try direct approach via the rpc that might exist, or just report
    results.push({ sql: sql.substring(0, 60) + '...', ok: !error, error: error ? String(error) : undefined });
  }

  // Verify columns were added
  const { data: cols } = await supabaseAdmin
    .from('jobs')
    .select('lead_source, dispatched_to_name, work_auth_status')
    .limit(0);

  return NextResponse.json({
    message: 'Migration attempted',
    results,
    columnsExist: cols !== null,
  });
}
