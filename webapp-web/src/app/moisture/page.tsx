'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Droplets, Plus, Loader2, AlertCircle, CheckCircle, X,
  Bluetooth, BluetoothConnected, BluetoothOff, ChevronDown,
  Camera, Grid3X3, Trash2, LayoutGrid, Settings2,
  TrendingDown, TrendingUp, Minus, Info, RefreshCw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────
interface Job { id: string; insured_name: string; property_address: string; }
interface MapSession {
  id: string;
  job_id: string;
  name: string;
  surface_type: string;
  visit_day: number;
  background_url: string | null;
  grid_cols: number;
  grid_rows: number;
  notes: string | null;
  created_at: string;
}
interface GridCell {
  id: string;
  session_id: string;
  col_index: number;
  row_index: number;
  mc_percent: number | null;
  rh_percent: number | null;
  temp_f: number | null;
  material_type: string;
  label: string | null;
  photo_url: string | null;
  device_id: string | null;
  recorded_at: string;
}

// ─── IICRC S500 Dry Standards ───────────────────────────────
const DRY_STD: Record<string, { wet: number; dry: number }> = {
  drywall:    { wet: 17, dry: 12 },
  wood:       { wet: 28, dry: 19 },
  subfloor:   { wet: 28, dry: 19 },
  concrete:   { wet: 5.5, dry: 4.0 },
  ceiling:    { wet: 17, dry: 12 },
  carpet:     { wet: 20, dry: 10 },
  insulation: { wet: 25, dry: 15 },
  tile:       { wet: 4, dry: 2 },
  other:      { wet: 20, dry: 15 },
};

const MATERIALS = Object.keys(DRY_STD);

function cellColor(mc: number | null, mat: string): string {
  if (mc === null) return 'rgba(243,244,246,0.7)'; // empty – light gray
  const std = DRY_STD[mat] ?? DRY_STD.other;
  if (mc <= std.dry)  return 'rgba(34,197,94,0.75)';   // green – DRY
  if (mc >= std.wet)  return 'rgba(239,68,68,0.80)';   // red   – WET
  return 'rgba(234,179,8,0.75)';                       // yellow – DRYING
}

function cellLabel(mc: number | null, mat: string): string {
  if (mc === null) return '';
  const std = DRY_STD[mat] ?? DRY_STD.other;
  if (mc <= std.dry)  return '✅';
  if (mc >= std.wet)  return '🔴';
  return '⚠️';
}

// ─── Tramex ME5 BLE ─────────────────────────────────────────
const TRAMEX_SERVICE   = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // UART-like NUS
const TRAMEX_CHAR_RX   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify

