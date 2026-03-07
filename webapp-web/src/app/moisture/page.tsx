'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Droplets, Plus, Briefcase, Loader2, AlertCircle,
  CheckCircle, XCircle, Thermometer, Wind, X
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
}

interface Room {
  id: string;
  job_id: string;
  room_name: string;
  type: string | null;
  floor_number: number | null;
}

interface MoistureReading {
  id: string;
  job_id: string;
  room_id: string | null;
  material_type: string;
  mc_percent: number | null;
  rh_percent: number | null;
  temp_f: number | null;
  visit_day: number;
  status: string;
  created_at: string;
  notes?: string | null;
}

/* ── IICRC S500 dry standards ── */
const DRY_STANDARDS: Record<string, { wet: number; dry: number; label: string; color: string }> = {
  wood:      { wet: 19, dry: 15, label: 'Wood',      color: 'bg-amber-500'  },
  drywall:   { wet: 16, dry: 12, label: 'Drywall',   color: 'bg-blue-500'   },
  concrete:  { wet: 18, dry: 14, label: 'Concrete',  color: 'bg-gray-500'   },
  subfloor:  { wet: 19, dry: 15, label: 'Subfloor',  color: 'bg-orange-500' },
  ceiling:   { wet: 17, dry: 13, label: 'Ceiling',   color: 'bg-indigo-500' },
  carpet:    { wet: 17, dry: 12, label: 'Carpet',    color: 'bg-pink-500'   },
  other:     { wet: 18, dry: 14, label: 'Other',     color: 'bg-slate-400'  },
};

function getMoistureStatus(mc: number | null, material: string): 'dry' | 'wet' | 'unknown' {
  if (mc === null) return 'unknown';
  const std = DRY_STANDARDS[material] || DRY_STANDARDS.other;
  return mc <= std.dry ? 'dry' : 'wet';
}

function getMoistureColor(mc: number | null, material: string): string {
  const status = getMoistureStatus(mc, material);
  if (status === 'dry')     return 'bg-green-100 border-green-400 text-green-800';
  if (status === 'wet')     return 'bg-red-100 border-red-400 text-red-800';
  return 'bg-gray-100 border-gray-300 text-gray-500';
}

function ReadingBar({ mc, material }: { mc: number | null; material: string }) {
  if (mc === null) return <div className="h-2 bg-gray-200 rounded-full w-full" />;
  const std = DRY_STANDARDS[material] || DRY_STANDARDS.other;
  const max = std.wet * 1.5;
  const pct = Math.min((mc / max) * 100, 100);
  const color = mc <= std.dry ? 'bg-green-500' : mc <= std.wet ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="relative h-2 bg-gray-200 rounded-full w-full">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      {/* Dry threshold marker */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-green-600 opacity-60"
        style={{ left: `${(std.dry / max) * 100}%` }}
        title={`Dry threshold: ${std.dry}%`}
      />
    </div>
  );
}

const MATERIAL_OPTIONS = ['wood', 'drywall', 'concrete', 'subfloor', 'ceiling', 'carpet', 'other'];

