'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Building2, Users, FileText, Camera, Loader2,
  LogOut, Shield, AlertTriangle, ChevronRight,
  CheckCircle, Clock, MapPin, Phone, Mail,
} from 'lucide-react';

interface Tenant {
  id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  plan: string;
  status: string;
  owner_email: string;
}

interface Job {
  id: string;
  client_name: string;
  property_address: string;
  loss_type: string;
  status: string;
  current_step: number;
  created_at: string;
}

export default function TenantDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [loading, setLoading]     = useState(true);
  const [tenant, setTenant]       = useState<Tenant | null>(null);
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    (async () => {
      // 1. Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/tenant/${slug}/login`);
        return;
      }

      // 2. Load tenant by slug
      const { data: tenantData, error: tenantErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', slug)
        .single();

      if (tenantErr || !tenantData) {
        setError(`Company "${slug}" not found.`);
        setLoading(false);
        return;
      }

      if (tenantData.status === 'suspended') {
        setError('This account has been suspended. Contact support@roomlenspro.com');
        setLoading(false);
        return;
      }

      // 3. Check user belongs to this tenant
      const { data: membership } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', tenantData.id)
        .eq('user_id', session.user.id)
        .single();

      if (!membership) {
        setError('You are not a member of this organization.');
        setLoading(false);
        return;
      }

      setTenant(tenantData);
      setAuthorized(true);

      // 4. Load jobs for this tenant
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, client_name, property_address, loss_type, status, current_step, created_at')
        .eq('tenant_id', tenantData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setJobs(jobData || []);
      setLoading(false);
    })();
  }, [slug, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push(`/tenant/${slug}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading {slug}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-2xl border border-red-700/40 p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Access Denied</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button onClick={() => router.push('/login')}
            className="mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!authorized || !tenant) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{tenant.company_name}</p>
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              {slug}.roomlenspro.com
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${
            tenant.plan === 'pro' ? 'bg-purple-900/60 text-purple-300' :
            tenant.plan === 'enterprise' ? 'bg-yellow-900/60 text-yellow-300' :
            tenant.plan === 'starter' ? 'bg-blue-900/60 text-blue-300' :
            'bg-slate-700 text-slate-300'
          }`}>{tenant.plan}</span>
          <button onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 px-3 py-2 rounded-lg transition">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Jobs',   value: jobs.length,                           icon: <FileText className="w-4 h-4" />,  color: 'text-blue-400',  bg: 'bg-blue-900/20' },
            { label: 'Active',       value: jobs.filter(j => j.status === 'active').length,   icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-900/20' },
            { label: 'In Progress',  value: jobs.filter(j => j.current_step > 1).length,      icon: <Clock className="w-4 h-4" />,      color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
            { label: 'Stopped',      value: jobs.filter(j => j.status === 'stopped').length,  icon: <Shield className="w-4 h-4" />,     color: 'text-red-400',   bg: 'bg-red-900/20' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center ${s.color} mb-2`}>
                {s.icon}
              </div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-slate-400 text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Job',      icon: <FileText className="w-5 h-5" />,  href: '/jobs/new',   color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Upload Photos', icon: <Camera className="w-5 h-5" />,    href: '/photos',     color: 'bg-slate-700 hover:bg-slate-600' },
            { label: 'Team',          icon: <Users className="w-5 h-5" />,     href: '/settings?tab=team', color: 'bg-slate-700 hover:bg-slate-600' },
            { label: 'Settings',      icon: <Shield className="w-5 h-5" />,    href: '/settings',   color: 'bg-slate-700 hover:bg-slate-600' },
          ].map(action => (
            <button key={action.label} onClick={() => router.push(action.href)}
              className={`${action.color} text-white rounded-xl p-4 flex flex-col items-start gap-2 transition`}>
              {action.icon}
              <span className="text-sm font-semibold">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Jobs list */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <h3 className="text-white font-semibold text-sm">Recent Jobs</h3>
            <button onClick={() => router.push('/jobs')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              All Jobs <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-700/50">
            {jobs.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No jobs yet</p>
                <button onClick={() => router.push('/jobs/new')}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
                  Create first job →
                </button>
              </div>
            ) : jobs.map(job => (
              <div key={job.id} onClick={() => router.push(`/jobs/${job.id}`)}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-700/30 cursor-pointer transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{job.client_name || 'Unknown Client'}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize ${
                      job.status === 'active' ? 'bg-green-900/60 text-green-300' :
                      job.status === 'stopped' ? 'bg-red-900/60 text-red-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>{job.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {job.property_address && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {job.property_address}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 shrink-0">Step {job.current_step || 1}/9</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Powered by footer */}
        <div className="text-center py-3">
          <p className="text-xs text-slate-600">
            Powered by <a href="https://roomlenspro.com" className="text-slate-500 hover:text-slate-400">RoomLens Pro</a>
          </p>
        </div>
      </div>
    </div>
  );
}
