'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StaffSidebar from '@/components/StaffSidebar';
import {
  Briefcase, MapPin, Clock, CheckCircle,
  AlertTriangle, ChevronRight, Navigation, Phone
} from 'lucide-react';

interface AssignedJob {
  id: string;
  insured_name: string;
  property_address: string;
  status: string;
  loss_date: string;
  insurer_name: string;
  assignment_status: string;
  assigned_at: string;
  dispatch_notes: string | null;
  clocked_in: boolean;
}

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  cell_phone: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  dispatched:  'bg-blue-900/40 text-blue-300 border-blue-700/40',
  accepted:    'bg-teal-900/40 text-teal-300 border-teal-700/40',
  in_progress: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  completed:   'bg-green-900/40 text-green-300 border-green-700/40',
  declined:    'bg-red-900/40 text-red-300 border-red-700/40',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  active:     'bg-green-900/40 text-green-300',
  dispatched: 'bg-blue-900/40 text-blue-300',
  new:        'bg-slate-700 text-slate-300',
  review:     'bg-yellow-900/40 text-yellow-300',
  closed:     'bg-slate-800 text-slate-500',
};

export default function StaffDashboard() {
  const router = useRouter();
  const [staff, setStaff]   = useState<StaffMember | null>(null);
  const [jobs, setJobs]     = useState<AssignedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }));

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Find team_member record linked to this auth user
      const { data: member } = await supabase
        .from('team_members')
        .select('id, full_name, role, cell_phone')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!member) {
        // Not yet linked — show pending state
        setLoading(false);
        return;
      }
      setStaff(member);

      // Get all jobs assigned to this staff member
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select(`
          id, status, assigned_at, dispatch_notes,
          jobs (
            id, insured_name, property_address, status,
            loss_date, insurer_name
          )
        `)
        .eq('member_id', member.id)
        .neq('status', 'declined')
        .order('assigned_at', { ascending: false });

      if (assignments) {
        // Check if clocked in for each job
        const clockChecks = await Promise.all(
          assignments.map(async (a: any) => {
            const { data: clock } = await supabase
              .from('time_clock_entries')
              .select('id')
              .eq('job_id', a.jobs?.id)
              .eq('member_id', member.id)
              .is('clock_out_at', null)
              .single();
            return {
              id: a.jobs?.id,
              insured_name: a.jobs?.insured_name,
              property_address: a.jobs?.property_address,
              status: a.jobs?.status,
              loss_date: a.jobs?.loss_date,
              insurer_name: a.jobs?.insurer_name,
              assignment_status: a.status,
              assigned_at: a.assigned_at,
              dispatch_notes: a.dispatch_notes,
              clocked_in: !!clock,
            };
          })
        );
        setJobs(clockChecks);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const activeJobs = jobs.filter(j => j.assignment_status !== 'completed');
  const completedJobs = jobs.filter(j => j.assignment_status === 'completed');

  if (loading) return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading your jobs...</div>
      </div>
    </div>
  );

  if (!staff) return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-yellow-900/40 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Account Not Linked</h2>
          <p className="text-slate-400 text-sm">Your account hasn&apos;t been linked to a staff profile yet. Contact your admin to complete setup.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Field Staff Portal</p>
              <h1 className="text-white font-bold text-2xl">
                👷 {staff.full_name}
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">{today}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-900/40 text-teal-300 border border-teal-700/40 capitalize">
                {staff.role.replace('_', ' ')}
              </span>
              {jobs.filter(j => j.clocked_in).length > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-900/40 text-green-300 border border-green-700/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  On Site
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Jobs',    value: activeJobs.length,    icon: Briefcase, color: 'text-blue-400'  },
              { label: 'Clocked In',     value: jobs.filter(j=>j.clocked_in).length, icon: Clock, color: 'text-green-400' },
              { label: 'Completed',      value: completedJobs.length, icon: CheckCircle, color: 'text-teal-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Active Jobs */}
          <div>
            <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-400" />
              My Active Jobs
            </h2>

            {activeJobs.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
                <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No jobs dispatched yet.</p>
                <p className="text-slate-500 text-xs mt-1">Your admin will assign jobs to you here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.map(job => (
                  <div key={job.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 hover:border-teal-600/50 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[job.assignment_status] || STATUS_COLORS.dispatched}`}>
                            {job.assignment_status.replace('_',' ').toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${JOB_STATUS_COLORS[job.status] || 'bg-slate-700 text-slate-300'}`}>
                            {job.status?.toUpperCase()}
                          </span>
                          {job.clocked_in && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 animate-pulse">
                              ● CLOCKED IN
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-semibold text-sm truncate">{job.insured_name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-slate-400 text-xs truncate">{job.property_address}</span>
                        </div>
                        {job.insurer_name && (
                          <p className="text-slate-500 text-xs mt-0.5">📋 {job.insurer_name}</p>
                        )}
                        {job.dispatch_notes && (
                          <div className="mt-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-1.5">
                            <p className="text-yellow-300 text-xs">📝 {job.dispatch_notes}</p>
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/staff/jobs/${job.id}`}
                        className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0"
                      >
                        Open <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(job.property_address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Navigate
                      </a>
                      {staff.cell_phone && (
                        <a href={`tel:${staff.cell_phone}`}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-green-400 transition ml-3">
                          <Phone className="w-3.5 h-3.5" /> Call Office
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div>
              <h2 className="text-slate-500 font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Completed Jobs ({completedJobs.length})
              </h2>
              <div className="space-y-2">
                {completedJobs.map(job => (
                  <div key={job.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">{job.insured_name}</p>
                      <p className="text-slate-500 text-xs">{job.property_address}</p>
                    </div>
                    <Link href={`/staff/jobs/${job.id}`}
                      className="text-slate-500 hover:text-white text-xs flex items-center gap-1 transition">
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