export default function MoisturePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<MoistureReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterDay, setFilterDay] = useState<number | 'all'>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');

  /* ── new reading form state ── */
  const [form, setForm] = useState({
    room_id: '',
    material_type: 'drywall',
    mc_percent: '',
    rh_percent: '',
    temp_f: '',
    visit_day: '1',
    notes: '',
  });

  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobData || []);
      if (jobData && jobData.length > 0) setSelectedJobId(jobData[0].id);
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedJobId) { setReadings([]); setRooms([]); return; }
    const load = async () => {
      const [roomRes, readRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('job_id', selectedJobId),
        supabase.from('moisture_readings').select('*').eq('job_id', selectedJobId).order('visit_day').order('created_at'),
      ]);
      setRooms(roomRes.data || []);
      setReadings(readRes.data || []);
    };
    load();
  }, [selectedJobId]);

  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) return;
    setSaving(true); setError('');
    try {
      const { error: insErr } = await supabase.from('moisture_readings').insert({
        job_id: selectedJobId,
        room_id: form.room_id || null,
        material_type: form.material_type,
        mc_percent: form.mc_percent ? parseFloat(form.mc_percent) : null,
        rh_percent: form.rh_percent ? parseFloat(form.rh_percent) : null,
        temp_f:     form.temp_f     ? parseFloat(form.temp_f)     : null,
        visit_day:  parseInt(form.visit_day) || 1,
        notes:      form.notes || null,
        status: 'active',
      });

      if (insErr) { setError(insErr.message); return; }

      const { data } = await supabase
        .from('moisture_readings')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('visit_day').order('created_at');
      setReadings(data || []);
      setShowForm(false);
      setForm({ room_id: '', material_type: 'drywall', mc_percent: '', rh_percent: '', temp_f: '', visit_day: String((data?.length || 0) > 0 ? Math.max(...(data||[]).map(r=>r.visit_day)) : 1), notes: '' });
    } finally { setSaving(false); }
  };

  const deleteReading = async (id: string) => {
    await supabase.from('moisture_readings').delete().eq('id', id);
    setReadings(prev => prev.filter(r => r.id !== id));
  };

  /* ── derived stats ── */
  const allDays = Array.from(new Set(readings.map(r => r.visit_day))).sort((a,b)=>a-b);
  const filteredReadings = readings.filter(r =>
    (filterDay === 'all' || r.visit_day === filterDay) &&
    (filterRoom === 'all' || r.room_id === filterRoom)
  );
  const totalReadings  = readings.length;
  const dryCount       = readings.filter(r => getMoistureStatus(r.mc_percent, r.material_type) === 'dry').length;
  const wetCount       = readings.filter(r => getMoistureStatus(r.mc_percent, r.material_type) === 'wet').length;
  const dryPct         = totalReadings > 0 ? Math.round((dryCount / totalReadings) * 100) : 0;

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Droplets className="w-6 h-6 text-blue-600" /> Moisture Map
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">IICRC S500 drying progress tracking</p>
        </div>
        {selectedJobId && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
            <Plus className="w-4 h-4" /> Add Reading
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No jobs found. Create a job first.</p>
          <Link href="/jobs/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition">
            + New Job
          </Link>
        </div>
      ) : (
        <>
          {/* Job selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Job</label>
            <div className="flex flex-wrap gap-2">
              {jobs.map(job => (
                <button key={job.id} onClick={() => setSelectedJobId(job.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                    selectedJobId === job.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}>
                  {job.insured_name}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Readings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalReadings}</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <p className="text-xs text-green-600 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Dry
              </p>
              <p className="text-2xl font-bold text-green-700 mt-1">{dryCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-500 uppercase tracking-wide flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Wet
              </p>
              <p className="text-2xl font-bold text-red-600 mt-1">{wetCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600 uppercase tracking-wide">Drying Progress</p>
              <div className="mt-1">
                <p className="text-2xl font-bold text-blue-700">{dryPct}%</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${dryPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* IICRC Standards reference */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">IICRC S500 Dry Standards</h3>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {Object.entries(DRY_STANDARDS).map(([key, std]) => (
                <div key={key} className="text-center">
                  <div className={`w-full h-2 rounded-full mb-1 ${std.color}`} />
                  <p className="text-[10px] font-semibold text-gray-700">{std.label}</p>
                  <p className="text-[10px] text-gray-500">≤{std.dry}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          {readings.length > 0 && (
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <label className="text-xs font-medium text-gray-500 mr-1">Day:</label>
                <select value={filterDay}
                  onChange={e => setFilterDay(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="all">All Days</option>
                  {allDays.map(d => <option key={d} value={d}>Day {d}</option>)}
                </select>
              </div>
              {rooms.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mr-1">Room:</label>
                  <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">All Rooms</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.room_name}</option>)}
                  </select>
                </div>
              )}
              <span className="text-xs text-gray-400">{filteredReadings.length} reading{filteredReadings.length !== 1 ? 's' : ''} shown</span>
            </div>
          )}

          {/* Readings grid */}
          {filteredReadings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <Droplets className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No moisture readings for <strong>{selectedJob?.insured_name}</strong> yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click &quot;Add Reading&quot; to log the first measurement.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredReadings.map(reading => {
                const status    = getMoistureStatus(reading.mc_percent, reading.material_type);
                const cardColor = getMoistureColor(reading.mc_percent, reading.material_type);
                const std       = DRY_STANDARDS[reading.material_type] || DRY_STANDARDS.other;
                const room      = rooms.find(r => r.id === reading.room_id);

                return (
                  <div key={reading.id}
                    className={`rounded-xl border-2 p-4 ${cardColor} relative group`}>
                    {/* Delete */}
                    <button onClick={() => deleteReading(reading.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-red-500 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-start justify-between mb-2 pr-5">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide">
                          {std.label}
                        </span>
                        {room && (
                          <span className="ml-2 text-xs bg-white/60 px-1.5 py-0.5 rounded-full">
                            {room.room_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {status === 'dry'
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : status === 'wet'
                          ? <XCircle className="w-4 h-4 text-red-500" />
                          : null
                        }
                        <span className="text-xs font-semibold capitalize">{status}</span>
                      </div>
                    </div>

                    {/* MC% reading — big number */}
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-3xl font-black">
                        {reading.mc_percent !== null ? reading.mc_percent : '—'}
                      </span>
                      <span className="text-sm font-medium">% MC</span>
                      <span className="text-xs opacity-60 ml-auto">Goal ≤{std.dry}%</span>
                    </div>

                    <ReadingBar mc={reading.mc_percent} material={reading.material_type} />

                    <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                      {reading.rh_percent !== null && (
                        <span className="flex items-center gap-0.5">
                          <Wind className="w-3 h-3" /> {reading.rh_percent}% RH
                        </span>
                      )}
                      {reading.temp_f !== null && (
                        <span className="flex items-center gap-0.5">
                          <Thermometer className="w-3 h-3" /> {reading.temp_f}°F
                        </span>
                      )}
                      <span className="ml-auto">Day {reading.visit_day}</span>
                    </div>

                    {reading.notes && (
                      <p className="text-xs opacity-60 mt-1.5 truncate">{reading.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Drying trend chart (simple day-by-day avg MC) */}
          {allDays.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Drying Trend — Avg MC% by Day</h3>
              <div className="flex items-end gap-2 h-24">
                {allDays.map(day => {
                  const dayReadings = readings.filter(r => r.visit_day === day && r.mc_percent !== null);
                  const avg = dayReadings.length > 0
                    ? dayReadings.reduce((s, r) => s + (r.mc_percent || 0), 0) / dayReadings.length
                    : 0;
                  const maxAvg = 25;
                  const pct = Math.min((avg / maxAvg) * 100, 100);
                  const barColor = avg <= 14 ? 'bg-green-500' : avg <= 19 ? 'bg-yellow-500' : 'bg-red-500';
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-500">{avg.toFixed(1)}%</span>
                      <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '80px', display: 'flex', alignItems: 'flex-end' }}>
                        <div className={`w-full rounded-t-sm transition-all ${barColor}`} style={{ height: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600">D{day}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Green = dry (&lt;14%), Yellow = drying (14–19%), Red = wet (&gt;19%)</p>
            </div>
          )}
        </>
      )}

      {/* Add Reading modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Add Moisture Reading</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddReading} className="p-5 space-y-4">
              {rooms.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room (optional)</label>
                  <select value={form.room_id} onChange={e => upd('room_id', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">— No specific room —</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.room_name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                  <select value={form.material_type} onChange={e => upd('material_type', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {MATERIAL_OPTIONS.map(m => (
                      <option key={m} value={m}>{DRY_STANDARDS[m]?.label || m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visit Day *</label>
                  <input type="number" min="1" max="60" value={form.visit_day}
                    onChange={e => upd('visit_day', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MC% *</label>
                  <input type="number" step="0.1" min="0" max="100" placeholder="14.2"
                    value={form.mc_percent} onChange={e => upd('mc_percent', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RH%</label>
                  <input type="number" step="0.1" min="0" max="100" placeholder="45"
                    value={form.rh_percent} onChange={e => upd('rh_percent', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temp °F</label>
                  <input type="number" step="0.1" placeholder="72"
                    value={form.temp_f} onChange={e => upd('temp_f', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* Live preview of threshold */}
              {form.mc_percent && (
                <div className={`rounded-lg p-3 border ${getMoistureColor(parseFloat(form.mc_percent), form.material_type)}`}>
                  <p className="text-sm font-semibold">
                    {getMoistureStatus(parseFloat(form.mc_percent), form.material_type) === 'dry'
                      ? '✅ DRY — within IICRC goal'
                      : '💧 WET — above dry threshold'}
                  </p>
                  <p className="text-xs mt-0.5">
                    {DRY_STANDARDS[form.material_type]?.label} goal: ≤{DRY_STANDARDS[form.material_type]?.dry}% MC
                  </p>
                  <ReadingBar mc={parseFloat(form.mc_percent)} material={form.material_type} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" placeholder="Location, observation…"
                  value={form.notes} onChange={e => upd('notes', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
