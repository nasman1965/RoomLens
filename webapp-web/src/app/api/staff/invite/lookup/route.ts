import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public API — no auth required
// GET /api/staff/invite/lookup?token=inv_xxx
// Uses service role to bypass RLS on team_members

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Look up the invite token
  const { data: member, error } = await supabaseAdmin
    .from('team_members')
    .select('id, full_name, role, email, invite_status, invite_expires_at, nda_accepted, user_id')
    .eq('invite_token', token)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Check expiry
  if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  // Already completed
  if (member.nda_accepted && member.invite_status === 'active') {
    return NextResponse.json({ error: 'already_done' }, { status: 409 });
  }

  // Fetch company name from admin's users record
  let companyName = 'Your Company';
  if (member.user_id) {
    const { data: userRec } = await supabaseAdmin
      .from('users')
      .select('company_name')
      .eq('id', member.user_id)
      .single();
    if (userRec?.company_name) companyName = userRec.company_name;
  }

  return NextResponse.json({
    id: member.id,
    full_name: member.full_name,
    role: member.role,
    email: member.email,
    invite_status: member.invite_status,
    nda_accepted: member.nda_accepted,
    company_name: companyName,
  });
}
