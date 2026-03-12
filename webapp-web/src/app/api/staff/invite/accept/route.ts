import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/staff/invite/accept
// Body: { member_id, action: 'nda' | 'activate', signed_name?, company_name? }
// Uses service role to write NDA acceptance and mark invite active

export async function POST(req: NextRequest) {
  try {
    const { member_id, action, signed_name, company_name } = await req.json();

    if (!member_id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (action === 'nda') {
      if (!signed_name) {
        return NextResponse.json({ error: 'signed_name required for NDA' }, { status: 400 });
      }

      // Insert NDA acceptance record
      await supabaseAdmin.from('nda_acceptances').insert({
        member_id,
        signed_name,
        nda_version: 'v1.0',
        company_name: company_name || 'RoomLens Pro',
      });

      // Update team_member NDA fields
      const { error } = await supabaseAdmin.from('team_members').update({
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        nda_signed_name: signed_name,
      }).eq('id', member_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'nda' });
    }

    if (action === 'activate') {
      // Mark invite as active (called after password is set)
      const { error } = await supabaseAdmin.from('team_members').update({
        invite_status: 'active',
        onboarded_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      }).eq('id', member_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'activate' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
