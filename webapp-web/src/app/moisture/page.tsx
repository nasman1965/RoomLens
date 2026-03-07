'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Droplets, Plus, ChevronDown, Loader2, AlertCircle,
  CheckCircle, X, TrendingDown, TrendingUp, Minus,
  Thermometer, Wind
} from 'lucide-react';

interface Job { id: string; insured_name: string; property_address: string; }
interface MoistureReading {
  id: string;
  job_id: string;
  room_id: string | null;
  material_type: string;
  mc_percent: number;
  rh_percent: number | null;
  temp_f: number | null;
  status: string;
  visit_day: number;
  created_at: string;
  x_coord: number | null;
  y_coord: number | null;
}
interface DryStandard {
  material_type: string;
  wet_threshold: number;
  dry_threshold: number;
}

const MATERIAL_TYPES = [
  'wood', 'drywall', 'concrete', 'subfloor', 'ceiling',
  'insulation', 'carpet', 'tile', 'brick', 'other'
];
const MATERIAL_LABELS: Record<string, string> = {
  wood: '🪵 Wood', drywall: '🧱 Drywall', concrete: '🏗️ Concrete',
  subfloor: '🏠 Subfloor', ceiling: '⬆️ Ceiling', insulation: '🧶 Insulation',
  carpet: '🪑 Carpet', tile: '🔲 Tile', brick: '🧱 Brick', other: '📋 Other',
};

// IICRC S500 dry standards
const DEFAULT_STANDARDS: Record<string, { wet: number; dry: number }> = {
  wood: { wet: 28, dry: 19 },
  drywall: { wet: 17, dry: 12 },
  concrete: { wet: 5.5, dry: 4.0 },
  subfloor: { wet: 28, dry: 19 },
  ceiling: { wet: 17, dry: 12 },
  insulation: { wet: 25, dry: 15 },
  carpet: { wet: 20, dry: 10 },
  tile: { wet: 4, dry: 2 },
  brick: { wet: 5, dry: 3 },
  other: { wet: 20, dry: 15 },
};

function getStatusColor(mc: number, material: string) {
  const std = DEFAULT_STANDARDS[material] || DEFAULT_STANDARDS.other;
  if (mc <= std.dry) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-400', label: '✅ DRY', bar: 'bg-green-500' };
  if (mc >= std.wet) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', label: '🔴 WET', bar: 'bg-red-500' };
  return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400', label: '⚠️ DRYING', bar: 'bg-yellow-500' };
}

function getMCPercent(mc: number, material: string) {
  const std = DEFAULT_STANDARDS[material] || DEFAULT_STANDARDS.other;
  return Math.min(100, Math.round((mc / (std.wet * 1.5)) * 100));
}

