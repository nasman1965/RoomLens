'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Job, JobStatus, JOB_STATUS_COLORS, JOB_STATUS_LABELS, JOB_TYPE_ICONS, JOB_TYPE_LABELS } from '@/types';
import {
  Plus, Search, LayoutList, Columns2, Loader2, Briefcase,
  Trash2, MoreHorizontal, MapPin, Calendar,
} from 'lucide-react';

const STATUSES: JobStatus[] = ['draft', 'active', 'complete', 'invoiced'];

function KanbanColumn({ status, jobs, onUpdate, onDelete }: {
  status: JobStatus; jobs: Job[];
  onUpdate: (id: string, s: JobStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${JOB_STATUS_COLORS[status]}`}>
        <span className="text-xs font-bold uppercase tracking-wider">{JOB_STATUS_LABELS[status]}</span>
        <span className="text-xs font-bold bg-white/30 rounded-full px-1.5 py-0.5">{jobs.length}</span>
      </div>
      <div className="flex-1 bg-gray-100 rounded-b-xl p-2 space-y-2 min-h-32">
        {jobs.map(job => (
          <div key={job.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-lg">{JOB_TYPE_ICONS[job.job_type]}</span>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                <button onClick={() => onDelete(job.id)} className="text-red-400 hover:text-red-600 p-0.5">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <Link href={`/jobs/${job.id}`}>
              <p className="text-sm font-semibold text-gray-900 hover:text-blue-700 truncate">{job.property_address}</p>
            </Link>
            <p className="text-xs text-gray-400 mt-1">{JOB_TYPE_LABELS[job.job_type]}</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {STATUSES.filter(s => s !== status).map(s => (
                <button key={s} onClick={() => onUpdate(job.id, s)}
                  className={`text-xs px-1.5 py-0.5 rounded-full ${JOB_STATUS_COLORS[s]} hover:opacity-80 transition-opacity`}>
                  → {JOB_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-xs">No jobs</div>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [userId, setUserId] = useState('');

  const loadJobs = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'jobs'), where('user_id', '==', uid), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setJobs(snap.docs.map(d => ({ ...d.data(), id: d.id } as Job)));
    } catch { setJobs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { router.push('/login'); return; }
      setUserId(u.uid);
      loadJobs(u.uid);
    });
    return unsub;
  }, [router, loadJobs]);

  const handleStatusUpdate = async (jobId: string, newStatus: JobStatus) => {
    try {
      await updateDoc(doc(db, 'jobs', jobId), { status: newStatus });
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    } catch { /* ignore */ }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch { /* ignore */ }
  };

  const filtered = jobs.filter(j => {
    const matchSearch = j.property_address.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Jobs</h1>
          <p className="text-gray-500 text-sm mt-0.5">{jobs.length} total job{jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ background: '#0a1628' }}>
          <Plus size={15} /> New Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by address…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as JobStatus | 'all')}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
          </select>
          <div className="flex border border-gray-200 rounded-xl bg-white overflow-hidden">
            <button onClick={() => setView('list')} className={`px-3 py-2 ${view === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
              <LayoutList size={16} />
            </button>
            <button onClick={() => setView('kanban')} className={`px-3 py-2 ${view === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
              <Columns2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <Briefcase size={42} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">{search || statusFilter !== 'all' ? 'No matching jobs found' : 'No jobs yet'}</p>
          {!search && statusFilter === 'all' && (
            <Link href="/jobs/new"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0a1628' }}>
              <Plus size={15} /> Create First Job
            </Link>
          )}
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map(s => (
            <KanbanColumn key={s} status={s}
              jobs={filtered.filter(j => j.status === s)}
              onUpdate={handleStatusUpdate} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {filtered.map(job => (
            <div key={job.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                {JOB_TYPE_ICONS[job.job_type]}
              </div>
              <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{job.property_address}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={11} /> {JOB_TYPE_LABELS[job.job_type]}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={11} />
                    {new Date(job.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </Link>
              <span className={`badge ${JOB_STATUS_COLORS[job.status]}`}>{JOB_STATUS_LABELS[job.status]}</span>
              <div className="relative group/menu">
                <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal size={16} />
                </button>
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg hidden group-hover/menu:block z-10">
                  {STATUSES.filter(s => s !== job.status).map(s => (
                    <button key={s} onClick={() => handleStatusUpdate(job.id, s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 first:rounded-t-xl">
                      Mark {JOB_STATUS_LABELS[s]}
                    </button>
                  ))}
                  <button onClick={() => handleDelete(job.id)}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-b-xl">
                    Delete Job
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden uid usage to suppress lint warning */}
      <span className="hidden">{userId}</span>
    </div>
  );
}
