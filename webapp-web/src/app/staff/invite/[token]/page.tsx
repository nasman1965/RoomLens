'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Building2, Shield, CheckCircle, AlertTriangle, Loader2, Eye, EyeOff, Lock, User } from 'lucide-react';

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  email: string;
  invite_status: string;
  invite_expires_at: string;
  nda_accepted: boolean;
  user_id: string;
}

const NDA_TEXT = `NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT

This agreement is between you (the "Employee/Contractor") and the company operating through RoomLens Pro ("Company").

1. CONFIDENTIALITY
You agree to keep confidential all client information, job details, property addresses, insurance claims, financial data, and any proprietary business information accessed through RoomLens Pro. This includes but is not limited to: client names, addresses, claim numbers, insurance carrier information, photos, documents, and communications.

2. DATA PROTECTION
You agree not to share, copy, distribute, or use any client or company data outside of your authorized work duties. You will not take screenshots, export, or transmit client data to any third party.

3. PROFESSIONAL CONDUCT
You agree to maintain professional conduct at all job sites, treat client property with respect, and represent the company appropriately at all times.

4. DEVICE & ACCESS SECURITY
You agree to keep your login credentials secure, not share your password, and immediately report any suspected unauthorized access to your account.

5. TERMINATION
Upon termination of employment or contract, you agree to immediately cease use of RoomLens Pro and all company systems. All access will be revoked.

6. LEGAL COMPLIANCE
You agree to comply with all applicable laws including privacy legislation (PIPEDA in Canada), and to report any data breaches or security incidents immediately.

By signing below, you confirm you have read, understood, and agree to be bound by this agreement.`;

