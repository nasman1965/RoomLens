'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Briefcase, Clock, CheckCircle, AlertTriangle, Plus, TrendingUp, Users } from 'lucide-react';
import WorkflowProgressBar from '@/components/WorkflowProgressBar';

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
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({ total: 0, active: 0, review: 0, closed: 0 });
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      setUserName(session.user.user_metadata?.full_name || session.user.email || 'User');

      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, status, current_step, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (jobs) {
        setStats({
          total: jobs.length,
          active: jobs.filter(j => j.status === 'active' || j.status === 'dispatched').length,
          review: jobs.filter(j => j.status === 'review').length,
          closed: jobs.filter(j => j.status === 'closed').length,
        });
        setRecentJobs(jobs.slice(0, 5));
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const STATUS_BADGE: Record<string, string> = {
    new:        'bg-blue-100 text-blue-700',
    dispatched: 'bg-purple-100 text-purple-700',
    active:     'bg-green-100 text-green-700',
    review:     'bg-yellow-100 text-yellow-700',
    closed:     'bg-gray-100 text-gray-500',
    draft:      'bg-gray-100 text-gray-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back, {userName.split(' ')[0]} 👋</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
          <Plus className="w-4 h-4" />
          New Job
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs',    value: stats.total,  icon: Briefcase,      color: 'blue'   },
          { label: 'Active',        value: stats.active, icon: TrendingUp,     color: 'green'  },
          { label: 'In Review',     value: stats.review, icon: AlertTriangle,  color: 'yellow' },
          { label: 'Closed',        value: stats.closed, icon: CheckCircle,    color: 'gray'   },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className={`inline-flex p-2 rounded-lg bg-${color}-50 mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Recent Jobs
            </h2>
            <Link href="/jobs" className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center">
                <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No jobs yet</p>
                <Link href="/jobs/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                  Create your first job →
                </Link>
              </div>
            ) : recentJobs.map(job => (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600">
                    {job.insured_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{job.property_address}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[job.status] || 'bg-gray-100 text-gray-600'}`}>
                    {job.status}
                  </span>
                  <span className="text-xs text-gray-400">Step {job.current_step}/15</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-500" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Link href="/jobs/new"
                className="flex items-center gap-2 w-full text-left p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-sm text-blue-700 font-medium">
                <Plus className="w-4 h-4" /> Create New Job
              </Link>
              <Link href="/jobs?status=active"
                className="flex items-center gap-2 w-full text-left p-3 rounded-lg bg-green-50 hover:bg-green-100 transition text-sm text-green-700 font-medium">
                <TrendingUp className="w-4 h-4" /> View Active Jobs
              </Link>
              <Link href="/reports"
                className="flex items-center gap-2 w-full text-left p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition text-sm text-purple-700 font-medium">
                <Briefcase className="w-4 h-4" /> Generate Report
              </Link>
            </div>
          </div>

          {stats.active > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <WorkflowProgressBar
                compact
                currentStep={Math.floor(stats.active * 3)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
