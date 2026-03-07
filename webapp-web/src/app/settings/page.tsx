'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Building2, Mail, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: string;
  subscription_tier: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userRecord) {
        setProfile(userRecord);
        setFullName(userRecord.full_name || '');
        setCompanyName(userRecord.company_name || '');
      } else {
        // Profile doesn't exist, use auth data
        setProfile({
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata?.full_name || '',
          company_name: session.user.user_metadata?.company_name || '',
          role: 'admin',
          subscription_tier: 'free',
        });
        setFullName(session.user.user_metadata?.full_name || '');
        setCompanyName(session.user.user_metadata?.company_name || '');
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          email: session.user.email!,
          full_name: fullName,
          company_name: companyName,
          role: profile?.role || 'admin',
          subscription_tier: profile?.subscription_tier || 'free',
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        setError(upsertError.message);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const TIER_BADGES: Record<string, string> = {
    free:       'bg-gray-100 text-gray-600',
    starter:    'bg-blue-100 text-blue-700',
    pro:        'bg-purple-100 text-purple-700',
    enterprise: 'bg-gold-100 text-yellow-700',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your profile and account</p>
      </div>

      {/* Plan Badge */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Current Plan</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full capitalize ${TIER_BADGES[profile?.subscription_tier || 'free']}`}>
                {profile?.subscription_tier || 'free'}
              </span>
              <span className="text-xs text-gray-400 capitalize">• {profile?.role} role</span>
            </div>
          </div>
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Upgrade Plan →
          </button>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" /> Profile Information
        </h2>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4">
            <CheckCircle className="w-4 h-4 shrink-0" /> Profile saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email" value={profile?.email || ''} disabled
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="John Smith"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Smith Restoration Inc."
              />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-5 rounded-lg transition text-sm">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-5">
        <h2 className="text-base font-semibold text-red-700 mb-3">Danger Zone</h2>
        <p className="text-sm text-gray-600 mb-3">
          Deleting your account will permanently remove all jobs and data.
        </p>
        <button
          onClick={async () => {
            if (confirm('Are you sure? This cannot be undone.')) {
              await supabase.auth.signOut();
              router.push('/login');
            }
          }}
          className="text-sm text-red-600 border border-red-300 hover:bg-red-50 px-4 py-2 rounded-lg transition font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