export default function StaffInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token  = params.token as string;

  const [step, setStep]         = useState<'loading'|'expired'|'already_done'|'nda'|'password'|'done'>('loading');
  const [member, setMember]     = useState<StaffMember | null>(null);
  const [signedName, setSignedName] = useState('');
  const [agreed, setAgreed]     = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showTempPass, setShowTempPass] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const init = async () => {
      // Look up invite token
      const { data: m } = await supabase
        .from('team_members')
        .select('id, full_name, role, email, invite_status, invite_expires_at, nda_accepted, user_id')
        .eq('invite_token', token)
        .single();

      if (!m) { setStep('expired'); return; }

      // Check if expired
      if (m.invite_expires_at && new Date(m.invite_expires_at) < new Date()) {
        setStep('expired'); return;
      }

      // Already onboarded
      if (m.nda_accepted && m.invite_status === 'active') {
        setStep('already_done'); return;
      }

      // Get company name from admin profile
      const { data: profile } = await supabase
        .from('users').select('company_name').eq('id', m.user_id).single();
      setCompanyName(profile?.company_name || 'RoomLens Pro Company');

      setMember(m);
      setStep('nda');
    };
    init();
  }, [token]);

  const handleNDAAccept = async () => {
    if (!agreed) { setError('You must check the agreement box.'); return; }
    if (!signedName.trim()) { setError('Please type your full name to sign.'); return; }
    if (signedName.trim().toLowerCase() !== member!.full_name.toLowerCase()) {
      setError(`Please type your exact full name: "${member!.full_name}"`);
      return;
    }
    setLoading(true); setError('');

    // Record NDA acceptance
    await supabase.from('nda_acceptances').insert({
      member_id: member!.id,
      signed_name: signedName.trim(),
      nda_version: 'v1.0',
      company_name: companyName,
    });

    await supabase.from('team_members').update({
      nda_accepted: true,
      nda_accepted_at: new Date().toISOString(),
      nda_signed_name: signedName.trim(),
    }).eq('id', member!.id);

    setLoading(false);
    setStep('password');
  };

  const handleSetPassword = async () => {
    if (!tempPassword) {
      setError('Please enter the temporary password sent to you by your admin.'); return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters.'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (newPassword === tempPassword) {
      setError('Your new password must be different from the temporary password.'); return;
    }
    setLoading(true); setError('');

    // Step 1: Sign in with the temp password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: member!.email,
      password: tempPassword,
    });

    if (signInError || !signInData.session) {
      setLoading(false);
      setError('Temporary password is incorrect. Please check the password in your invite message.');
      return;
    }

    // Step 2: Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setLoading(false);
      setError('Failed to set new password: ' + updateError.message);
      return;
    }

    // Step 3: Mark as active
    await supabase.from('team_members').update({
      invite_status: 'active',
      onboarded_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    }).eq('id', member!.id);

    setLoading(false);
    setStep('done');
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
    </div>
  );

  // ── EXPIRED ───────────────────────────────────────────────────────────────
  if (step === 'expired') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-900/40 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-white font-bold text-xl mb-2">Invite Link Expired</h1>
        <p className="text-slate-400 text-sm">This invite link is invalid or has expired. Contact your admin for a new invite.</p>
      </div>
    </div>
  );

  // ── ALREADY DONE ──────────────────────────────────────────────────────────
  if (step === 'already_done') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-green-900/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-white font-bold text-xl mb-2">Already Activated</h1>
        <p className="text-slate-400 text-sm mb-6">Your account is already set up. Log in to continue.</p>
        <a href="/login" className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm inline-block">
          Go to Login →
        </a>
      </div>
    </div>
  );

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-white font-bold text-2xl mb-2">
          Welcome, {member?.full_name.split(' ')[0]}! 👷
        </h1>
        <p className="text-teal-300 font-semibold text-base mb-1">{companyName}</p>
        <p className="text-slate-400 text-sm mb-2">Your account is ready.</p>
        <p className="text-slate-500 text-xs mb-6">NDA signed ✅ · Account activated ✅ · Password set ✅</p>
        <a href="/login"
          className="w-full block bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition text-sm text-center">
          Log In to RoomLens Pro →
        </a>
        <p className="text-slate-600 text-xs mt-3">Select "Field Staff" on the login screen</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 mb-3 shadow-xl">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">RoomLens Pro</h1>
          <p className="text-teal-300 text-sm font-semibold mt-1">{companyName}</p>
          {member && (
            <p className="text-slate-400 text-sm mt-1">Welcome, <strong className="text-white">{member.full_name}</strong></p>
          )}
        </div>

        {/* ── NDA STEP ───────────────────────────────────────────── */}
        {step === 'nda' && (
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-900/60 flex items-center justify-center">
                <Shield className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Step 1 of 2 — Sign NDA</p>
                <p className="text-slate-400 text-xs">Review and sign the confidentiality agreement</p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex gap-2 mb-5">
              <div className="h-1.5 flex-1 rounded-full bg-teal-500" />
              <div className="h-1.5 flex-1 rounded-full bg-slate-600" />
            </div>

            {/* NDA Text */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 h-48 overflow-y-auto mb-4 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono">
              {NDA_TEXT}
            </div>

            {/* Agree checkbox */}
            <label className="flex items-start gap-3 cursor-pointer mb-4 group">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-500 accent-teal-500 cursor-pointer" />
              <span className="text-slate-300 text-sm leading-snug">
                I have read and agree to the Non-Disclosure and Confidentiality Agreement above. I understand my obligations as a staff member of <strong className="text-white">{companyName}</strong>.
              </span>
            </label>

            {/* Typed signature */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Type your full name to sign
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={signedName}
                  onChange={e => setSignedName(e.target.value)}
                  placeholder={member?.full_name}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-medium italic"
                />
              </div>
              <p className="text-slate-500 text-xs mt-1">Must match exactly: <span className="text-slate-300">{member?.full_name}</span></p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg p-3 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <button onClick={handleNDAAccept} disabled={loading || !agreed || !signedName}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <>I Agree & Sign NDA →</>}
            </button>
          </div>
        )}

        {/* ── PASSWORD STEP ───────────────────────────────────────── */}
        {step === 'password' && (
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-900/60 flex items-center justify-center">
                <Lock className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Step 2 of 2 — Set Your Password</p>
                <p className="text-slate-400 text-xs">Enter your temporary password, then create a new one</p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex gap-2 mb-5">
              <div className="h-1.5 flex-1 rounded-full bg-teal-500" />
              <div className="h-1.5 flex-1 rounded-full bg-teal-500" />
            </div>

            <div className="bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-green-300 text-xs">NDA signed successfully as <strong>{signedName}</strong></p>
            </div>

            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2 mb-4">
              <p className="text-blue-300 text-xs font-semibold mb-0.5">📱 Find your temporary password</p>
              <p className="text-slate-400 text-xs">It was included in the invite text message/link sent by your admin.</p>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Temporary Password (from invite)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showTempPass ? 'text' : 'password'}
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-amber-700/50 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button type="button" onClick={() => setShowTempPass(!showTempPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                    {showTempPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg p-3 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <button onClick={handleSetPassword} disabled={loading || !tempPassword || !newPassword || !confirmPassword}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating account...</> : <>Activate My Account →</>}
            </button>
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-5">
          © 2026 RoomLens Pro · Secured invite link
        </p>
      </div>
    </div>
  );
}
