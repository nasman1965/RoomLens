'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile, updatePassword, User, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile, SubscriptionTier } from '@/types';
import { User as UserIcon, Lock, Crown, Loader2, Check, AlertCircle } from 'lucide-react';

const PLANS: { tier: SubscriptionTier; label: string; price: string; jobs: string; features: string[] }[] = [
  { tier: 'free', label: 'Free', price: '$0/mo', jobs: '3 jobs/month', features: ['All 4 modules', 'Expo mobile app', '5 GB storage'] },
  { tier: 'starter', label: 'Starter', price: '$49/mo', jobs: '20 jobs/month', features: ['Everything in Free', 'PDF reports', 'Email support'] },
  { tier: 'pro', label: 'Pro', price: '$99/mo', jobs: 'Unlimited jobs', features: ['Everything in Starter', 'GPT-4o Vision AI', 'Priority support'] },
  { tier: 'enterprise', label: 'Enterprise', price: 'Custom', jobs: 'Unlimited + API', features: ['Custom integrations', 'White-label', 'Dedicated CSM'] },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
      setCompanyName(u.displayName || '');
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      } catch { /* ignore */ }
    });
    return unsub;
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyName.trim()) return;
    setSavingProfile(true); setProfileMsg('');
    try {
      await updateProfile(user, { displayName: companyName });
      await updateDoc(doc(db, 'users', user.uid), { company_name: companyName });
      setProfileMsg('Profile saved!');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch { setProfileMsg('Save failed.'); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassErr(''); setPassMsg('');
    if (newPass.length < 8) { setPassErr('New password must be at least 8 characters.'); return; }
    if (newPass !== confirmPass) { setPassErr('Passwords do not match.'); return; }
    if (!user?.email) return;
    setSavingPass(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
      setPassMsg('Password changed!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setTimeout(() => setPassMsg(''), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPassErr('Current password is incorrect.');
      } else {
        setPassErr('Password change failed. Please try again.');
      }
    } finally { setSavingPass(false); }
  };

  const currentTier = profile?.subscription_tier || 'free';

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>

      {/* Profile */}
      <div className="card p-6">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <UserIcon size={18} /> Profile
        </h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={user?.email || ''} readOnly
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-not-allowed" />
          </div>
          {profileMsg && (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <Check size={14} /> {profileMsg}
            </div>
          )}
          <button type="submit" disabled={savingProfile}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
            style={{ background: '#0a1628' }}>
            {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Profile
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="card p-6">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Lock size={18} /> Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {['Current Password', 'New Password', 'Confirm New Password'].map((label, i) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
              <input type="password"
                value={i === 0 ? currentPass : i === 1 ? newPass : confirmPass}
                onChange={e => i === 0 ? setCurrentPass(e.target.value) : i === 1 ? setNewPass(e.target.value) : setConfirmPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          {passErr && <div className="flex items-center gap-2 text-red-600 text-sm"><AlertCircle size={14} />{passErr}</div>}
          {passMsg && <div className="flex items-center gap-2 text-green-700 text-sm"><Check size={14} />{passMsg}</div>}
          <button type="submit" disabled={savingPass}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
            style={{ background: '#0a1628' }}>
            {savingPass ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Change Password
          </button>
        </form>
      </div>

      {/* Plan */}
      <div className="card p-6">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Crown size={18} /> Subscription Plan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map(plan => (
            <div key={plan.tier}
              className={`rounded-xl border-2 p-4 ${currentTier === plan.tier ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">{plan.label}</span>
                {currentTier === plan.tier && <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-lg font-extrabold text-gray-900">{plan.price}</p>
              <p className="text-xs text-gray-500 mb-2">{plan.jobs}</p>
              <ul className="space-y-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-1 text-xs text-gray-600">
                    <Check size={11} className="text-green-500 mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {currentTier !== plan.tier && plan.tier !== 'enterprise' && (
                <button className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: '#0a1628' }}
                  onClick={() => alert('Stripe billing coming soon!')}>
                  Upgrade
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
