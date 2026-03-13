'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Filter, Briefcase, MapPin, ChevronRight } from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
  property_city: string | null;
  claim_number: string | null;
  insurer_name: string | null;
  status: string;
  current_step: number;
  job_type: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  new:        { label: 'New',        dot: 'bg-blue-400',    bg: 'bg-blue-900/30',    text: 'text-blue-300'   },
  dispatched: { label: 'Dispatched', dot: 'bg-purple-400',  bg: 'bg-purple-900/30',  text: 'text-purple-300' },
  active:     { label: 'Active',     dot: 'bg-emerald-400', bg: 'bg-emerald-900/30', text: 'text-emerald-300'},
  review:     { label: 'Review',     dot: 'bg-amber-400',   bg: 'bg-amber-900/30',   text: 'text-amber-300'  },
  closed:     { label: 'Closed',     dot: 'bg-slate-500',   bg: 'bg-slate-700/50',   text: 'text-slate-400'  },
  draft:      { label: 'Draft',      dot: 'bg-slate-600',   bg: 'bg-slate-700/50',   text: 'text-slate-400'  },
  stopped:    { label: 'Stopped',    dot: 'bg-red-400',     bg: 'bg-red-900/30',     text: 'text-red-300'    },
};

const JOB_TYPE_ICON: Record<string, string> = {
  water_loss: '💧',
  fire_loss:  '🔥',
  mold:       '🌿',
  large_loss: '🏗️',
  other:      '📋',
};

const STATUS_FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'new',        label: 'New' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'active',     label: 'Active' },
  { value: 'review',     label: 'Review' },
  { value: 'closed',     label: 'Closed' },
  { value: 'stopped',    label: 'Stopped' },
];

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [filtered, setFiltered]   = useState<Job[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setFilter] = useState('all');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, property_city, claim_number, insurer_name, status, current_step, job_type, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(data || []);
      setFiltered(data || []);
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    let result = jobs;
    if (statusFilter !== 'all') result = result.filter(j => j.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(j =>
        j.insured_name.toLowerCase().includes(q) ||
        j.property_address.toLowerCase().includes(q) ||
        (j.claim_number?.toLowerCase().includes(q)) ||
        (j.insurer_name?.toLowerCase().includes(q))
      );
    }
    setFiltered(result);
  }, [search, statusFilter, jobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-slate-400 text-sm">{jobs.length} total job{jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition shadow-lg shadow-cyan-500/20">
          <Plus className="w-4 h-4" /> New Job
        </Link>
      </div>

      {/* Search + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, address, claim #..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter} onChange={e => setFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          >
            {STATUS_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Pill Filters (quick tab style) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
              statusFilter === f.value
                ? 'bg-cyan-500 border-cyan-500 text-slate-900'
                : 'bg-slate-800/60 border-slate-600/40 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400'
            }`}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1.5 opacity-60">
                {jobs.filter(j => j.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Job List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-14 text-center">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">
            {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your search'}
          </p>
          {jobs.length === 0 && (
            <Link href="/jobs/new" className="text-cyan-400 text-sm hover:text-cyan-300 mt-3 inline-block">
              Create your first job →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 divide-y divide-slate-700/30">
          {filtered.map(job => {
            const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 transition group">
                {/* Job type */}
                <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center text-xl shrink-0">
                  {JOB_TYPE_ICON[job.job_type] || '📋'}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition">
                      {job.insured_name}
                    </p>
                    {job.claim_number && (
                      <span className="text-xs text-slate-500 shrink-0">#{job.claim_number}</span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-500 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {job.property_address}{job.property_city ? `, ${job.property_city}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500">
                      {JOB_TYPE_ICON[job.job_type]} {job.job_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    {job.insurer_name && (
                      <span className="text-[10px] text-slate-500">• {job.insurer_name}</span>
                    )}
                  </div>
                </div>
                {/* Status */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">Step {job.current_step}/15</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
