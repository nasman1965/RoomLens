'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Building2, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ background: '#0a1628' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#e63946' }}>
            <Building2 size={22} className="text-white" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">RoomLensPro</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Restoration documentation<br />at the speed of the job.
          </h1>
          <p className="text-blue-200 text-lg">
            Floor plans, moisture maps, photo logs, and Xactimate estimates — all in one platform.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { icon: '🗺️', label: '360° Floor Plans' },
              { icon: '💧', label: 'Moisture Mapping' },
              { icon: '📸', label: 'AI Photo Analysis' },
              { icon: '📄', label: 'Auto Estimates' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-blue-100 text-sm">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-300 text-sm">© 2026 RoomLensPro. Professional restoration platform.</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0a1628' }}>
              <Building2 size={20} className="text-white" />
            </div>
            <span className="text-gray-900 text-lg font-bold">RoomLensPro</span>
          </div>

          {mode === 'login' ? (
            <>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-gray-500 text-sm mb-8">Sign in to your account</p>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setMode('reset'); setError(''); }} className="text-sm font-medium" style={{ color: '#0a1628' }}>
                    Forgot password?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: '#0a1628' }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-6">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-semibold" style={{ color: '#0a1628' }}>Create one</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Reset password</h2>
              <p className="text-gray-500 text-sm mb-8">Enter your email and we&apos;ll send a reset link.</p>
              {resetSent ? (
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-center">
                  <p className="text-green-800 font-medium mb-1">✅ Reset email sent!</p>
                  <p className="text-green-700 text-sm">Check your inbox and follow the link.</p>
                  <button onClick={() => { setMode('login'); setResetSent(false); }} className="mt-4 text-sm font-semibold" style={{ color: '#0a1628' }}>
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                      <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: '#0a1628' }}>
                      {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send Reset Link'}
                    </button>
                  </form>
                  <button onClick={() => { setMode('login'); setError(''); }} className="mt-4 text-sm font-medium block mx-auto" style={{ color: '#0a1628' }}>
                    ← Back to sign in
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
