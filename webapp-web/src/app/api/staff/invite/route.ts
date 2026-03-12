import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin-only API route to send staff invite
// POST /api/staff/invite
// Body: { member_id, email, full_name, temp_password, company_name, admin_user_id }

export async function POST(req: NextRequest) {
  try {
    const { member_id, email, full_name, temp_password, company_name, admin_user_id } = await req.json();

    if (!member_id || !email || !full_name || !temp_password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use service role to create auth user + send invite
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate unique invite token
    const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://roomlenspro.com'}/staff/invite/${token}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create Supabase auth user with temp password
    let authUserId: string | null = null;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      authUserId = existingUser.id;
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: temp_password,
        email_confirm: true,
      });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: temp_password,
        email_confirm: true, // Skip email confirmation — we're sending our own invite
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
    await supabaseAdmin.from('team_members').update({
      auth_user_id: authUserId,
      invite_token: token,
      invite_status: 'invited',
      invite_sent_at: new Date().toISOString(),
      invite_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    }).eq('id', member_id);

    // Build SMS/invite message
    const smsMessage = `Hi ${full_name.split(' ')[0]}! You've been invited to RoomLens Pro by ${company_name || 'your company'}.\n\nClick to set up your account:\n${inviteUrl}\n\nTemp password: ${temp_password}\n\nLink expires in 7 days.`;

    return NextResponse.json({
      success: true,
      invite_url: inviteUrl,
      auth_user_id: authUserId,
      sms_message: smsMessage,
      token,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