export default function MoisturePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [readings, setReadings] = useState<MoistureReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [visitFilter, setVisitFilter] = useState(0); // 0 = all
  const [userId, setUserId] = useState('');

  const [form, setForm] = useState({
    material_type: 'drywall',
    mc_percent: '',
    rh_percent: '',
    temp_f: '',
    visit_day: '1',
    location_note: '',
  });

  // Get unique visit days
  const visitDays = Array.from(new Set(readings.map(r => r.visit_day))).sort((a, b) => a - b);

  const filteredReadings = visitFilter === 0
    ? readings
    : readings.filter(r => r.visit_day === visitFilter);

  // Stats
  const dryCount = filteredReadings.filter(r => {
    const std = DEFAULT_STANDARDS[r.material_type] || DEFAULT_STANDARDS.other;
    return r.mc_percent <= std.dry;
  }).length;
  const wetCount = filteredReadings.filter(r => {
    const std = DEFAULT_STANDARDS[r.material_type] || DEFAULT_STANDARDS.other;
    return r.mc_percent >= std.wet;
  }).length;
  const dryingCount = filteredReadings.length - dryCount - wetCount;
  const avgMC = filteredReadings.length > 0
    ? (filteredReadings.reduce((sum, r) => sum + r.mc_percent, 0) / filteredReadings.length).toFixed(1)
    : '—';

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobsData || []);
      if (jobsData && jobsData.length > 0) setSelectedJobId(jobsData[0].id);
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedJobId) { setReadings([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from('moisture_readings')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('created_at', { ascending: false });
      setReadings(data || []);
    };
    load();
  }, [selectedJobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.mc_percent || !selectedJobId) { setError('MC% is required.'); return; }
    setSaving(true); setError('');

    const { data: record, error: insertErr } = await supabase
      .from('moisture_readings')
      .insert({
        job_id: selectedJobId,
        material_type: form.material_type,
        mc_percent: parseFloat(form.mc_percent),
        rh_percent: form.rh_percent ? parseFloat(form.rh_percent) : null,
        temp_f: form.temp_f ? parseFloat(form.temp_f) : null,
        visit_day: parseInt(form.visit_day),
        technician_id: userId,
        status: 'active',
      })
      .select()
      .single();

    if (insertErr) {
      setError(insertErr.message);
    } else if (record) {
      setReadings(prev => [record, ...prev]);
      setSuccess('Reading saved!');
      setTimeout(() => setSuccess(''), 3000);
      setForm(prev => ({ ...prev, mc_percent: '', rh_percent: '', temp_f: '', location_note: '' }));
      setShowForm(false);
    }
    setSaving(false);
  };

  const deleteReading = async (id: string) => {
    if (!confirm('Delete this reading?')) return;
    await supabase.from('moisture_readings').delete().eq('id', id);
    setReadings(prev => prev.filter(r => r.id !== id));
  };

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
          <p className="text-sm text-gray-500 mt-0.5">
            IICRC S500 standards · {filteredReadings.length} reading{filteredReadings.length !== 1 ? 's' : ''} · {selectedJob?.insured_name || 'No job selected'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={!selectedJobId}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> Add Reading
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* Job Selector + Visit Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <select
            value={selectedJobId}
            onChange={e => setSelectedJobId(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {jobs.length === 0 && <option value="">No jobs yet</option>}
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.insured_name} — {j.property_address}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {visitDays.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Visit Day:</span>
            <button
              onClick={() => setVisitFilter(0)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${visitFilter === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >All</button>
            {visitDays.map(day => (
              <button
                key={day}
                onClick={() => setVisitFilter(day)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${visitFilter === day ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >Day {day}</button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {filteredReadings.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Readings', value: filteredReadings.length, icon: Droplets, color: 'blue' },
            { label: '✅ Dry', value: dryCount, icon: TrendingDown, color: 'green' },
            { label: '⚠️ Drying', value: dryingCount, icon: Minus, color: 'yellow' },
            { label: '🔴 Still Wet', value: wetCount, icon: TrendingUp, color: 'red' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`bg-white rounded-xl border border-gray-200 p-4`}>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
              {label === 'Total Readings' && (
                <p className="text-xs text-gray-400 mt-1">Avg MC: <strong>{avgMC}%</strong></p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Reading Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">New Moisture Reading</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Material Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Material Type</label>
              <select
                value={form.material_type}
                onChange={e => setForm(p => ({ ...p, material_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {MATERIAL_TYPES.map(m => (
                  <option key={m} value={m}>{MATERIAL_LABELS[m] || m}</option>
                ))}
              </select>
            </div>
            {/* MC% */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                MC% <span className="text-red-500">*</span>
                <span className="text-gray-400 ml-1">(dry goal: ≤{DEFAULT_STANDARDS[form.material_type]?.dry}%)</span>
              </label>
              <input
                type="number" step="0.1" min="0" max="100"
                value={form.mc_percent}
                onChange={e => setForm(p => ({ ...p, mc_percent: e.target.value }))}
                placeholder="e.g. 18.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {/* Visit Day */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Visit Day</label>
              <input
                type="number" min="1" max="30"
                value={form.visit_day}
                onChange={e => setForm(p => ({ ...p, visit_day: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {/* RH% */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <Wind className="w-3 h-3 inline mr-1" />RH% (optional)
              </label>
              <input
                type="number" step="0.1" min="0" max="100"
                value={form.rh_percent}
                onChange={e => setForm(p => ({ ...p, rh_percent: e.target.value }))}
                placeholder="e.g. 65"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {/* Temp */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <Thermometer className="w-3 h-3 inline mr-1" />Temp °F (optional)
              </label>
              <input
                type="number" step="0.1"
                value={form.temp_f}
                onChange={e => setForm(p => ({ ...p, temp_f: e.target.value }))}
                placeholder="e.g. 72"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2 rounded-lg transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Save Reading
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Readings Grid */}
      {filteredReadings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {jobs.length === 0 ? 'Create a job first to log moisture readings.' : 'No readings yet — click "Add Reading" to start.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group by material type for summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Readings by Material — IICRC S500</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {MATERIAL_TYPES.filter(mat => filteredReadings.some(r => r.material_type === mat)).map(mat => {
                const matReadings = filteredReadings.filter(r => r.material_type === mat);
                const avgMCmat = matReadings.reduce((s, r) => s + r.mc_percent, 0) / matReadings.length;
                const std = DEFAULT_STANDARDS[mat];
                const statusCol = getStatusColor(avgMCmat, mat);
                const barPct = getMCPercent(avgMCmat, mat);

                return (
                  <div key={mat} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-800">{MATERIAL_LABELS[mat]}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCol.bg} ${statusCol.text}`}>
                          {statusCol.label}
                        </span>
                        <span className="text-xs text-gray-400">{matReadings.length} reading{matReadings.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">{avgMCmat.toFixed(1)}%</span>
                        <span className="text-xs text-gray-400 ml-1">avg MC</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${statusCol.bar}`}
                          style={{ width: `${barPct}%` }}
                        />
                        {/* Dry goal marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-green-600 opacity-70"
                          style={{ left: `${getMCPercent(std.dry, mat)}%` }}
                          title={`Dry goal: ${std.dry}%`}
                        />
                      </div>
                      <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">goal ≤{std.dry}%</span>
                    </div>
                    {/* Individual readings */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {matReadings.map(r => {
                        const rc = getStatusColor(r.mc_percent, r.material_type);
                        return (
                          <div
                            key={r.id}
                            className={`group relative flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${rc.bg} ${rc.border}`}
                          >
                            <span className={`font-bold ${rc.text}`}>{r.mc_percent}%</span>
                            <span className="text-gray-500">Day {r.visit_day}</span>
                            {r.rh_percent && <span className="text-gray-400">· {r.rh_percent}%RH</span>}
                            {r.temp_f && <span className="text-gray-400">· {r.temp_f}°F</span>}
                            <button
                              onClick={() => deleteReading(r.id)}
                              className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IICRC Reference Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">IICRC S500 Dry Standards Reference</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Material</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-red-600">Wet ≥ %</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-green-600">Dry Goal ≤ %</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">Readings Today</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.entries(DEFAULT_STANDARDS).map(([mat, std]) => {
                    const matReadings = filteredReadings.filter(r => r.material_type === mat);
                    const latestMC = matReadings.length > 0
                      ? matReadings.sort((a, b) => b.visit_day - a.visit_day)[0].mc_percent
                      : null;
                    const statusCol = latestMC !== null ? getStatusColor(latestMC, mat) : null;

                    return (
                      <tr key={mat} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{MATERIAL_LABELS[mat] || mat}</td>
                        <td className="px-4 py-2.5 text-center text-red-600 font-mono">≥{std.wet}%</td>
                        <td className="px-4 py-2.5 text-center text-green-600 font-mono">≤{std.dry}%</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">
                          {matReadings.length > 0
                            ? <span className="font-bold text-gray-800">{latestMC}%</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {statusCol
                            ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCol.bg} ${statusCol.text}`}>{statusCol.label}</span>
                            : <span className="text-gray-300 text-xs">No data</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
