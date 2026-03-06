'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Job, JOB_STATUS_COLORS, JOB_STATUS_LABELS, JOB_TYPE_ICONS } from '@/types';
import {
  Plus, Briefcase, Map, Droplets, Camera, FileText,
  TrendingUp, Clock, CheckCircle2, Loader2,
} from 'lucide-react';

const MODULE_TILES = [
  { icon: '🗺️', label: '360° Floor Plans', desc: 'Capture and process room dimensions', href: '/floorplans', color: 'from-blue-500 to-blue-700' },
  { icon: '💧', label: 'Moisture Mapping', desc: 'IICRC S500 multi-day tracking', href: '/moisture', color: 'from-cyan-500 to-cyan-700' },
  { icon: '📸', label: 'Damage Photos', desc: 'AI-powered photo analysis', href: '/photos', color: 'from-purple-500 to-purple-700' },
  { icon: '📄', label: 'Estimate Draft', desc: 'Auto Xactimate line items', href: '/reports', color: 'from-amber-500 to-amber-700' },
];

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
      try {
        const q = query(
          collection(db, 'jobs'),
          where('user_id', '==', u.uid),
          orderBy('created_at', 'desc'),
          limit(5)
        );
        const snap = await getDocs(q);
        const data: Job[] = snap.docs.map(d => ({ ...d.data(), id: d.id } as Job));
        setJobs(data);
      } catch {
        // Firestore not configured yet — show empty state
      } finally { setLoading(false); }
    });
    return unsub;
  }, [router]);

  const activeCount = jobs.filter(j => j.status === 'active').length;
  const completeCount = jobs.filter(j => j.status === 'complete').length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
            {' '}{user?.displayName || 'there'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here&apos;s your restoration platform overview</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: '#0a1628' }}>
          <Plus size={16} /> New Job
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Briefcase} label="Total Jobs" value={jobs.length} sub="All time" color="bg-indigo-500" />
        <StatCard icon={Clock} label="Active Jobs" value={activeCount} sub="In progress" color="bg-blue-500" />
        <StatCard icon={CheckCircle2} label="Completed" value={completeCount} sub="This month" color="bg-green-500" />
        <StatCard icon={TrendingUp} label="Plan" value={user ? 'Free' : '—'} sub="3 jobs/month" color="bg-amber-500" />
      </div>

      {/* Module tiles */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Modules</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULE_TILES.map(tile => (
            <Link key={tile.href} href={tile.href}
              className="card p-5 hover:shadow-md transition-all group cursor-pointer">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform`}>
                {tile.icon}
              </div>
              <p className="text-sm font-bold text-gray-900">{tile.label}</p>
              <p className="text-xs text-gray-500 mt-1">{tile.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Jobs</h2>
          <Link href="/jobs" className="text-sm font-medium" style={{ color: '#0a1628' }}>View all →</Link>
        </div>
        {loading ? (
          <div className="card p-8 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-10 text-center">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No jobs yet</p>
            <p className="text-gray-400 text-sm mb-4">Create your first job to get started</p>
            <Link href="/jobs/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0a1628' }}>
              <Plus size={15} /> Create First Job
            </Link>
          </div>
        ) : (
          <div className="card divide-y divide-gray-50">
            {jobs.map(job => (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                  {JOB_TYPE_ICONS[job.job_type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{job.property_address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(job.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className={`badge ${JOB_STATUS_COLORS[job.status]}`}>{JOB_STATUS_LABELS[job.status]}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Map, label: 'Floor Plans', href: '/floorplans' },
          { icon: Droplets, label: 'Moisture', href: '/moisture' },
          { icon: Camera, label: 'Photos', href: '/photos' },
          { icon: FileText, label: 'Reports', href: '/reports' },
        ].map(({ icon: Icon, label, href }) => (
          <Link key={href} href={href}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-all text-sm font-medium text-gray-700 hover:text-gray-900">
            <Icon size={18} className="text-gray-400" /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
