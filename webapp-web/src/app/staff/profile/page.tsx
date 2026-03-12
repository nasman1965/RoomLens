'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StaffSidebar from '@/components/StaffSidebar';
import { User, Phone, Mail, Briefcase, Shield } from 'lucide-react';

interface StaffProfile {
  full_name: string;
  role: string;
  cell_phone: string | null;
  email: string | null;
  is_active: boolean;
  invite_status: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', office: 'Office', estimator: 'Estimator',
  lead_tech: 'Lead Technician', tech: 'Technician',
  subcontractor: 'Subcontractor', other: 'Other',
};

export default function StaffProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setEmail(session.user.email || '');

      const { data: member } = await supabase
        .from('team_members')
        .select('full_name, role, cell_phone, email, is_active, invite_status')
        .eq('auth_user_id', session.user.id)
        .single();
      if (member) setProfile(member);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading profile...</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg">
          <h1 className="text-white font-bold text-2xl mb-6">My Profile</h1>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center text-2xl font-bold text-white">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-white font-bold text-lg">{profile?.full_name || '—'}</p>
              <p className="text-teal-400 text-sm">{ROLE_LABELS[profile?.role || ''] || profile?.role}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                profile?.is_active ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
              }`}>
                {profile?.is_active ? '● ACTIVE' : '● INACTIVE'}
              </span>
            </div>
          </div>

          {/* Info cards */}
          <div className="space-y-3">
            {[
              { icon: User,    label: 'Full Name',   value: profile?.full_name || '—' },
              { icon: Mail,    label: 'Login Email', value: email || '—' },
              { icon: Phone,   label: 'Cell Phone',  value: profile?.cell_phone || '—' },
              { icon: Briefcase, label: 'Role',      value: ROLE_LABELS[profile?.role || ''] || profile?.role || '—' },
              { icon: Shield,  label: 'Account',     value: profile?.invite_status?.toUpperCase() || '—' },
            ].map(item => (
              <div key={item.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">{item.label}</p>
                  <p className="text-white font-medium text-sm">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-slate-600 text-xs text-center mt-8">
            To update your profile, contact your company admin.
          </p>
        </div>
      </main>
    </div>
  );
}
