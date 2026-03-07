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

const STATUS_BADGE: Record<string, string> = {
  new:        'bg-blue-100 text-blue-700 border-blue-200',
  dispatched: 'bg-purple-100 text-purple-700 border-purple-200',
  active:     'bg-green-100 text-green-700 border-green-200',
  review:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  closed:     'bg-gray-100 text-gray-500 border-gray-200',
  draft:      'bg-gray-100 text-gray-400 border-gray-200',
  stopped:    'bg-red-100 text-red-700 border-red-200',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  water_loss: '💧 Water Loss',
  fire_loss:  '🔥 Fire Loss',
  mold:       '🌿 Mold',
  large_loss: '🏗️ Large Loss',
  other:      '📋 Other',
};

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filtered, setFiltered] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
    if (statusFilter !== 'all') {
      result = result.filter(j => j.status === statusFilter);
    }
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
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500 text-sm">{jobs.length} total job{jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
          <Plus className="w-4 h-4" /> New Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, address, claim #..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="dispatched">Dispatched</option>
            <option value="active">Active</option>
            <option value="review">In Review</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Job List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your search'}
          </p>
          {jobs.length === 0 && (
            <Link href="/jobs/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              Create your first job →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {filtered.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 transition group">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600">
                    {job.insured_name}
                  </p>
                  {job.claim_number && (
                    <span className="text-xs text-gray-400">#{job.claim_number}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{job.property_address}{job.property_city ? `, ${job.property_city}` : ''}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400">
                    {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                  </span>
                  {job.insurer_name && (
                    <span className="text-[10px] text-gray-400">• {job.insurer_name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${STATUS_BADGE[job.status] || 'bg-gray-100 text-gray-600'}`}>
                    {job.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">Step {job.current_step}/15</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
