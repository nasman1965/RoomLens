'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import {
  Briefcase, Clock, CheckCircle, AlertTriangle, Plus,
  TrendingUp, Users, MapPin, ChevronRight, Zap,
} from 'lucide-react';

interface DashboardStats {
  total: number;
  active: number;
  review: number;
  closed: number;
}

interface RecentJob {
  id: string;
  insured_name: string;
  property_address: string;
  status: string;
  current_step: number;
  job_type: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  new:        { label: 'New',        dot: 'bg-blue-400',   bg: 'bg-blue-900/30',   text: 'text-blue-300'   },
  dispatched: { label: 'Dispatched', dot: 'bg-purple-400', bg: 'bg-purple-900/30', text: 'text-purple-300' },
  active:     { label: 'Active',     dot: 'bg-emerald-400', bg: 'bg-emerald-900/30', text: 'text-emerald-300' },
  review:     { label: 'Review',     dot: 'bg-amber-400',  bg: 'bg-amber-900/30',  text: 'text-amber-300'  },
  closed:     { label: 'Closed',     dot: 'bg-slate-500',  bg: 'bg-slate-800/50',  text: 'text-slate-400'  },
  draft:      { label: 'Draft',      dot: 'bg-slate-600',  bg: 'bg-slate-800/50',  text: 'text-slate-400'  },
  stopped:    { label: 'Stopped',    dot: 'bg-red-400',    bg: 'bg-red-900/30',    text: 'text-red-300'    },
};

const JOB_TYPE_ICON: Record<string, string> = {
  water_loss: '💧',
  fire_loss:  '🔥',
  mold:       '🌿',
  large_loss: '🏗️',
  other:      '📋',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const router = useRouter();
  const { ownerUserId, loading: ctxLoading } = useCompanyContext();
  const [stats, setStats]       = useState<DashboardStats>({ total: 0, active: 0, review: 0, closed: 0 });
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading]   = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Wait until company context has resolved ownerUserId
    if (ctxLoading || !ownerUserId) return;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const firstName = session.user.user_metadata?.full_name?.split(' ')[0]
        || session.user.email?.split('@')[0]
        || 'there';
      setUserName(firstName);

      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, status, current_step, job_type, created_at')
        .eq('user_id', ownerUserId)   // ← always the company_admin's id
        .order('created_at', { ascending: false });

      if (jobs) {
        setStats({
          total:  jobs.length,
          active: jobs.filter(j => ['active', 'dispatched'].includes(j.status)).length,
          review: jobs.filter(j => j.status === 'review').length,
          closed: jobs.filter(j => j.status === 'closed').length,
        });
        setRecentJobs(jobs.slice(0, 8));
      }
      setLoading(false);
    };
    init();
  }, [router, ownerUserId, ctxLoading]);

  if (loading || ctxLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mb-1">{today}</p>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, <span className="text-cyan-400">{userName}</span> 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Here&apos;s your restoration operations overview.</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition shadow-lg shadow-cyan-500/20">
          <Plus className="w-4 h-4" />
          New Job
        </Link>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs',  value: stats.total,  icon: Briefcase,     color: 'cyan',    iconBg: 'bg-cyan-500/10',    iconColor: 'text-cyan-400',    border: 'border-cyan-500/20'    },
          { label: 'Active',      value: stats.active, icon: TrendingUp,    color: 'emerald', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'In Review',   value: stats.review, icon: AlertTriangle, color: 'amber',   iconBg: 'bg-amber-500/10',   iconColor: 'text-amber-400',   border: 'border-amber-500/20'   },
          { label: 'Closed',      value: stats.closed, icon: CheckCircle,   color: 'slate',   iconBg: 'bg-slate-700/50',   iconColor: 'text-slate-400',   border: 'border-slate-600/30'   },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, border }) => (
          <div key={label} className={`bg-slate-800/60 backdrop-blur rounded-2xl border ${border} p-5`}>
            <div className={`inline-flex p-2.5 rounded-xl ${iconBg} mb-4`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-sm text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Jobs */}
        <div className="lg:col-span-2 bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50">
          <div className="flex justify-between items-center px-5 py-4 border-b border-slate-700/50">
            <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-cyan-400" />
              Recent Jobs
            </h2>
            <Link href="/jobs" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
              View all →
            </Link>
          </div>

          <div className="divide-y divide-slate-700/30">
            {recentJobs.length === 0 ? (
              <div className="p-10 text-center">
                <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No jobs yet</p>
                <Link href="/jobs/new" className="text-cyan-400 text-sm hover:text-cyan-300 mt-2 inline-block">
                  Create your first job →
                </Link>
              </div>
            ) : recentJobs.map(job => {
              const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
              return (
                <Link key={job.id} href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-700/30 transition group">
                  {/* Job type icon */}
                  <div className="w-9 h-9 rounded-lg bg-slate-700/60 flex items-center justify-center text-base shrink-0">
                    {JOB_TYPE_ICON[job.job_type] || '📋'}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition">
                      {job.insured_name}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {job.property_address}
                    </p>
                  </div>
                  {/* Status + step */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} shrink-0`} />
                      {sc.label}
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:block">
                      Step {job.current_step}/15
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-4 text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link href="/jobs/new"
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition text-sm text-cyan-300 font-medium">
                <Plus className="w-4 h-4" /> Create New Job
              </Link>
              <Link href="/jobs?status=active"
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition text-sm text-emerald-300 font-medium">
                <TrendingUp className="w-4 h-4" /> View Active Jobs
              </Link>
              <Link href="/employees"
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition text-sm text-purple-300 font-medium">
                <Users className="w-4 h-4" /> Manage Team
              </Link>
              <Link href="/reports"
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/30 transition text-sm text-slate-300 font-medium">
                <Briefcase className="w-4 h-4" /> Reports
              </Link>
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
            <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Status Overview
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Active',  value: stats.active, total: stats.total, color: 'bg-emerald-500' },
                { label: 'Review',  value: stats.review, total: stats.total, color: 'bg-amber-500'   },
                { label: 'Closed',  value: stats.closed, total: stats.total, color: 'bg-slate-600'   },
              ].map(({ label, value, total, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{label}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all`}
                      style={{ width: total > 0 ? `${(value / total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