// ─── Component ──────────────────────────────────────────────
export default function MoisturePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Auth / job selection
  const [userId, setUserId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');

  // Sessions & cells
  const [sessions, setSessions] = useState<MapSession[]>([]);
  const [activeSession, setActiveSession] = useState<MapSession | null>(null);
  const [cells, setCells] = useState<GridCell[]>([]);

  // Canvas / interaction
  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number } | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // BLE Tramex ME5
  const [bleDevice, setBleDevice]   = useState<BluetoothDevice | null>(null);
  const [bleChar, setBleChar]       = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [bleStatus, setBleStatus]   = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [bleReading, setBleReading] = useState<number | null>(null); // live reading from meter

  // Form – manual entry fallback
  const [form, setForm] = useState({
    mc_percent: '',
    rh_percent: '',
    temp_f: '',
    material_type: 'drywall',
    label: '',
  });

  // New session form
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSession, setNewSession] = useState({
    name: 'Main Floor',
    surface_type: 'floor',
    visit_day: '1',
    grid_cols: '10',
    grid_rows: '8',
  });

  // UI state
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'stats'>('map');

  // ─── Init ────────────────────────────────────────────────
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

  // ─── Load sessions when job changes ─────────────────────
  useEffect(() => {
    if (!selectedJobId) { setSessions([]); setActiveSession(null); setCells([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from('moisture_map_sessions')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('visit_day');
      setSessions(data || []);
      if (data && data.length > 0) setActiveSession(data[0]);
      else setActiveSession(null);
    };
    load();
  }, [selectedJobId]);

  // ─── Load cells when session changes ────────────────────
  useEffect(() => {
    if (!activeSession) { setCells([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from('moisture_grid_cells')
        .select('*')
        .eq('session_id', activeSession.id);
      setCells(data || []);
    };
    load();
    // Load background image if any
    if (activeSession.background_url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = activeSession.background_url;
      img.onload = () => setBgImage(img);
    } else {
      setBgImage(null);
    }
  }, [activeSession]);

  // ─── Draw canvas ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeSession) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cols = activeSession.grid_cols;
    const rows = activeSession.grid_rows;
    const cw = W / cols;
    const ch = H / rows;

    ctx.clearRect(0, 0, W, H);

    // Background image
    if (bgImage) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(bgImage, 0, 0, W, H);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, H);
    }

    // Draw cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells.find(ce => ce.col_index === c && ce.row_index === r);
        const x = c * cw;
        const y = r * ch;

        // Fill
        ctx.fillStyle = cellColor(cell?.mc_percent ?? null, cell?.material_type ?? 'drywall');
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);

        // MC value
        if (cell?.mc_percent !== null && cell?.mc_percent !== undefined) {
          ctx.fillStyle = '#1f2937';
          ctx.font = `bold ${Math.max(9, Math.min(13, cw * 0.28))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${cell.mc_percent}%`, x + cw / 2, y + ch / 2);
        }

        // Selected cell highlight
        if (selectedCell?.col === c && selectedCell?.row === r) {
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
        }

        // Grid border
        ctx.strokeStyle = 'rgba(100,116,139,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cw, ch);
      }
    }
  }, [cells, activeSession, bgImage, selectedCell]);

  // ─── Canvas click → select cell ──────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeSession) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(px / (canvas.width / activeSession.grid_cols));
    const row = Math.floor(py / (canvas.height / activeSession.grid_rows));
    setSelectedCell({ col, row });

    // Pre-fill form from existing cell if any
    const existing = cells.find(c => c.col_index === col && c.row_index === row);
    if (existing) {
      setForm({
        mc_percent: existing.mc_percent?.toString() ?? '',
        rh_percent: existing.rh_percent?.toString() ?? '',
        temp_f: existing.temp_f?.toString() ?? '',
        material_type: existing.material_type,
        label: existing.label ?? '',
      });
    } else {
      setForm(f => ({ ...f, mc_percent: bleReading?.toString() ?? '', rh_percent: '', temp_f: '' }));
    }
    setShowPanel(true);
  }, [activeSession, cells, bleReading]);

  // ─── BLE: Connect Tramex ME5 ─────────────────────────────
  const connectBLE = async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth is not supported in this browser. Use Chrome on Android or desktop.');
      return;
    }
    setBleStatus('connecting');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'Tramex' },
          { namePrefix: 'ME5' },
          { services: [TRAMEX_SERVICE] },
        ],
        optionalServices: [TRAMEX_SERVICE],
      });
      device.addEventListener('gattserverdisconnected', () => {
        setBleStatus('idle');
        setBleChar(null);
        setBleDevice(null);
        setBleReading(null);
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(TRAMEX_SERVICE);
      const char = await service.getCharacteristic(TRAMEX_CHAR_RX);
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        // Tramex sends ASCII string like "18.5\r\n" or binary — parse float
        const raw = new TextDecoder().decode(value).trim();
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          setBleReading(num);
          setForm(f => ({ ...f, mc_percent: num.toString() }));
        }
      });
      setBleDevice(device);
      setBleChar(char);
      setBleStatus('connected');
      setSuccess(`✅ Tramex ME5 connected: ${device.name}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setBleStatus('error');
      const msg = err instanceof Error ? err.message : 'BLE connection failed';
      setError(msg.includes('cancelled') ? 'Pairing cancelled.' : `BLE Error: ${msg}`);
    }
  };

  const disconnectBLE = async () => {
    bleDevice?.gatt?.disconnect();
    setBleStatus('idle');
    setBleChar(null);
    setBleDevice(null);
    setBleReading(null);
  };

  // ─── Save reading to selected cell ──────────────────────
  const saveReading = async () => {
    if (!activeSession || !selectedCell) return;
    if (!form.mc_percent) { setError('MC% reading is required.'); return; }
    setSaving(true); setError('');

    const payload = {
      session_id: activeSession.id,
      col_index: selectedCell.col,
      row_index: selectedCell.row,
      mc_percent: parseFloat(form.mc_percent),
      rh_percent: form.rh_percent ? parseFloat(form.rh_percent) : null,
      temp_f: form.temp_f ? parseFloat(form.temp_f) : null,
      material_type: form.material_type,
      label: form.label || null,
      device_id: bleDevice?.id ?? null,
      recorded_at: new Date().toISOString(),
    };

    const existing = cells.find(c => c.col_index === selectedCell.col && c.row_index === selectedCell.row);
    let result;
    if (existing) {
      result = await supabase
        .from('moisture_grid_cells')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('moisture_grid_cells')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setCells(prev => {
        const filtered = prev.filter(c => !(c.col_index === selectedCell.col && c.row_index === selectedCell.row));
        return [...filtered, result.data];
      });
      setSuccess('Reading saved! 💧');
      setTimeout(() => setSuccess(''), 2500);
      setShowPanel(false);
      setSelectedCell(null);
    }
    setSaving(false);
  };

  // ─── Delete cell reading ─────────────────────────────────
  const deleteCell = async (cellId: string) => {
    await supabase.from('moisture_grid_cells').delete().eq('id', cellId);
    setCells(prev => prev.filter(c => c.id !== cellId));
  };

  // ─── Create new session ──────────────────────────────────
  const createSession = async () => {
    if (!selectedJobId) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from('moisture_map_sessions')
      .insert({
        job_id: selectedJobId,
        user_id: userId,
        name: newSession.name,
        surface_type: newSession.surface_type,
        visit_day: parseInt(newSession.visit_day),
        grid_cols: parseInt(newSession.grid_cols),
        grid_rows: parseInt(newSession.grid_rows),
      })
      .select()
      .single();
    if (err) { setError(err.message); }
    else {
      setSessions(prev => [...prev, data]);
      setActiveSession(data);
      setShowNewSession(false);
      setSuccess(`📋 "${data.name}" – Day ${data.visit_day} created!`);
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  };

  // ─── Upload background photo (Insta360 or floor plan) ───
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;
    setSaving(true);
    const ext = file.name.split('.').pop();
    const path = `${userId}/${activeSession.id}/bg_${Date.now()}.${ext}`;
    const { error: storageErr } = await supabase.storage.from('moisture-maps').upload(path, file);
    if (storageErr) { setError(storageErr.message); setSaving(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('moisture-maps').getPublicUrl(path);
    await supabase.from('moisture_map_sessions').update({ background_url: publicUrl }).eq('id', activeSession.id);
    setActiveSession(prev => prev ? { ...prev, background_url: publicUrl } : prev);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = publicUrl;
    img.onload = () => setBgImage(img);
    setSuccess('📷 Background photo set!');
    setTimeout(() => setSuccess(''), 3000);
    setSaving(false);
  };

  // ─── Stats ───────────────────────────────────────────────
  const filledCells = cells.filter(c => c.mc_percent !== null);
  const dryCells    = filledCells.filter(c => {
    const std = DRY_STD[c.material_type] ?? DRY_STD.other;
    return c.mc_percent! <= std.dry;
  });
  const wetCells    = filledCells.filter(c => {
    const std = DRY_STD[c.material_type] ?? DRY_STD.other;
    return c.mc_percent! >= std.wet;
  });
  const dryingCells = filledCells.length - dryCells.length - wetCells.length;
  const avgMC = filledCells.length > 0
    ? (filledCells.reduce((s, c) => s + c.mc_percent!, 0) / filledCells.length).toFixed(1)
    : '—';
  const dryPct = filledCells.length > 0 ? Math.round((dryCells.length / filledCells.length) * 100) : 0;

  // ─── Selected cell existing data ─────────────────────────
  const existingSelected = selectedCell
    ? cells.find(c => c.col_index === selectedCell.col && c.row_index === selectedCell.row)
    : null;

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Droplets className="w-6 h-6 text-blue-600" /> Moisture Map
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tramex ME5 · Insta360 X4 · IICRC S500 · {selectedJob?.insured_name || 'Select a job'}
          </p>
        </div>

        {/* BLE Connect Button */}
        <div className="flex items-center gap-2">
          {bleStatus === 'connected' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg">
                <BluetoothConnected className="w-4 h-4 animate-pulse" />
                ME5 Connected
                {bleReading !== null && (
                  <span className="ml-2 bg-green-200 text-green-900 px-2 py-0.5 rounded-full font-bold">
                    {bleReading}%
                  </span>
                )}
              </div>
              <button
                onClick={disconnectBLE}
                className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
              >
                <BluetoothOff className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={connectBLE}
              disabled={bleStatus === 'connecting'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {bleStatus === 'connecting'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Bluetooth className="w-4 h-4" />}
              {bleStatus === 'connecting' ? 'Pairing…' : 'Connect Tramex ME5'}
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────── */}
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

      {/* ── Job + Session Selector ──────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-xl p-3">
        {/* Job */}
        <div className="relative">
          <select
            value={selectedJobId}
            onChange={e => setSelectedJobId(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
          >
            {jobs.length === 0 && <option value="">No jobs</option>}
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.insured_name} — {j.property_address}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Session tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSession(s); setSelectedCell(null); setShowPanel(false); }}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                activeSession?.id === s.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
              }`}
            >
              {s.name} · Day {s.visit_day}
            </button>
          ))}
          <button
            onClick={() => setShowNewSession(!showNewSession)}
            disabled={!selectedJobId}
            className="text-xs px-3 py-1.5 rounded-full border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 font-medium transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> New Surface
          </button>
        </div>

        {/* Upload background photo */}
        {activeSession && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 text-gray-600 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              {activeSession.background_url ? 'Change Photo' : 'Set Floor Plan Photo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          </div>
        )}
      </div>

      {/* ── New Session Form ─────────────────────────────────── */}
      {showNewSession && (
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-blue-600" /> Create New Map Surface
            </h3>
            <button onClick={() => setShowNewSession(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Surface Name</label>
              <input
                type="text"
                value={newSession.name}
                onChange={e => setNewSession(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Main Floor, Basement"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={newSession.surface_type}
                onChange={e => setNewSession(p => ({ ...p, surface_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
                <option value="ceiling">Ceiling</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Visit Day</label>
              <input
                type="number" min="1" max="60"
                value={newSession.visit_day}
                onChange={e => setNewSession(p => ({ ...p, visit_day: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grid Cols</label>
              <input
                type="number" min="3" max="20"
                value={newSession.grid_cols}
                onChange={e => setNewSession(p => ({ ...p, grid_cols: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grid Rows</label>
              <input
                type="number" min="3" max="20"
                value={newSession.grid_rows}
                onChange={e => setNewSession(p => ({ ...p, grid_rows: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={createSession}
              disabled={saving || !newSession.name}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Surface
            </button>
          </div>
        </div>
      )}

      {/* ── No Session State ─────────────────────────────────── */}
      {!activeSession && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <LayoutGrid className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {jobs.length === 0
              ? 'Create a job first to start moisture mapping.'
              : 'Click "+ New Surface" above to create your first moisture map.'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Each surface = one room/area per visit day. Connect your Tramex ME5 via Bluetooth to log readings automatically.
          </p>
        </div>
      )}

      {/* ── Main Layout: Canvas + Panel ─────────────────────── */}
      {activeSession && (
        <div className="flex flex-col lg:flex-row gap-4">

          {/* Stats Bar */}
          <div className="w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Readings', value: filledCells.length, sub: `of ${activeSession.grid_cols * activeSession.grid_rows} cells`, color: 'blue' },
                { label: '✅ Dry', value: dryCells.length, sub: `${dryPct}%`, color: 'green' },
                { label: '⚠️ Drying', value: dryingCells, sub: 'in progress', color: 'yellow' },
                { label: '🔴 Wet', value: wetCells.length, sub: `avg ${avgMC}%`, color: 'red' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs font-semibold text-gray-600">{s.label}</div>
                  <div className="text-[10px] text-gray-400">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 mb-4">
              {(['map', 'list', 'stats'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'map' ? '🗺️ Map' : tab === 'list' ? '📋 Readings List' : '📊 IICRC Standards'}
                </button>
              ))}
            </div>

            {/* MAP TAB */}
            {activeTab === 'map' && (
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Canvas */}
                <div className="flex-1">
                  <div className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Tap any cell · {activeSession.name} · Day {activeSession.visit_day} ·
                        {' '}{activeSession.grid_cols}×{activeSession.grid_rows} grid
                      </p>
                      {bleStatus === 'connected' && bleReading !== null && (
                        <div className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full animate-pulse">
                          <BluetoothConnected className="w-3 h-3" />
                          Live: {bleReading}%
                        </div>
                      )}
                    </div>

                    {/* Color Legend */}
                    <div className="flex items-center gap-3 mb-2 text-[10px]">
                      {[
                        { color: 'bg-green-400', label: '✅ Dry' },
                        { color: 'bg-yellow-400', label: '⚠️ Drying' },
                        { color: 'bg-red-400', label: '🔴 Wet' },
                        { color: 'bg-gray-200', label: 'Empty' },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1">
                          <span className={`w-3 h-3 rounded-sm ${l.color}`}></span>
                          <span className="text-gray-600">{l.label}</span>
                        </div>
                      ))}
                    </div>

                    <canvas
                      ref={canvasRef}
                      width={700}
                      height={500}
                      onClick={handleCanvasClick}
                      className="w-full rounded-lg cursor-crosshair border border-gray-100"
                      style={{ touchAction: 'none' }}
                    />

                    <p className="text-[10px] text-center text-gray-400 mt-2">
                      {activeSession.background_url
                        ? '📷 Floor plan photo loaded as background'
                        : 'Click "Set Floor Plan Photo" to use your Insta360 X4 photo as background'}
                    </p>
                  </div>
                </div>

                {/* Reading Panel */}
                {showPanel && selectedCell && (
                  <div className="w-full lg:w-72 bg-white rounded-xl border border-blue-300 shadow-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-800">
                        Cell [{selectedCell.col + 1}, {selectedCell.row + 1}]
                        {existingSelected && (
                          <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Update</span>
                        )}
                      </h3>
                      <button onClick={() => { setShowPanel(false); setSelectedCell(null); }}>
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    {/* Live reading indicator */}
                    {bleStatus === 'connected' && (
                      <div className={`flex items-center justify-between mb-3 p-2 rounded-lg border ${bleReading !== null ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <BluetoothConnected className="w-3 h-3 text-blue-500" />
                          Tramex ME5 Live
                        </span>
                        {bleReading !== null
                          ? <span className="text-sm font-bold text-green-700">{bleReading}% MC</span>
                          : <span className="text-xs text-gray-400">Waiting for reading…</span>
                        }
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* MC% */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          MC% <span className="text-red-500">*</span>
                          {bleStatus === 'connected' && (
                            <button
                              onClick={() => bleReading !== null && setForm(f => ({ ...f, mc_percent: bleReading.toString() }))}
                              className="ml-2 text-[10px] text-blue-600 hover:underline"
                            >
                              Use live reading
                            </button>
                          )}
                        </label>
                        <input
                          type="number" step="0.1" min="0" max="100"
                          value={form.mc_percent}
                          onChange={e => setForm(p => ({ ...p, mc_percent: e.target.value }))}
                          placeholder="e.g. 18.5"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {form.mc_percent && form.material_type && (() => {
                          const std = DRY_STD[form.material_type] ?? DRY_STD.other;
                          const mc = parseFloat(form.mc_percent);
                          const color = mc <= std.dry ? 'text-green-600' : mc >= std.wet ? 'text-red-600' : 'text-yellow-600';
                          const label = mc <= std.dry ? '✅ DRY' : mc >= std.wet ? '🔴 WET' : '⚠️ DRYING';
                          return <p className={`text-[10px] mt-1 font-bold ${color}`}>{label} · goal ≤{std.dry}%</p>;
                        })()}
                      </div>

                      {/* Material */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Material</label>
                        <select
                          value={form.material_type}
                          onChange={e => setForm(p => ({ ...p, material_type: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {MATERIALS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                        </select>
                      </div>

                      {/* RH% */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">RH% (optional)</label>
                        <input
                          type="number" step="0.1" min="0" max="100"
                          value={form.rh_percent}
                          onChange={e => setForm(p => ({ ...p, rh_percent: e.target.value }))}
                          placeholder="e.g. 65"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* Temp */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Temp °F (optional)</label>
                        <input
                          type="number" step="0.1"
                          value={form.temp_f}
                          onChange={e => setForm(p => ({ ...p, temp_f: e.target.value }))}
                          placeholder="e.g. 72"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* Location label */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Location note (optional)</label>
                        <input
                          type="text"
                          value={form.label}
                          onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                          placeholder="e.g. NW corner drywall"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={saveReading}
                          disabled={saving}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2.5 rounded-lg transition"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          {existingSelected ? 'Update' : 'Save'}
                        </button>
                        {existingSelected && (
                          <button
                            onClick={() => { deleteCell(existingSelected.id); setShowPanel(false); setSelectedCell(null); }}
                            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LIST TAB */}
            {activeTab === 'list' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {filledCells.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <Droplets className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    No readings yet — tap cells on the Map tab.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Cell</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Material</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">MC%</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">RH%</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">°F</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Note</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filledCells.sort((a, b) => a.row_index - b.row_index || a.col_index - b.col_index).map(c => {
                        const std = DRY_STD[c.material_type] ?? DRY_STD.other;
                        const mc = c.mc_percent!;
                        const isDry = mc <= std.dry;
                        const isWet = mc >= std.wet;
                        return (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-xs text-gray-600">[{c.col_index+1},{c.row_index+1}]</td>
                            <td className="px-4 py-2 capitalize text-gray-700">{c.material_type}</td>
                            <td className="px-4 py-2 text-center font-bold text-gray-900">{mc}%</td>
                            <td className="px-4 py-2 text-center text-gray-500">{c.rh_percent ?? '—'}</td>
                            <td className="px-4 py-2 text-center text-gray-500">{c.temp_f ?? '—'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isDry ? 'bg-green-100 text-green-700' :
                                isWet ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {isDry ? '✅ DRY' : isWet ? '🔴 WET' : '⚠️ DRYING'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">{c.label ?? '—'}</td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => deleteCell(c.id)} className="text-red-300 hover:text-red-500 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* STATS TAB */}
            {activeTab === 'stats' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">IICRC S500 Dry Standards Reference</h3>
                </div>
                {/* Progress Bar – drying completion */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Overall Drying Progress</span>
                    <span className="font-bold text-green-700">{dryPct}% DRY</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-4 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 transition-all"
                      style={{ width: `${dryPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{dryCells.length} of {filledCells.length} readings at or below dry goal</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Material</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-red-600">Wet ≥%</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-green-600">Dry Goal ≤%</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">Your Reading</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.entries(DRY_STD).map(([mat, std]) => {
                        const matCells = filledCells.filter(c => c.material_type === mat);
                        const latestMC = matCells.length > 0
                          ? matCells.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0].mc_percent
                          : null;
                        const isDry = latestMC !== null && latestMC <= std.dry;
                        const isWet = latestMC !== null && latestMC >= std.wet;
                        return (
                          <tr key={mat} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-800 capitalize">{mat}</td>
                            <td className="px-4 py-2.5 text-center text-red-600 font-mono">≥{std.wet}%</td>
                            <td className="px-4 py-2.5 text-center text-green-600 font-mono">≤{std.dry}%</td>
                            <td className="px-4 py-2.5 text-center text-gray-700 font-bold">
                              {latestMC !== null ? `${latestMC}%` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {latestMC !== null ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isDry ? 'bg-green-100 text-green-700' :
                                  isWet ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {isDry ? '✅ DRY' : isWet ? '🔴 WET' : '⚠️ DRYING'}
                                </span>
                              ) : <span className="text-gray-300 text-xs">No data</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLE Info Banner */}
      {bleStatus === 'idle' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 How to use Tramex ME5 with RoomLens Pro</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs">
              <li>Power on your Tramex ME5 and enable Bluetooth on the meter.</li>
              <li>On this page, click <strong>"Connect Tramex ME5"</strong> — browser will show a pairing dialog.</li>
              <li>Select your meter from the list and click Pair.</li>
              <li>The live reading from the meter will appear in the blue bar at the top.</li>
              <li>Tap a grid cell on the map → the live reading auto-fills. Click <strong>Save</strong>.</li>
              <li>Repeat for each measurement point. The grid colors to green/yellow/red automatically.</li>
            </ol>
            <p className="mt-2 text-xs text-blue-600">
              📷 <strong>Insta360 X4 tip:</strong> Take a 360° photo of each room, export as flat JPEG, then click
              "Set Floor Plan Photo" to use it as the map background.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
