'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StaffSidebar from '@/components/StaffSidebar';
import { Clock, Play, Square, MapPin, Briefcase, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ActiveClock {
  id: string;
  job_id: string;
  clock_in_at: string;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  job_name: string;
  job_address: string;
}

interface WeekEntry {
  id: string;
  job_id: string;
  job_name: string;
  clock_in_at: string;
  clock_out_at: string | null;
  duration_minutes: number | null;
  clock_in_lat: number | null;
}

export default function StaffClockPage() {
  const router = useRouter();
  const [memberId, setMemberId]         = useState<string | null>(null);
  const [activeClock, setActiveClock]   = useState<ActiveClock | null>(null);
  const [weekEntries, setWeekEntries]   = useState<WeekEntry[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<{id:string; insured_name:string; property_address:string}[]>([]);
  const [loading, setLoading]           = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed]           = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: member } = await supabase
        .from('team_members').select('id')
        .eq('auth_user_id', session.user.id).single();
      if (!member) { router.push('/staff/dashboard'); return; }
      setMemberId(member.id);
      await loadData(member.id);
      setLoading(false);
    };
    init();
  }, [router]);

  // Live elapsed timer
  useEffect(() => {
    if (!activeClock) return;
    const interval = setInterval(() => {
      const diff = Date.now() - new Date(activeClock.clock_in_at).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeClock]);

  const loadData = async (mId: string) => {
    // Check active clock
    const { data: active } = await supabase
      .from('time_clock_entries')
      .select('id, job_id, clock_in_at, clock_in_lat, clock_in_lng')
      .eq('member_id', mId).is('clock_out_at', null).single();

    if (active) {
      const { data: job } = await supabase
        .from('jobs').select('insured_name, property_address').eq('id', active.job_id).single();
      setActiveClock({ ...active, job_name: job?.insured_name || 'Unknown Job', job_address: job?.property_address || '' });
    }

    // This week's entries
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0,0,0,0);

    const { data: entries } = await supabase
      .from('time_clock_entries')
      .select('id, job_id, clock_in_at, clock_out_at, duration_minutes, clock_in_lat')
      .eq('member_id', mId)
      .gte('clock_in_at', weekStart.toISOString())
      .order('clock_in_at', { ascending: false });

    if (entries) {
      const enriched = await Promise.all(entries.map(async (e: any) => {
        const { data: job } = await supabase
          .from('jobs').select('insured_name').eq('id', e.job_id).single();
        return { ...e, job_name: job?.insured_name || 'Unknown' };
      }));
      setWeekEntries(enriched);
    }

    // Assigned jobs for quick clock-in
    const { data: assignments } = await supabase
      .from('job_assignments')
      .select('job_id, jobs(id, insured_name, property_address)')
      .eq('member_id', mId)
      .in('status', ['dispatched','accepted','in_progress']);

    if (assignments) {
      setAssignedJobs(assignments.map((a: any) => ({
        id: a.jobs?.id, insured_name: a.jobs?.insured_name, property_address: a.jobs?.property_address,
      })).filter(j => j.id));
    }
  };

  const getGPS = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch { return { lat: null, lng: null }; }
  };

  const clockIn = async (jobId: string) => {
    if (!memberId) return;
    setClockLoading(true);
    const { lat, lng } = await getGPS();
    const { data } = await supabase.from('time_clock_entries').insert({
      job_id: jobId, member_id: memberId, clock_in_lat: lat, clock_in_lng: lng,
    }).select('id, job_id, clock_in_at, clock_in_lat, clock_in_lng').single();
    await supabase.from('job_assignments')
      .update({ status: 'in_progress', accepted_at: new Date().toISOString() })
      .eq('job_id', jobId).eq('member_id', memberId);
    if (data) {
      const job = assignedJobs.find(j => j.id === jobId);
      setActiveClock({ ...data, job_name: job?.insured_name || '', job_address: job?.property_address || '' });
    }
    await loadData(memberId);
    setClockLoading(false);
  };

  const clockOut = async () => {
    if (!activeClock || !memberId) return;
    setClockLoading(true);
    const { lat, lng } = await getGPS();
    await supabase.from('time_clock_entries')
      .update({ clock_out_at: new Date().toISOString(), clock_out_lat: lat, clock_out_lng: lng })
      .eq('id', activeClock.id);
    setActiveClock(null);
    setElapsed('');
    await loadData(memberId);
    setClockLoading(false);
  };

  const weekTotal = weekEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  if (loading) return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading...</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="text-white font-bold text-2xl">Time Clock</h1>
          <p className="text-slate-400 text-sm mt-1">Track your hours on each job</p>
        </div>

        {/* Active Clock Banner */}
        {activeClock ? (
          <div className="bg-green-900/30 border border-green-600/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 font-bold text-sm uppercase tracking-wider">Currently Clocked In</span>
            </div>
            <p className="text-white font-bold text-xl mb-1">{activeClock.job_name}</p>
            <p className="text-green-300/70 text-sm flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {activeClock.job_address}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Since {new Date(activeClock.clock_in_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
              {activeClock.clock_in_lat && ' · 📍 GPS verified'}
            </p>
            {/* Live timer */}
            <div className="my-4 text-center">
              <span className="text-5xl font-mono font-bold text-green-300">{elapsed || '00:00:00'}</span>
            </div>
            <button onClick={clockOut} disabled={clockLoading}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm">
              <Square className="w-4 h-4" />
              {clockLoading ? 'Clocking out...' : 'Clock Out'}
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
            <p className="text-slate-400 text-sm font-medium mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Clock in to a job:
            </p>
            {assignedJobs.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No active jobs assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{job.insured_name}</p>
                      <p className="text-slate-400 text-xs truncate">{job.property_address}</p>
                    </div>
                    <button onClick={() => clockIn(job.id)} disabled={clockLoading}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition ml-3 shrink-0">
                      <Play className="w-3.5 h-3.5" /> Clock In
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* This Week Summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" /> This Week
            </h2>
            <span className="text-teal-300 font-bold text-sm">
              {Math.floor(weekTotal/60)}h {weekTotal%60}m total
            </span>
          </div>

          {weekEntries.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No entries this week yet.</div>
          ) : (
            <div className="space-y-2">
              {weekEntries.map(entry => (
                <div key={entry.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{entry.job_name}</p>
                    <p className="text-slate-400 text-xs">
                      {new Date(entry.clock_in_at).toLocaleDateString('en-CA', { weekday:'short', month:'short', day:'numeric' })}
                      {' · '}
                      {new Date(entry.clock_in_at).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit' })}
                      {entry.clock_out_at && ` → ${new Date(entry.clock_out_at).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit' })}`}
                      {entry.clock_in_lat && ' · 📍'}
                    </p>
                  </div>
                  <span className="text-teal-300 font-semibold text-sm shrink-0 ml-3">
                    {entry.duration_minutes ? `${Math.floor(entry.duration_minutes/60)}h ${entry.duration_minutes%60}m` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
