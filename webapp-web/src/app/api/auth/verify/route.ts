import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/auth/verify
// Body: { user_id, role: 'admin' | 'management_admin' | 'staff' | 'superadmin' }
// Uses service role to bypass RLS

export async function POST(req: NextRequest) {
  try {
    const { user_id, role } = await req.json();
    if (!user_id || !role) {
      return NextResponse.json({ error: 'Missing user_id or role' }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── SUPER ADMIN ──────────────────────────────────────────────────────────
    if (role === 'superadmin') {
      const { data: sa } = await admin
        .from('super_admins').select('id').eq('user_id', user_id).single();
      if (!sa) return NextResponse.json({ allowed: false, error: 'Not a super admin' });
      return NextResponse.json({ allowed: true, redirect: '/super-admin' });
    }

    // ── FIELD STAFF ──────────────────────────────────────────────────────────
    if (role === 'staff') {
      let member = null;

      const { data: m1 } = await admin
        .from('team_members')
        .select('id, full_name, role, portal_role, invite_status, auth_user_id')
        .eq('auth_user_id', user_id)
        .single();

      member = m1;

      // Fallback: look up by email
      if (!member) {
        const { data: { user } } = await admin.auth.admin.getUserById(user_id);
        if (user?.email) {
          const { data: m2 } = await admin
            .from('team_members')
            .select('id, full_name, role, portal_role, invite_status, auth_user_id')
            .eq('email', user.email)
            .single();
          if (m2) {
            if (!m2.auth_user_id) {
              await admin.from('team_members').update({ auth_user_id: user_id }).eq('id', m2.id);
            }
            member = m2;
          }
        }
      }

      if (!member) {
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

      // Staff with portal_role=management_admin should NOT use staff login
      if (member.portal_role === 'management_admin') {
        return NextResponse.json({
          allowed: false,
          error: 'Please use Management Admin login for your account.',
        });
      }

      await admin.from('team_members')
        .update({ last_login_at: new Date().toISOString(), invite_status: 'active' })
        .eq('id', member.id);

      return NextResponse.json({
        allowed: true,
        redirect: '/staff/dashboard',
        member: { id: member.id, full_name: member.full_name, role: member.role },
      });
    }

    // ── MANAGEMENT ADMIN ─────────────────────────────────────────────────────
    if (role === 'management_admin') {
      // Check users table first (if they have a users record with management_admin role)
      const { data: userRecord } = await admin
        .from('users')
        .select('id, full_name, company_name, portal_role')
        .eq('id', user_id)
        .single();

      if (userRecord && userRecord.portal_role === 'management_admin') {
        return NextResponse.json({
          allowed: true,
          redirect: '/dashboard',
          portal_role: 'management_admin',
          user: userRecord,
        });
      }

      // Also check team_members with portal_role=management_admin
      const { data: member } = await admin
        .from('team_members')
        .select('id, full_name, role, portal_role, invite_status, auth_user_id')
        .eq('auth_user_id', user_id)
        .eq('portal_role', 'management_admin')
        .single();

      if (!member) {
        return NextResponse.json({
          allowed: false,
          error: 'No Management Admin account found. Contact your Company Admin.',
        });
      }

      if (member.invite_status === 'suspended') {
        return NextResponse.json({
          allowed: false,
          error: 'Your account has been suspended. Contact your Company Admin.',
        });
      }

      await admin.from('team_members')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', member.id);

      return NextResponse.json({
        allowed: true,
        redirect: '/dashboard',
        portal_role: 'management_admin',
        member: { id: member.id, full_name: member.full_name, role: member.role },
      });
    }

    // ── COMPANY ADMIN (admin) ────────────────────────────────────────────────
    if (role === 'admin') {
      const { data: userRecord } = await admin
        .from('users')
        .select('id, full_name, company_name, role, portal_role')
        .eq('id', user_id)
        .single();

      if (!userRecord) {
        const { data: { user } } = await admin.auth.admin.getUserById(user_id);
        if (user) {
          await admin.from('users').upsert({
            id: user_id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            role: 'admin',
            portal_role: 'company_admin',
            access_level: 1,
          });
        }
      }

      // Prevent management_admin users from logging in as company_admin
      if (userRecord?.portal_role === 'management_admin') {
        return NextResponse.json({
          allowed: false,
          error: 'Please use Management Admin login for your account.',
        });
      }

      return NextResponse.json({
        allowed: true,
        redirect: '/dashboard',
        portal_role: 'company_admin',
        user: userRecord,
      });
    }

    return NextResponse.json({ error: 'Unknown role' }, { status: 400 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
