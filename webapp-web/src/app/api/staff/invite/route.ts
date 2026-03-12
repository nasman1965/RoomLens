import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin-only API route to send staff invite + auto-SMS via Twilio
// POST /api/staff/invite
// Body: { member_id, email, full_name, temp_password, company_name, admin_user_id, cell_phone? }

async function sendTwilioSMS(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, error: 'Twilio not configured' };
  }

  // Clean phone number — ensure it has country code
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
        body: new URLSearchParams({
          From: fromNumber,
          To: e164,
          Body: body,
        }).toString(),
      }
    );

    const data = await res.json();
    if (data.error_code) {
      return { sent: false, error: `Twilio error ${data.error_code}: ${data.message}` };
    }
    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      member_id, email, full_name, temp_password,
      company_name, admin_user_id, cell_phone,
    } = await req.json();

    if (!member_id || !email || !full_name || !temp_password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use service role to create auth user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate unique invite token
    const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://roomlenspro.com'}/staff/invite/${token}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create or update Supabase auth user
    let authUserId: string | null = null;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      authUserId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
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

    // Link auth user to team_member + store invite token
    const { error: updateError } = await supabaseAdmin.from('team_members').update({
      auth_user_id: authUserId,
      invite_token: token,
      invite_status: 'invited',
      invite_sent_at: new Date().toISOString(),
      invite_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    }).eq('id', member_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save invite token: ' + updateError.message }, { status: 500 });
    }

    // Read back the saved token to confirm what's actually in DB
    const { data: savedMember } = await supabaseAdmin
      .from('team_members')
      .select('invite_token')
      .eq('id', member_id)
      .single();

    const confirmedToken = savedMember?.invite_token || token;
    const confirmedInviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://roomlenspro.com'}/staff/invite/${confirmedToken}`;

    // Build SMS message using confirmed URL from DB
    const firstName = full_name.split(' ')[0];
    const smsMessage = `Hi ${firstName}! You've been invited to RoomLens Pro by ${company_name || 'your company'}.

Click to set up your account:
${confirmedInviteUrl}

Temp password: ${temp_password}

Link expires in 7 days.`;

    // Auto-send SMS via Twilio if phone provided
    let smsSent = false;
    let smsError = '';

    if (cell_phone) {
      const result = await sendTwilioSMS(cell_phone, smsMessage);
      smsSent = result.sent;
      smsError = result.error || '';
    }

    return NextResponse.json({
      success: true,
      invite_url: confirmedInviteUrl,
      auth_user_id: authUserId,
      sms_message: smsMessage,
      sms_sent: smsSent,
      sms_error: smsError || null,
      token: confirmedToken,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
