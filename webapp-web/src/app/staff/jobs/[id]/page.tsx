'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StaffSidebar from '@/components/StaffSidebar';
import {
  ArrowLeft, MapPin, Clock, Camera, Map,
  Droplets, FileText, CheckCircle, Navigation,
  AlertTriangle, Play, Square, Upload, ChevronRight
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
  status: string;
  loss_date: string;
  insurer_name: string;
  claim_number: string;
  carrier_slug: string | null;
  current_step: number;
}

interface ClockEntry {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
}

const TABS = [
  { id: 'overview',  label: 'Overview',    icon: FileText  },
  { id: 'photos',    label: 'Photos',      icon: Camera    },
  { id: 'floorplan', label: 'Floor Plan',  icon: Map       },
  { id: 'moisture',  label: 'Moisture',    icon: Droplets  },
  { id: 'clock',     label: 'Time Clock',  icon: Clock     },
];

export default function StaffJobDetail() {
  const router = useRouter();
  const params = useParams();
  const jobId  = params.id as string;

  const [job, setJob]           = useState<Job | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [clockEntry, setClockEntry] = useState<ClockEntry | null>(null);
  const [clockHistory, setClockHistory] = useState<ClockEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [assignmentStatus, setAssignmentStatus] = useState('dispatched');
  const [note, setNote]         = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: member } = await supabase
        .from('team_members')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();
      if (!member) { router.push('/staff/dashboard'); return; }
      setMemberId(member.id);

      // Load job
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, status, loss_date, insurer_name, claim_number, carrier_slug, current_step')
        .eq('id', jobId)
        .single();
      if (jobData) setJob(jobData);

      // Load assignment
      const { data: assignment } = await supabase
        .from('job_assignments')
        .select('status')
        .eq('job_id', jobId)
        .eq('member_id', member.id)
        .single();
      if (assignment) setAssignmentStatus(assignment.status);

      // Load active clock entry
      const { data: activeClock } = await supabase
        .from('time_clock_entries')
        .select('*')
        .eq('job_id', jobId)
        .eq('member_id', member.id)
        .is('clock_out_at', null)
        .single();
      if (activeClock) setClockEntry(activeClock);

      // Load clock history
      const { data: history } = await supabase
        .from('time_clock_entries')
        .select('*')
        .eq('job_id', jobId)
        .eq('member_id', member.id)
        .not('clock_out_at', 'is', null)
        .order('clock_in_at', { ascending: false });
      if (history) setClockHistory(history);

      setLoading(false);
    };
    init();
  }, [router, jobId]);

  const handleClockIn = async () => {
    if (!memberId) return;
    setClockLoading(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const { data } = await supabase.from('time_clock_entries').insert({
      job_id: jobId, member_id: memberId,
      clock_in_lat: lat, clock_in_lng: lng,
    }).select().single();
    if (data) setClockEntry(data);

    // Update assignment status to in_progress
    await supabase.from('job_assignments')
      .update({ status: 'in_progress', accepted_at: new Date().toISOString() })
      .eq('job_id', jobId).eq('member_id', memberId);
    setAssignmentStatus('in_progress');
    setClockLoading(false);
  };

  const handleClockOut = async () => {
    if (!clockEntry || !memberId) return;
    setClockLoading(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    await supabase.from('time_clock_entries')
      .update({ clock_out_at: new Date().toISOString(), clock_out_lat: lat, clock_out_lng: lng })
      .eq('id', clockEntry.id);
    setClockEntry(null);

    // Refresh history
    const { data: history } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('job_id', jobId).eq('member_id', memberId)
      .not('clock_out_at', 'is', null)
      .order('clock_in_at', { ascending: false });
    if (history) setClockHistory(history);
    setClockLoading(false);
  };

  const totalMinutes = clockHistory.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  if (loading) return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading job...</div>
      </div>
    </div>
  );

  if (!job) return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
          <p className="text-white font-semibold">Job not found</p>
          <Link href="/staff/dashboard" className="text-teal-400 text-sm mt-2 block">← Back to My Jobs</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4">
          <Link href="/staff/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-3 transition">
            <ArrowLeft className="w-4 h-4" /> Back to My Jobs
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-white font-bold text-xl">{job.insured_name}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 text-sm">{job.property_address}</span>
              </div>
              {job.claim_number && (
                <p className="text-slate-500 text-xs mt-0.5">Claim: {job.claim_number} · {job.insurer_name}</p>
              )}
            </div>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(job.property_address)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" /> Navigate
            </a>
          </div>

          {/* Clock In/Out Banner */}
          <div className={`mt-4 rounded-xl p-3 flex items-center justify-between ${
            clockEntry ? 'bg-green-900/30 border border-green-700/40' : 'bg-slate-800 border border-slate-700'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${clockEntry ? 'text-green-400' : 'text-slate-400'}`} />
              <span className={`text-sm font-medium ${clockEntry ? 'text-green-300' : 'text-slate-400'}`}>
                {clockEntry
                  ? `Clocked in at ${new Date(clockEntry.clock_in_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Not clocked in'}
              </span>
            </div>
            <button
              onClick={clockEntry ? handleClockOut : handleClockIn}
              disabled={clockLoading}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition ${
                clockEntry
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } disabled:opacity-50`}
            >
              {clockEntry ? <><Square className="w-3.5 h-3.5" /> Clock Out</> : <><Play className="w-3.5 h-3.5" /> Clock In</>}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-900 border-b border-slate-700 px-6">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Job Status',   value: job.status?.toUpperCase() },
                  { label: 'Loss Date',    value: job.loss_date ? new Date(job.loss_date).toLocaleDateString('en-CA') : '—' },
                  { label: 'Insurer',      value: job.insurer_name || '—' },
                  { label: 'Claim #',      value: job.claim_number || '—' },
                  { label: 'My Status',    value: assignmentStatus.replace('_',' ').toUpperCase() },
                  { label: 'Total Hours',  value: `${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m` },
                ].map(item => (
                  <div key={item.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-xs mb-1">{item.label}</p>
                    <p className="text-white font-semibold text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Quick links to other sections */}
              <div className="space-y-2 mt-4">
                {[
                  { tab: 'photos',    icon: Camera,   label: 'Take & Upload Photos',  sub: 'Document site conditions' },
                  { tab: 'floorplan', icon: Map,      label: 'Create Floor Plan',      sub: 'Sketch room layout' },
                  { tab: 'moisture',  icon: Droplets, label: 'Record Moisture Readings', sub: 'Log Tramex readings per room' },
                  { tab: 'clock',     icon: Clock,    label: 'View Time Log',          sub: 'Your hours on this job' },
                ].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    className="w-full flex items-center justify-between bg-slate-800/60 border border-slate-700 hover:border-teal-600/50 rounded-xl p-4 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-700 group-hover:bg-teal-900/40 flex items-center justify-center transition">
                        <item.icon className="w-4 h-4 text-slate-400 group-hover:text-teal-400 transition" />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-medium text-sm">{item.label}</p>
                        <p className="text-slate-500 text-xs">{item.sub}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PHOTOS TAB */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 text-center">
                <Camera className="w-10 h-10 text-teal-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Job Photos</p>
                <p className="text-slate-400 text-sm mb-4">Tap below to open the full photo manager for this job</p>
                <Link
                  href={`/photos?job=${jobId}`}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
                >
                  <Upload className="w-4 h-4" /> Open Photo Manager
                </Link>
              </div>
            </div>
          )}

          {/* FLOOR PLAN TAB */}
          {activeTab === 'floorplan' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 text-center">
                <Map className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Floor Plans</p>
                <p className="text-slate-400 text-sm mb-4">Create and edit floor plans for this job</p>
                <Link
                  href={`/floorplans?job=${jobId}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
                >
                  <Map className="w-4 h-4" /> Open Floor Plan Editor
                </Link>
              </div>
            </div>
          )}

          {/* MOISTURE TAB */}
          {activeTab === 'moisture' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 text-center">
                <Droplets className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Moisture Mapping</p>
                <p className="text-slate-400 text-sm mb-4">Record Tramex ME5 readings and create moisture maps</p>
                <Link
                  href={`/moisture?job=${jobId}`}
                  className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
                >
                  <Droplets className="w-4 h-4" /> Open Moisture Map
                </Link>
              </div>
            </div>
          )}

          {/* CLOCK TAB */}
          {activeTab === 'clock' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-1">Total Hours</p>
                  <p className="text-white font-bold text-2xl">
                    {Math.floor(totalMinutes/60)}h {totalMinutes%60}m
                  </p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-1">Sessions</p>
                  <p className="text-white font-bold text-2xl">{clockHistory.length + (clockEntry ? 1 : 0)}</p>
                </div>
              </div>

              {/* Active session */}
              {clockEntry && (
                <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-green-300 font-semibold text-sm">Active Session</p>
                  </div>
                  <p className="text-green-200 text-xs">
                    Started: {new Date(clockEntry.clock_in_at).toLocaleString('en-CA')}
                  </p>
                  {clockEntry.clock_in_lat && (
                    <p className="text-green-400/60 text-xs mt-0.5">
                      📍 GPS: {clockEntry.clock_in_lat.toFixed(4)}, {clockEntry.clock_in_lng?.toFixed(4)}
                    </p>
                  )}
                </div>
              )}

              {/* History */}
              {clockHistory.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">History</p>
                  {clockHistory.map(entry => (
                    <div key={entry.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {new Date(entry.clock_in_at).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {new Date(entry.clock_in_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {entry.clock_out_at ? new Date(entry.clock_out_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-teal-300 font-semibold text-sm">
                            {entry.duration_minutes ? `${Math.floor(entry.duration_minutes/60)}h ${entry.duration_minutes%60}m` : '—'}
                          </span>
                          {entry.clock_in_lat && (
                            <p className="text-slate-500 text-xs">📍 GPS verified</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !clockEntry && (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No clock entries yet for this job.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
