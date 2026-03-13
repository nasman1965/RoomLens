import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin-only API route: upsert public.users → insert team_member → create auth user → send invite
// POST /api/staff/invite
// Body: { email, full_name, role, cell_phone?, notes?, temp_password, company_name, admin_user_id }

async function sendTwilioSMS(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, error: 'Twilio not configured' };
  }

  const cleanPhone = to.replace(/\D/g, '');
  const e164 = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: fromNumber, To: e164, Body: body }).toString(),
      }
    );
    const data = await res.json();
    if (data.error_code) return { sent: false, error: `Twilio ${data.error_code}: ${data.message}` };
    return { sent: true };
  } catch (err: unknown) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      email, full_name, role, cell_phone, notes,
      temp_password, company_name, admin_user_id,
      // legacy: member_id passed when team_member already exists
      member_id: existingMemberId,
    } = await req.json();

    if (!email || !full_name || !temp_password || !admin_user_id) {
      return NextResponse.json({ error: 'Missing required fields (email, full_name, temp_password, admin_user_id)' }, { status: 400 });
    }

    // ── Service-role client (bypasses RLS, can write to auth + users) ──────
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── STEP 1: Ensure public.users row exists for admin_user_id ────────────
    // This is the FK that team_members.user_id references.
    // We always use supabaseAdmin (service role) so we can bypass RLS.
    // If service role key is missing, fall back to a raw INSERT that RLS allows
    // (auth.uid() = admin_user_id, so the policy passes).

    let adminEmail = '';
    let adminName  = '';

    const hasServiceRole = !!(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (hasServiceRole) {
      const { data: adminAuthUser } = await supabaseAdmin.auth.admin.getUserById(admin_user_id);
      adminEmail = adminAuthUser?.user?.email || '';
      adminName  = adminAuthUser?.user?.user_metadata?.full_name || adminEmail.split('@')[0];
    }

    // Upsert the users row — safe to run multiple times
    const { error: upsertUserErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id:           admin_user_id,
        email:        adminEmail || undefined,
        full_name:    adminName  || undefined,
        company_name: company_name || 'My Company',
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'id' });

    if (upsertUserErr) {
      // Non-fatal: row may already exist, or table schema differs
      console.warn('users upsert warning (non-fatal):', upsertUserErr.message);
    }

    // ── STEP 2: Create or reuse the team_members row ────────────────────────
    let memberId = existingMemberId;

    if (!memberId) {
      const { data: nm, error: insertErr } = await supabaseAdmin
        .from('team_members')
        .insert({
          user_id:    admin_user_id,
          full_name,
          role:       role || 'tech',
          cell_phone: cell_phone || null,
          email:      email,
          notes:      notes || null,
          is_active:  true,
        })
        .select('id')
        .single();

      if (insertErr || !nm) {
        return NextResponse.json(
          { error: insertErr?.message || 'Failed to create team member' },
          { status: 400 }
        );
      }
      memberId = nm.id;
    }

    // ── STEP 3: Create or update Supabase auth user ─────────────────────────
    let authUserId: string | null = null;

    if (!hasServiceRole) {
      // No service role key — skip auth user creation.
      // Employee can still be added to team_members; invite link won't
      // work for login until service role key is configured in Vercel.
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping auth user creation');
      authUserId = 'pending'; // placeholder so flow continues
    } else {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = existingUsers?.users?.find(u => u.email === email);

      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          password: temp_password,
          email_confirm: true,
        });
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: temp_password,
          email_confirm: true,
          user_metadata: { full_name, role: 'staff', company: company_name },
        });
        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 400 });
        }
        authUserId = newUser.user?.id || null;
      }

      if (!authUserId) {
        return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 });
      }
    }

    // ── STEP 4: Generate invite token + link to team_member ─────────────────
    const token     = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://roomlenspro.com'}/staff/invite/${token}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatePayload: Record<string, unknown> = {
      invite_token:      token,
      invite_status:     'invited',
      invite_sent_at:    new Date().toISOString(),
      invite_expires_at: expiresAt.toISOString(),
      invited_at:        new Date().toISOString(),
    };
    // Only set auth_user_id if we actually created an auth user
    if (authUserId && authUserId !== 'pending') {
      updatePayload.auth_user_id = authUserId;
    }

    const { error: updateError } = await supabaseAdmin.from('team_members')
      .update(updatePayload).eq('id', memberId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save invite token: ' + updateError.message }, { status: 500 });
    }

    // Read back confirmed token from DB
    const { data: savedMember } = await supabaseAdmin
      .from('team_members').select('invite_token').eq('id', memberId).single();

    const confirmedToken     = savedMember?.invite_token || token;
    const confirmedInviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://roomlenspro.com'}/staff/invite/${confirmedToken}`;

    // ── STEP 5: Build SMS ────────────────────────────────────────────────────
    const firstName  = full_name.split(' ')[0];
    const smsMessage = `Hi ${firstName}! You've been invited to RoomLens Pro by ${company_name || 'your company'}.

Click to set up your account:
${confirmedInviteUrl}

Temp password: ${temp_password}

Link expires in 7 days.`;

    // ── STEP 6: Auto-send SMS via Twilio if phone provided ───────────────────
    let smsSent = false;
    let smsError = '';
    if (cell_phone) {
      const result = await sendTwilioSMS(cell_phone, smsMessage);
      smsSent   = result.sent;
      smsError  = result.error || '';
    }

    return NextResponse.json({
      success:      true,
      member_id:    memberId,
      invite_url:   confirmedInviteUrl,
      auth_user_id: authUserId,
      sms_message:  smsMessage,
      sms_sent:     smsSent,
      sms_error:    smsError || null,
      token:        confirmedToken,
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
