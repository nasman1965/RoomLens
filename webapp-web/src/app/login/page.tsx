'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Shield, Building2, Users, Mail, Lock,
  Eye, EyeOff, AlertCircle, Loader2, ChevronRight, ArrowLeft
} from 'lucide-react';

// ─── Role types shown on the login selector ────────────────────────────────────
const ROLES = [
  {
    id: 'admin',
    label: 'Company Admin',
    sublabel: 'Manage your restoration company',
    icon: <Building2 className="w-6 h-6" />,
    color: 'border-blue-500 bg-blue-600',
    bg: 'bg-blue-900/20 border-blue-700/40 hover:border-blue-500',
    badge: 'Your Company Portal',
    badgeColor: 'bg-blue-900/60 text-blue-300',
    description: 'Access jobs, team, reports & settings for your company.',
    redirect: '/dashboard',
  },
  {
    id: 'staff',
    label: 'Field Staff',
    sublabel: 'Technicians & crew members',
    icon: <Users className="w-6 h-6" />,
    color: 'border-teal-500 bg-teal-600',
    bg: 'bg-teal-900/20 border-teal-700/40 hover:border-teal-500',
    badge: 'Staff Access',
    badgeColor: 'bg-teal-900/60 text-teal-300',
    description: 'View and update jobs assigned to you in the field.',
    redirect: '/dashboard',
  },
  {
    id: 'superadmin',
    label: 'Super Admin',
    sublabel: 'Platform administration only',
    icon: <Shield className="w-6 h-6" />,
    color: 'border-red-500 bg-red-600',
    bg: 'bg-red-900/20 border-red-700/40 hover:border-red-500',
    badge: 'Nasser only',
    badgeColor: 'bg-red-900/60 text-red-300',
    description: 'Manage all tenants, billing, plans and platform settings.',
    redirect: '/super-admin',
  },
];

// ─── Inner component that uses useSearchParams (must be inside Suspense) ───────
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep]           = useState<'select' | 'login'>('select');
  const [selectedRole, setSelectedRole] = useState<typeof ROLES[0] | null>(null);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [mode, setMode]           = useState<'login' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);

  // If ?role=superadmin in URL, skip selector
  useEffect(() => {
    const role = searchParams.get('role');
    if (role) {
      const found = ROLES.find(r => r.id === role);
      if (found) { setSelectedRole(found); setStep('login'); }
    }
  }, [searchParams]);

  const selectRole = (role: typeof ROLES[0]) => {
    setSelectedRole(role);
    setStep('login');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) setError('Invalid email or password. Please try again.');
        else if (signInError.message.includes('Email not confirmed')) setError('Please verify your email before signing in.');
        else setError(signInError.message);
        return;
      }

      if (!data.session) { setError('Sign in failed. Please try again.'); return; }

      // ── Smart redirect based on selected role + actual DB role ──────────────
      if (selectedRole?.id === 'superadmin') {
        // Verify they are actually a super admin
        const { data: sa } = await supabase
          .from('super_admins')
          .select('id')
          .eq('user_id', data.session.user.id)
          .single();

        if (!sa) {
          setError('You do not have Super Admin access.');
          await supabase.auth.signOut();
          return;
        }
        router.push('/super-admin');
      } else {
        // Check if super admin trying regular login → redirect to super-admin
        const { data: sa } = await supabase
          .from('super_admins')
          .select('id')
          .eq('user_id', data.session.user.id)
          .single();

        if (sa) {
          router.push('/super-admin');
        } else {
          const redirect = searchParams.get('redirect') || '/dashboard';
          router.push(redirect);
        }
      }
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) setError(resetError.message);
      else setResetSent(true);
    } catch {
      setError('Reset failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── STEP 1: Role selector ──────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-xl shadow-blue-900/40">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">RoomLens Pro</h1>
            <p className="text-slate-400 text-sm mt-1">Restoration Management Platform</p>
          </div>

          <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-2xl">
            <p className="text-white font-semibold text-lg mb-1">Who are you signing in as?</p>
            <p className="text-slate-400 text-sm mb-6">Select your role to continue to the right portal.</p>

            <div className="space-y-3">
              {ROLES.map(role => (
                <button key={role.id} type="button" onClick={() => selectRole(role)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border ${role.bg} transition-all group`}>
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${role.color} flex items-center justify-center text-white shrink-0 shadow-lg`}>
                    {role.icon}
                  </div>
                  {/* Text */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white font-semibold text-sm">{role.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role.badgeColor}`}>
                        {role.badge}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs">{role.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition shrink-0" />
                </button>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-700 text-center">
              <p className="text-slate-500 text-xs">
                New to RoomLens Pro?{' '}
                <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                  Create a company account →
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            © 2026 RoomLens Pro · <a href="https://roomlenspro.com" className="hover:text-slate-400">roomlenspro.com</a>
          </p>
        </div>
      </div>
    );
  }

  // ── STEP 2: Login form (role-specific) ──────────────────────────────────────
  const role = selectedRole!;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Back button */}
        <button onClick={() => { setStep('select'); setError(''); setMode('login'); setResetSent(false); }}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Back to role selection
        </button>

        {/* Role badge header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${role.color} mb-3 shadow-xl`}>
            {role.icon}
          </div>
          <h1 className="text-2xl font-bold text-white">{role.label}</h1>
          <p className="text-slate-400 text-sm mt-1">{role.sublabel}</p>
          <span className={`inline-block mt-2 text-[10px] font-bold px-3 py-1 rounded-full ${role.badgeColor}`}>
            {role.badge}
          </span>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-7 shadow-2xl">
          {mode === 'login' ? (
            <>
              <h2 className="text-white font-semibold text-lg mb-5">
                {role.id === 'superadmin' ? '🔐 Super Admin Sign In' :
                 role.id === 'staff' ? '👷 Staff Sign In' : '🏢 Company Sign In'}
              </h2>

              {error && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg p-3 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder={role.id === 'superadmin' ? 'admin@roomlenspro.com' : 'you@company.com'}
                      autoComplete="email" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="••••••••" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className={`w-full ${
                    role.id === 'superadmin' ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-800' :
                    role.id === 'staff' ? 'bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800' :
                    'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800'
                  } text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 mt-1`}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
                </button>
              </form>

              <button onClick={() => { setMode('reset'); setError(''); }}
                className="mt-4 w-full text-center text-sm text-slate-400 hover:text-blue-400 transition">
                Forgot password?
              </button>

              {role.id !== 'superadmin' && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  No account?{' '}
                  <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">Create one</Link>
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Reset Password</h2>
              <p className="text-slate-400 text-sm mb-5">Enter your email and we&apos;ll send a reset link.</p>

              {error && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg p-3 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              {resetSent ? (
                <div className="bg-green-900/30 border border-green-700/40 text-green-300 text-sm rounded-lg p-4 text-center">
                  ✅ Reset link sent to <strong>{email}</strong>. Check your inbox.
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="you@company.com" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Send Reset Link'}
                  </button>
                </form>
              )}
              <button onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
                className="mt-4 w-full text-center text-sm text-slate-400 hover:text-white transition">
                ← Back to sign in
              </button>
            </>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2026 RoomLens Pro · <a href="https://roomlenspro.com" className="hover:text-slate-400">roomlenspro.com</a>
        </p>
      </div>
    </div>
  );
}

// ─── Loading fallback while Suspense resolves ──────────────────────────────────
function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">RoomLens Pro</h1>
        <p className="text-slate-400 text-sm mt-1">Loading...</p>
      </div>
    </div>
  );
}

// ─── Default export wrapped in Suspense (required for useSearchParams in Next 14) ─
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}
