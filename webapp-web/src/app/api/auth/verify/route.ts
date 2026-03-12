import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/auth/verify
// Body: { user_id: string, role: 'admin' | 'staff' | 'superadmin' }
// Uses service role to bypass RLS — returns what the user is allowed to access

export async function POST(req: NextRequest) {
  try {
    const { user_id, role } = await req.json();
    if (!user_id || !role) {
      return NextResponse.json({ error: 'Missing user_id or role' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (role === 'superadmin') {
      const { data: sa } = await supabaseAdmin
        .from('super_admins')
        .select('id')
        .eq('user_id', user_id)
        .single();

      if (!sa) {
        return NextResponse.json({ allowed: false, error: 'Not a super admin' });
      }
      return NextResponse.json({ allowed: true, redirect: '/super-admin' });
    }

    if (role === 'staff') {
      const { data: member } = await supabaseAdmin
        .from('team_members')
        .select('id, full_name, role, invite_status, auth_user_id')
        .eq('auth_user_id', user_id)
        .single();

      if (!member) {
        // Also try by email as fallback (in case auth_user_id wasn't linked yet)
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (user?.email) {
          const { data: memberByEmail } = await supabaseAdmin
            .from('team_members')
            .select('id, full_name, role, invite_status, auth_user_id')
            .eq('email', user.email)
            .single();

          if (memberByEmail) {
            // Auto-link the auth_user_id if missing
            if (!memberByEmail.auth_user_id) {
              await supabaseAdmin
                .from('team_members')
                .update({ auth_user_id: user_id })
                .eq('id', memberByEmail.id);
            }
            // Update last login
            await supabaseAdmin
              .from('team_members')
              .update({ last_login_at: new Date().toISOString(), invite_status: 'active' })
              .eq('id', memberByEmail.id);

            return NextResponse.json({
              allowed: true,
              redirect: '/staff/dashboard',
              member: {
                id: memberByEmail.id,
                full_name: memberByEmail.full_name,
                role: memberByEmail.role,
              },
            });
          }
        }

        return NextResponse.json({
          allowed: false,
          error: 'Your staff account has not been set up yet. Contact your admin.',
        });
      }

      if (member.invite_status === 'suspended') {
        return NextResponse.json({
          allowed: false,
          error: 'Your account has been suspended. Contact your admin.',
        });
      }

      // Update last login
      await supabaseAdmin
        .from('team_members')
        .update({ last_login_at: new Date().toISOString(), invite_status: 'active' })
        .eq('id', member.id);

      return NextResponse.json({
        allowed: true,
        redirect: '/staff/dashboard',
        member: { id: member.id, full_name: member.full_name, role: member.role },
      });
    }

    if (role === 'admin') {
      // For admin, just verify the user exists in auth
      // Optionally check they have a users/profiles record
      const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('id, full_name, company_name, role')
        .eq('id', user_id)
        .single();

      // If no users record yet, they just signed up — create one
      if (!userRecord) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (user) {
          await supabaseAdmin.from('users').upsert({
            id: user_id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            role: 'admin',
          });
        }
      }

      return NextResponse.json({
        allowed: true,
        redirect: '/dashboard',
        user: userRecord,
      });
    }

    return NextResponse.json({ error: 'Unknown role' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
