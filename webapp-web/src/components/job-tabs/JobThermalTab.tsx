'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Thermometer, Upload, Loader2, AlertTriangle, CheckCircle2,
  X, ZoomIn, Trash2, RefreshCw, Camera, Info,
  ChevronDown, ChevronUp, Eye, Sparkles, ImageOff,
  ArrowUpRight, MapPin, Wind,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ThermalReading {
  id: string;
  job_id: string;
  room_name: string;
  wall_direction: string | null;
  location_notes: string | null;
  surface_temp_c: number | null;
  ambient_temp_c: number | null;
  temp_delta_c: number | null;
  anomaly_type: string | null;
  moisture_probability: number | null;
  mould_risk: 'low' | 'medium' | 'high' | 'critical' | null;
  recommendation: string | null;
  affected_area_sf: number | null;
  height_from_floor_cm: number | null;
  anomaly_height_cm: number | null;
  thermal_photo_url: string | null;
  visible_photo_url: string | null;
  device_model: string | null;
  scan_timestamp: string;
  created_at: string;
  aiLoading?: boolean;
}

interface AIThermalResult {
  anomaly_type: string;
  moisture_probability: number;
  mould_risk: 'low' | 'medium' | 'high' | 'critical';
  surface_temp_c: number;
  temp_delta_c: number;
  affected_area_sf: number;
  recommendation: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOMS = [
  'Basement', 'Living Room', 'Kitchen', 'Bathroom', 'Master Bedroom',
  'Bedroom 2', 'Bedroom 3', 'Hallway', 'Laundry', 'Crawl Space',
  'Attic', 'Garage', 'Dining Room', 'Exterior', 'Other',
];

const WALL_DIRECTIONS = [
  { value: 'N',       label: 'North Wall'   },
  { value: 'S',       label: 'South Wall'   },
  { value: 'E',       label: 'East Wall'    },
  { value: 'W',       label: 'West Wall'    },
  { value: 'ceiling', label: 'Ceiling'      },
  { value: 'floor',   label: 'Floor'        },
];

const ANOMALY_TYPES = [
  { value: 'wet_insulation',    label: 'Wet Insulation',       emoji: '🧊' },
  { value: 'mould_heat',        label: 'Mould Heat',           emoji: '🟢' },
  { value: 'pipe_leak',         label: 'Pipe Leak',            emoji: '💧' },
  { value: 'structural_cold',   label: 'Structural Cold Spot', emoji: '🔵' },
  { value: 'hvac_issue',        label: 'HVAC Issue',           emoji: '💨' },
  { value: 'air_infiltration',  label: 'Air Infiltration',     emoji: '🌬️' },
  { value: 'unknown',           label: 'Unknown Anomaly',      emoji: '❓' },
];

const RISK_CONFIG: Record<string, { bg: string; text: string; border: string; badge: string; icon: string }> = {
  low:      { bg: 'bg-green-900/30',   text: 'text-green-400',   border: 'border-green-700',   badge: 'bg-green-800/60 text-green-300',   icon: '🟢' },
  medium:   { bg: 'bg-yellow-900/30',  text: 'text-yellow-400',  border: 'border-yellow-700',  badge: 'bg-yellow-800/60 text-yellow-300',  icon: '🟡' },
  high:     { bg: 'bg-orange-900/30',  text: 'text-orange-400',  border: 'border-orange-700',  badge: 'bg-orange-800/60 text-orange-300',  icon: '🟠' },
  critical: { bg: 'bg-red-900/30',     text: 'text-red-400',     border: 'border-red-700',     badge: 'bg-red-800/60 text-red-300',       icon: '🔴' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function deltaColor(delta: number | null) {
  if (delta === null) return 'text-slate-400';
  if (delta <= -5) return 'text-blue-400';
  if (delta <= -2) return 'text-cyan-400';
  if (delta >= 2)  return 'text-orange-400';
  return 'text-slate-400';
}

function formatDelta(delta: number | null) {
  if (delta === null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}°C`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function JobThermalTab({ jobId, userId }: { jobId: string; userId: string }) {
  const [readings, setReadings] = useState<ThermalReading[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    room_name: '',
    wall_direction: '',
    location_notes: '',
    ambient_temp_c: '',
    device_model: 'FLIR One Pro',
    height_from_floor_cm: '',
    anomaly_height_cm: '',
  });
  const [thermalFile, setThermalFile]   = useState<File | null>(null);
  const [visibleFile, setVisibleFile]   = useState<File | null>(null);
  const [thermalPreview, setThermalPreview] = useState<string | null>(null);
  const [visiblePreview, setVisiblePreview] = useState<string | null>(null);
  const [aiResult, setAiResult]         = useState<AIThermalResult | null>(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiRan, setAiRan]               = useState(false);

  const thermalInputRef = useRef<HTMLInputElement>(null);
  const visibleInputRef = useRef<HTMLInputElement>(null);

  // ── Load readings ──────────────────────────────────────────────────────────
  const loadReadings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('thermal_readings')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (!error && data) setReadings(data as ThermalReading[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  // ── File handlers ─────────────────────────────────────────────────────────
  function handleThermalFile(file: File | null) {
    setThermalFile(file);
    setAiRan(false);
    setAiResult(null);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setThermalPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setThermalPreview(null);
    }
  }

  function handleVisibleFile(file: File | null) {
    setVisibleFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setVisiblePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setVisiblePreview(null);
    }
  }

  // ── Upload a file to Supabase storage ────────────────────────────────────
  async function uploadPhoto(file: File, prefix: 'thermal' | 'visible'): Promise<string | null> {
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/${jobId}/${prefix}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('job-photos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('job-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Run AI interpreter on the thermal photo ───────────────────────────────
  async function runAI() {
    if (!thermalFile) return;
    setAiLoading(true);
    try {
      // Upload the thermal image first to get a public URL
      const url = await uploadPhoto(thermalFile, 'thermal');
      if (!url) throw new Error('Could not upload image for AI analysis');

      const resp = await fetch('/api/ai/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type:              'thermal_scan',
          thermal_photo_url: url,
          ambient_temp_c:    parseFloat(form.ambient_temp_c) || 21,
          room_name:         form.room_name || 'Unknown Room',
        }),
      });
      const json = await resp.json();
      // thermal_scan route returns { result: rawString, parsed: object, type }
      // other routes return { result: string, type }
      let parsed: AIThermalResult | null = null;
      if (json.parsed) {
        parsed = json.parsed as AIThermalResult;
      } else if (json.result) {
        try {
          parsed = JSON.parse(
            (typeof json.result === 'string' ? json.result : JSON.stringify(json.result))
              .replace(/```json|```/g, '').trim()
          ) as AIThermalResult;
        } catch { /* not parseable JSON, ignore */ }
      }
      if (parsed) {
        setAiResult(parsed);
        setAiRan(true);
        // Pre-store the temp URL so we don't re-upload on save
        (window as unknown as Record<string, string>)['__thermalUploadUrl__'] = url;
      }
    } catch (err) {
      setError('AI analysis failed — you can still enter readings manually.');
    } finally {
      setAiLoading(false);
    }
  }

  // ── Save reading ──────────────────────────────────────────────────────────
  async function saveReading() {
    if (!form.room_name) { setError('Please select a room before saving.'); return; }
    setSaving(true);
    setError(null);

    try {
      // Upload thermal photo (reuse URL if AI already uploaded it)
      let thermalUrl: string | null = null;
      if (thermalFile) {
        const cached = (window as unknown as Record<string, string | undefined>)['__thermalUploadUrl__'];
        thermalUrl = cached ?? await uploadPhoto(thermalFile, 'thermal');
        delete (window as unknown as Record<string, string | undefined>)['__thermalUploadUrl__'];
      }

      // Upload visible photo
      let visibleUrl: string | null = null;
      if (visibleFile) visibleUrl = await uploadPhoto(visibleFile, 'visible');

      const ambient = parseFloat(form.ambient_temp_c) || null;
      const surface = aiResult?.surface_temp_c ?? null;
      const delta   = (surface !== null && ambient !== null) ? surface - ambient : aiResult?.temp_delta_c ?? null;

      const row = {
        job_id:              jobId,
        technician_id:       userId,
        room_name:           form.room_name,
        wall_direction:      form.wall_direction || null,
        location_notes:      form.location_notes || null,
        surface_temp_c:      surface,
        ambient_temp_c:      ambient,
        temp_delta_c:        delta,
        anomaly_type:        aiResult?.anomaly_type ?? null,
        moisture_probability: aiResult?.moisture_probability ?? null,
        mould_risk:          aiResult?.mould_risk ?? null,
        recommendation:      aiResult?.recommendation ?? null,
        affected_area_sf:    aiResult?.affected_area_sf ?? null,
        height_from_floor_cm: form.height_from_floor_cm ? parseInt(form.height_from_floor_cm) : null,
        anomaly_height_cm:    form.anomaly_height_cm   ? parseInt(form.anomaly_height_cm)   : null,
        thermal_photo_url:   thermalUrl,
        visible_photo_url:   visibleUrl,
        device_model:        form.device_model || 'FLIR One Pro',
      };

      const { error: insertErr } = await supabase.from('thermal_readings').insert(row);
      if (insertErr) throw new Error(insertErr.message);

      setSuccess('Thermal scan saved successfully!');
      setTimeout(() => setSuccess(null), 4000);
      setShowForm(false);
      resetForm();
      loadReadings();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save thermal reading.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete reading ────────────────────────────────────────────────────────
  async function deleteReading(id: string) {
    if (!confirm('Delete this thermal scan reading?')) return;
    await supabase.from('thermal_readings').delete().eq('id', id);
    setReadings(prev => prev.filter(r => r.id !== id));
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({
      room_name: '', wall_direction: '', location_notes: '',
      ambient_temp_c: '', device_model: 'FLIR One Pro',
      height_from_floor_cm: '', anomaly_height_cm: '',
    });
    setThermalFile(null); setVisibleFile(null);
    setThermalPreview(null); setVisiblePreview(null);
    setAiResult(null); setAiRan(false);
  }

  // ── Stats summary ─────────────────────────────────────────────────────────
  const stats = {
    total:    readings.length,
    critical: readings.filter(r => r.mould_risk === 'critical').length,
    high:     readings.filter(r => r.mould_risk === 'high').length,
    area:     readings.reduce((s, r) => s + (r.affected_area_sf ?? 0), 0),
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-400" />
            Thermal Scans
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            FLIR infrared readings — wet insulation, mould, hidden moisture
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setError(null); }}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-xl text-sm font-semibold transition"
        >
          {showForm ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Scan'}
        </button>
      </div>

      {/* ── Success / Error banners ── */}
      {success && (
        <div className="flex items-center gap-2 bg-green-900/40 border border-green-600 text-green-300 rounded-xl px-4 py-2 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-600 text-red-300 rounded-xl px-4 py-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Stats Bar ── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total Scans',   value: stats.total,    color: 'text-slate-300'  },
            { label: 'Critical',      value: stats.critical, color: 'text-red-400'    },
            { label: 'High Risk',     value: stats.high,     color: 'text-orange-400' },
            { label: 'Affected SF',   value: `${stats.area.toFixed(0)} SF`, color: 'text-blue-300' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Form ── */}
      {showForm && (
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-400" /> New Thermal Scan
          </h3>

          {/* Row 1 – Room + Wall direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Room <span className="text-red-400">*</span></label>
              <select
                value={form.room_name}
                onChange={e => setForm(f => ({ ...f, room_name: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select room…</option>
                {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Wall / Surface</label>
              <select
                value={form.wall_direction}
                onChange={e => setForm(f => ({ ...f, wall_direction: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Optional —</option>
                {WALL_DIRECTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2 – Ambient temp + Device */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Ambient Temp (°C)</label>
              <input
                type="number" step="0.1" placeholder="e.g. 21.5"
                value={form.ambient_temp_c}
                onChange={e => setForm(f => ({ ...f, ambient_temp_c: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">FLIR Device</label>
              <input
                type="text" placeholder="FLIR One Pro"
                value={form.device_model}
                onChange={e => setForm(f => ({ ...f, device_model: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Row 3 – Heights */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Height from Floor (cm)</label>
              <input
                type="number" placeholder="e.g. 90"
                value={form.height_from_floor_cm}
                onChange={e => setForm(f => ({ ...f, height_from_floor_cm: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Anomaly Height (cm)</label>
              <input
                type="number" placeholder="e.g. 45"
                value={form.anomaly_height_cm}
                onChange={e => setForm(f => ({ ...f, anomaly_height_cm: e.target.value }))}
                className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Row 4 – Location notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Location Notes</label>
            <input
              type="text" placeholder="e.g. Behind drywall near exterior door"
              value={form.location_notes}
              onChange={e => setForm(f => ({ ...f, location_notes: e.target.value }))}
              className="w-full bg-slate-700/60 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Row 5 – Photo uploads */}
          <div className="grid grid-cols-2 gap-3">
            {/* Thermal photo */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Thermal Photo (FLIR JPEG) <span className="text-orange-400">★ AI reads this</span></label>
              <input ref={thermalInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleThermalFile(e.target.files?.[0] ?? null)} />
              {thermalPreview ? (
                <div className="relative group">
                  <img src={thermalPreview} alt="Thermal" className="w-full h-36 object-cover rounded-xl border border-orange-700" />
                  <button type="button"
                    onClick={() => { handleThermalFile(null); if (thermalInputRef.current) thermalInputRef.current.value = ''; }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-orange-300 text-xs px-1.5 py-0.5 rounded">🌡️ THERMAL</div>
                </div>
              ) : (
                <button type="button" onClick={() => thermalInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-orange-700/60 rounded-xl flex flex-col items-center justify-center gap-2 text-orange-400 hover:bg-orange-900/20 transition">
                  <Thermometer className="w-7 h-7" />
                  <span className="text-xs">Upload thermal image</span>
                </button>
              )}
            </div>

            {/* Visible photo */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Visible Photo (regular camera)</label>
              <input ref={visibleInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleVisibleFile(e.target.files?.[0] ?? null)} />
              {visiblePreview ? (
                <div className="relative group">
                  <img src={visiblePreview} alt="Visible" className="w-full h-36 object-cover rounded-xl border border-slate-600" />
                  <button type="button"
                    onClick={() => { handleVisibleFile(null); if (visibleInputRef.current) visibleInputRef.current.value = ''; }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-slate-300 text-xs px-1.5 py-0.5 rounded">📷 VISIBLE</div>
                </div>
              ) : (
                <button type="button" onClick={() => visibleInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-700/30 transition">
                  <Camera className="w-7 h-7" />
                  <span className="text-xs">Upload visible image</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Analysis button + result */}
          {thermalFile && !aiRan && (
            <button type="button" onClick={runAI} disabled={aiLoading}
              className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition">
              {aiLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with AI…</>
                : <><Sparkles className="w-4 h-4" /> 🧠 AI Read Thermal Image</>
              }
            </button>
          )}

          {/* AI result card */}
          {aiResult && (
            <div className={`rounded-xl border p-4 space-y-3 ${(RISK_CONFIG[aiResult.mould_risk] ?? RISK_CONFIG.low).bg} ${(RISK_CONFIG[aiResult.mould_risk] ?? RISK_CONFIG.low).border}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" /> AI Thermal Analysis
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${(RISK_CONFIG[aiResult.mould_risk] ?? RISK_CONFIG.low).badge}`}>
                  {(RISK_CONFIG[aiResult.mould_risk] ?? RISK_CONFIG.low).icon} {aiResult.mould_risk?.toUpperCase()} RISK
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900/40 rounded-lg p-2">
                  <div className={`text-lg font-bold ${deltaColor(aiResult.temp_delta_c)}`}>{formatDelta(aiResult.temp_delta_c)}</div>
                  <div className="text-xs text-slate-400">ΔT</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2">
                  <div className="text-lg font-bold text-blue-400">{aiResult.moisture_probability}%</div>
                  <div className="text-xs text-slate-400">Moisture Prob.</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2">
                  <div className="text-lg font-bold text-slate-300">{aiResult.affected_area_sf?.toFixed(0)} SF</div>
                  <div className="text-xs text-slate-400">Est. Area</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium mb-1">Anomaly Type</div>
                <div className="text-sm text-slate-200">
                  {ANOMALY_TYPES.find(a => a.value === aiResult.anomaly_type)?.emoji ?? '❓'}{' '}
                  {ANOMALY_TYPES.find(a => a.value === aiResult.anomaly_type)?.label ?? aiResult.anomaly_type}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium mb-1">Recommendation</div>
                <div className="text-sm text-slate-200">{aiResult.recommendation}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-violet-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                AI analysis complete — review above and click Save to record
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); setError(null); }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl py-2.5 text-sm font-medium transition">
              Cancel
            </button>
            <button type="button" onClick={saveReading} disabled={saving || !form.room_name}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : '💾 Save Thermal Scan'}
            </button>
          </div>
        </div>
      )}

      {/* ── Readings List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading thermal scans…
        </div>
      ) : readings.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Thermometer className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400 font-medium">No thermal scans yet</p>
          <p className="text-slate-500 text-sm">Upload a FLIR infrared image to detect hidden moisture, wet insulation, or mould risk.</p>
          <button type="button" onClick={() => setShowForm(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition">
            <Upload className="w-4 h-4" /> Add First Scan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {readings.map(r => {
            const risk    = RISK_CONFIG[r.mould_risk ?? 'low'] ?? RISK_CONFIG.low;
            const isOpen  = expanded.has(r.id);
            const anomaly = ANOMALY_TYPES.find(a => a.value === r.anomaly_type);
            return (
              <div key={r.id} className={`rounded-2xl border ${risk.border} ${risk.bg} overflow-hidden`}>
                {/* Card header */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-200">{r.room_name}</span>
                      {r.wall_direction && (
                        <span className="text-xs bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded">
                          {WALL_DIRECTIONS.find(w => w.value === r.wall_direction)?.label ?? r.wall_direction}
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${risk.badge}`}>
                        {risk.icon} {r.mould_risk?.toUpperCase() ?? '—'} RISK
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {r.temp_delta_c !== null && (
                        <span className={`text-xs font-mono font-bold ${deltaColor(r.temp_delta_c)}`}>
                          ΔT {formatDelta(r.temp_delta_c)}
                        </span>
                      )}
                      {r.moisture_probability !== null && (
                        <span className="text-xs text-blue-300 font-medium">💧 {r.moisture_probability}% moisture</span>
                      )}
                      {r.affected_area_sf !== null && (
                        <span className="text-xs text-slate-400">📐 {r.affected_area_sf.toFixed(0)} SF</span>
                      )}
                      {anomaly && (
                        <span className="text-xs text-slate-400">{anomaly.emoji} {anomaly.label}</span>
                      )}
                    </div>
                    {r.recommendation && (
                      <p className="text-xs text-slate-400 mt-1.5 italic">"{r.recommendation}"</p>
                    )}
                  </div>

                  {/* Thumbnail */}
                  {r.thermal_photo_url && (
                    <button type="button"
                      onClick={() => setLightbox({ url: r.thermal_photo_url!, label: `${r.room_name} — Thermal` })}
                      className="relative flex-shrink-0 group">
                      <img src={r.thermal_photo_url} alt="thermal" className="w-14 h-14 object-cover rounded-xl border border-orange-700" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  )}

                  {/* Expand + Delete */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button type="button"
                      onClick={() => setExpanded(prev => {
                        const s = new Set(prev);
                        s.has(r.id) ? s.delete(r.id) : s.add(r.id);
                        return s;
                      })}
                      className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-400 transition">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => deleteReading(r.id)}
                      className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-red-700 text-slate-400 hover:text-white transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-slate-700/50 p-4 space-y-4">
                    {/* Temp detail */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-900/40 rounded-xl p-3">
                        <div className="text-base font-bold text-orange-300">{r.surface_temp_c !== null ? `${r.surface_temp_c}°C` : '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Surface Temp</div>
                      </div>
                      <div className="bg-slate-900/40 rounded-xl p-3">
                        <div className="text-base font-bold text-blue-300">{r.ambient_temp_c !== null ? `${r.ambient_temp_c}°C` : '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Ambient Temp</div>
                      </div>
                      <div className="bg-slate-900/40 rounded-xl p-3">
                        <div className={`text-base font-bold ${deltaColor(r.temp_delta_c)}`}>{formatDelta(r.temp_delta_c)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Delta ΔT</div>
                      </div>
                    </div>

                    {/* Photos side by side */}
                    {(r.thermal_photo_url || r.visible_photo_url) && (
                      <div className="grid grid-cols-2 gap-3">
                        {r.thermal_photo_url && (
                          <div>
                            <div className="text-xs text-orange-400 font-medium mb-1">🌡️ Thermal</div>
                            <button type="button"
                              onClick={() => setLightbox({ url: r.thermal_photo_url!, label: 'Thermal View' })}
                              className="relative group w-full">
                              <img src={r.thermal_photo_url} alt="thermal" className="w-full h-40 object-cover rounded-xl border border-orange-700" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                            </button>
                          </div>
                        )}
                        {r.visible_photo_url && (
                          <div>
                            <div className="text-xs text-slate-400 font-medium mb-1">📷 Visible</div>
                            <button type="button"
                              onClick={() => setLightbox({ url: r.visible_photo_url!, label: 'Visible View' })}
                              className="relative group w-full">
                              <img src={r.visible_photo_url} alt="visible" className="w-full h-40 object-cover rounded-xl border border-slate-600" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                                <Eye className="w-6 h-6 text-white" />
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Xactimate-style scope */}
                    {(r.affected_area_sf || r.recommendation) && (
                      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3">
                        <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">📋 Xactimate Scope Line</div>
                        <div className="font-mono text-xs text-slate-200 bg-slate-950/60 rounded-lg p-2">
                          {r.room_name}{r.wall_direction ? ` ${r.wall_direction}` : ''} — Remove drywall + insulation
                          {r.affected_area_sf ? ` — ${r.affected_area_sf.toFixed(0)} SF` : ''}
                          {r.temp_delta_c !== null ? ` · ΔT: ${formatDelta(r.temp_delta_c)}` : ''}
                          {r.moisture_probability !== null ? ` · ${r.moisture_probability}% prob.` : ''}
                        </div>
                      </div>
                    )}

                    {/* Location / notes */}
                    {r.location_notes && (
                      <div className="flex items-start gap-2 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
                        {r.location_notes}
                      </div>
                    )}

                    {/* Device & timestamp */}
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span>📱 {r.device_model ?? 'FLIR'}</span>
                      <span>🕐 {new Date(r.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <button type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white rounded-full p-2">
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center text-slate-300 text-sm mb-3 font-medium">{lightbox.label}</div>
            <img src={lightbox.url} alt={lightbox.label} className="w-full rounded-2xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

    </div>
  );
}
