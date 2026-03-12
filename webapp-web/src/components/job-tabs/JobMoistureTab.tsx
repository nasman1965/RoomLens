'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Droplets, Plus, Loader2, X, Bluetooth, BluetoothConnected,
  BluetoothOff, CheckCircle, Trash2, Info, Grid3X3, Camera,
} from 'lucide-react';

interface MapSession {
  id: string; job_id: string; name: string; surface_type: string;
  visit_day: number; background_url: string | null;
  grid_cols: number; grid_rows: number; created_at: string;
}
interface GridCell {
  id: string; session_id: string; col_index: number; row_index: number;
  mc_percent: number | null; material_type: string; label: string | null;
  rh_percent: number | null; temp_f: number | null; recorded_at: string;
}

const DRY_STD: Record<string, { wet: number; dry: number }> = {
  drywall: { wet: 17, dry: 12 }, wood: { wet: 28, dry: 19 },
  subfloor: { wet: 28, dry: 19 }, concrete: { wet: 5.5, dry: 4.0 },
  ceiling: { wet: 17, dry: 12 }, carpet: { wet: 20, dry: 10 },
  insulation: { wet: 25, dry: 15 }, tile: { wet: 4, dry: 2 }, other: { wet: 20, dry: 15 },
};

function cellColor(mc: number | null, mat: string): string {
  if (mc === null) return 'rgba(243,244,246,0.7)';
  const std = DRY_STD[mat] ?? DRY_STD.other;
  if (mc <= std.dry) return 'rgba(34,197,94,0.75)';
  if (mc >= std.wet) return 'rgba(239,68,68,0.80)';
  return 'rgba(234,179,8,0.75)';
}

const TRAMEX_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const TRAMEX_CHAR_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export default function JobMoistureTab({ jobId, userId }: { jobId: string; userId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessions, setSessions] = useState<MapSession[]>([]);
  const [activeSession, setActiveSession] = useState<MapSession | null>(null);
  const [cells, setCells] = useState<GridCell[]>([]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number } | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);

  // BLE
  const [bleDevice, setBleDevice] = useState<BluetoothDevice | null>(null);
  const [bleStatus, setBleStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [bleReading, setBleReading] = useState<number | null>(null);

  // Form
  const [form, setForm] = useState({ mc_percent: '', material_type: 'drywall', label: '', rh_percent: '', temp_f: '' });
  const [newSession, setNewSession] = useState({ name: 'Main Floor', surface_type: 'floor', visit_day: '1', grid_cols: '10', grid_rows: '8' });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadSessions(); }, [jobId]);

  const loadSessions = async () => {
    setLoading(true);
    const { data } = await supabase.from('moisture_map_sessions').select('*').eq('job_id', jobId).order('visit_day');
    setSessions(data || []);
    if (data && data.length > 0) setActiveSession(data[0]);
    setLoading(false);
  };

  useEffect(() => {
    if (!activeSession) { setCells([]); return; }
    supabase.from('moisture_grid_cells').select('*').eq('session_id', activeSession.id)
      .then(({ data }) => setCells(data || []));
    if (activeSession.background_url) {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = activeSession.background_url;
      img.onload = () => setBgImage(img);
    } else setBgImage(null);
  }, [activeSession]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeSession) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cols = activeSession.grid_cols, rows = activeSession.grid_rows;
    const cw = W / cols, ch = H / rows;
    ctx.clearRect(0, 0, W, H);
    if (bgImage) { ctx.globalAlpha = 0.35; ctx.drawImage(bgImage, 0, 0, W, H); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H); }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells.find(ce => ce.col_index === c && ce.row_index === r);
        const x = c * cw, y = r * ch;
        ctx.fillStyle = cellColor(cell?.mc_percent ?? null, cell?.material_type ?? 'drywall');
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        if (cell?.mc_percent != null) {
          ctx.fillStyle = '#1f2937';
          ctx.font = `bold ${Math.max(9, Math.min(13, cw * 0.28))}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${cell.mc_percent}%`, x + cw / 2, y + ch / 2);
        }
        if (selectedCell?.col === c && selectedCell?.row === r) {
          ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;
          ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
        }
        ctx.strokeStyle = 'rgba(100,116,139,0.3)'; ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cw, ch);
      }
    }
  }, [cells, activeSession, bgImage, selectedCell]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeSession) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) * canvas.width / rect.width) / (canvas.width / activeSession.grid_cols));
    const row = Math.floor(((e.clientY - rect.top) * canvas.height / rect.height) / (canvas.height / activeSession.grid_rows));
    setSelectedCell({ col, row });
    const existing = cells.find(c => c.col_index === col && c.row_index === row);
    setForm({
      mc_percent: existing?.mc_percent?.toString() ?? (bleReading?.toString() ?? ''),
      material_type: existing?.material_type ?? 'drywall',
      label: existing?.label ?? '', rh_percent: existing?.rh_percent?.toString() ?? '',
      temp_f: existing?.temp_f?.toString() ?? '',
    });
    setShowPanel(true);
  }, [activeSession, cells, bleReading]);

  const connectBLE = async () => {
    if (!navigator.bluetooth) { setError('Web Bluetooth not supported. Use Chrome on Android/desktop.'); return; }
    setBleStatus('connecting');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Tramex' }, { namePrefix: 'ME5' }, { services: [TRAMEX_SERVICE] }],
        optionalServices: [TRAMEX_SERVICE],
      });
      device.addEventListener('gattserverdisconnected', () => { setBleStatus('idle'); setBleDevice(null); setBleReading(null); });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(TRAMEX_SERVICE);
      const char = await service.getCharacteristic(TRAMEX_CHAR_RX);
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', (ev: Event) => {
        const val = (ev.target as BluetoothRemoteGATTCharacteristic).value;
        if (!val) return;
        const num = parseFloat(new TextDecoder().decode(val).trim());
        if (!isNaN(num)) { setBleReading(num); setForm(f => ({ ...f, mc_percent: num.toString() })); }
      });
      setBleDevice(device); setBleStatus('connected');
      setSuccess(`✅ Tramex ME5 connected`); setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setBleStatus('error');
      const msg = err instanceof Error ? err.message : 'BLE failed';
      setError(msg.includes('cancelled') ? 'Pairing cancelled.' : msg);
    }
  };

  const saveReading = async () => {
    if (!activeSession || !selectedCell || !form.mc_percent) { setError('MC% required.'); return; }
    setSaving(true);
    const payload = {
      session_id: activeSession.id, col_index: selectedCell.col, row_index: selectedCell.row,
      mc_percent: parseFloat(form.mc_percent), material_type: form.material_type,
      label: form.label || null, rh_percent: form.rh_percent ? parseFloat(form.rh_percent) : null,
      temp_f: form.temp_f ? parseFloat(form.temp_f) : null,
      device_id: bleDevice?.id ?? null, recorded_at: new Date().toISOString(),
    };
    const existing = cells.find(c => c.col_index === selectedCell.col && c.row_index === selectedCell.row);
    const result = existing
      ? await supabase.from('moisture_grid_cells').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('moisture_grid_cells').insert(payload).select().single();
    if (result.error) { setError(result.error.message); }
    else {
      setCells(prev => [...prev.filter(c => !(c.col_index === selectedCell.col && c.row_index === selectedCell.row)), result.data]);
      setSuccess('Saved! 💧'); setTimeout(() => setSuccess(''), 2000);
      setShowPanel(false); setSelectedCell(null);
    }
    setSaving(false);
  };

  const createSession = async () => {
    setSaving(true);
    const { data, error: err } = await supabase.from('moisture_map_sessions').insert({
      job_id: jobId, user_id: userId, name: newSession.name,
      surface_type: newSession.surface_type, visit_day: parseInt(newSession.visit_day),
      grid_cols: parseInt(newSession.grid_cols), grid_rows: parseInt(newSession.grid_rows),
    }).select().single();
    if (err) setError(err.message);
    else { setSessions(p => [...p, data]); setActiveSession(data); setShowNewSession(false); }
    setSaving(false);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;
    const path = `${userId}/${activeSession.id}/bg_${Date.now()}.${file.name.split('.').pop()}`;
    const { error: err } = await supabase.storage.from('moisture-maps').upload(path, file);
    if (err) { setError(err.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('moisture-maps').getPublicUrl(path);
    await supabase.from('moisture_map_sessions').update({ background_url: publicUrl }).eq('id', activeSession.id);
    setActiveSession(p => p ? { ...p, background_url: publicUrl } : p);
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = publicUrl; img.onload = () => setBgImage(img);
    setSuccess('📷 Background set!'); setTimeout(() => setSuccess(''), 2000);
  };

  const filledCells = cells.filter(c => c.mc_percent !== null);
  const dryCells = filledCells.filter(c => c.mc_percent! <= (DRY_STD[c.material_type]?.dry ?? 15));
  const wetCells = filledCells.filter(c => c.mc_percent! >= (DRY_STD[c.material_type]?.wet ?? 20));
  const dryPct = filledCells.length > 0 ? Math.round((dryCells.length / filledCells.length) * 100) : 0;
  const existingSelected = selectedCell ? cells.find(c => c.col_index === selectedCell.col && c.row_index === selectedCell.row) : null;

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-4">
      {/* Header toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {sessions.map(s => (
            <button key={s.id} onClick={() => { setActiveSession(s); setSelectedCell(null); setShowPanel(false); }}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${activeSession?.id === s.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {s.name} · Day {s.visit_day}
            </button>
          ))}
          <button onClick={() => setShowNewSession(!showNewSession)}
            className="text-xs px-3 py-1.5 rounded-full border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 font-medium transition flex items-center gap-1">
            <Plus className="w-3 h-3" /> New Surface
          </button>
        </div>
        {/* BLE button */}
        {bleStatus === 'connected' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg">
              <BluetoothConnected className="w-4 h-4 animate-pulse" /> ME5 Live
              {bleReading !== null && <span className="ml-1 bg-green-200 text-green-900 px-2 py-0.5 rounded-full font-bold">{bleReading}%</span>}
            </div>
            <button onClick={() => { bleDevice?.gatt?.disconnect(); setBleStatus('idle'); setBleDevice(null); setBleReading(null); }}
              className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg"><BluetoothOff className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={connectBLE} disabled={bleStatus === 'connecting'}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-2 rounded-lg transition">
            {bleStatus === 'connecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
            Connect Tramex ME5
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-center justify-between">{error}<button onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">{success}</div>}

      {/* New session form */}
      {showNewSession && (
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Grid3X3 className="w-4 h-4 text-blue-600" /> New Map Surface</h3>
            <button onClick={() => setShowNewSession(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input type="text" value={newSession.name} onChange={e => setNewSession(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={newSession.surface_type} onChange={e => setNewSession(p => ({ ...p, surface_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none">
                <option value="floor">Floor</option><option value="wall">Wall</option><option value="ceiling">Ceiling</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Day</label>
              <input type="number" min="1" value={newSession.visit_day} onChange={e => setNewSession(p => ({ ...p, visit_day: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" /></div>
            <div className="flex items-end">
              <button onClick={createSession} disabled={saving || !newSession.name}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No session */}
      {!activeSession && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No moisture maps yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "+ New Surface" to start a moisture map for this job</p>
        </div>
      )}

      {/* Active session */}
      {activeSession && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Canvas area */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-3">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Readings', val: filledCells.length },
                { label: '✅ Dry', val: dryCells.length },
                { label: '⚠️ Drying', val: filledCells.length - dryCells.length - wetCells.length },
                { label: '🔴 Wet', val: wetCells.length },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-900">{s.val}</div>
                  <div className="text-[10px] text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Drying progress */}
            {filledCells.length > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Drying Progress</span><span className="font-bold text-green-600">{dryPct}% DRY</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500" style={{ width: `${dryPct}%` }} />
                </div>
              </div>
            )}
            {/* Legend */}
            <div className="flex gap-3 mb-2 text-[10px]">
              {[{ c: 'bg-green-400', l: '✅ Dry' }, { c: 'bg-yellow-400', l: '⚠️ Drying' }, { c: 'bg-red-400', l: '🔴 Wet' }, { c: 'bg-gray-200', l: 'Empty' }].map(l => (
                <div key={l.l} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${l.c}`}></span><span className="text-gray-500">{l.l}</span></div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Tap any cell to log a reading</p>
            <canvas ref={canvasRef} width={600} height={420} onClick={handleCanvasClick}
              className="w-full rounded-lg cursor-crosshair border border-gray-100" style={{ touchAction: 'none' }} />
            {/* Background photo button */}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">
                {activeSession.background_url ? '📷 Floor plan loaded' : '💡 Set floor plan photo as background (Insta360 X4)'}
              </p>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                <Camera className="w-3 h-3" /> {activeSession.background_url ? 'Change' : 'Set Photo'}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          </div>

          {/* Cell panel */}
          {showPanel && selectedCell && (
            <div className="w-full lg:w-64 bg-white rounded-xl border border-blue-300 shadow-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Cell [{selectedCell.col + 1}, {selectedCell.row + 1}]
                  {existingSelected && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Update</span>}
                </h3>
                <button onClick={() => { setShowPanel(false); setSelectedCell(null); }}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              {bleStatus === 'connected' && bleReading !== null && (
                <div className="flex items-center justify-between mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-xs text-gray-600 flex items-center gap-1"><BluetoothConnected className="w-3 h-3 text-blue-500" />ME5 Live</span>
                  <span className="text-sm font-bold text-green-700">{bleReading}%</span>
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">MC% *
                    {bleStatus === 'connected' && <button onClick={() => bleReading !== null && setForm(f => ({ ...f, mc_percent: bleReading.toString() }))} className="ml-2 text-[10px] text-blue-600 hover:underline">Use live</button>}
                  </label>
                  <input type="number" step="0.1" value={form.mc_percent} onChange={e => setForm(p => ({ ...p, mc_percent: e.target.value }))}
                    placeholder="e.g. 18.5" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Material</label>
                  <select value={form.material_type} onChange={e => setForm(p => ({ ...p, material_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none">
                    {Object.keys(DRY_STD).map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location note</label>
                  <input type="text" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. NW corner" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveReading} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2.5 rounded-lg transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {existingSelected ? 'Update' : 'Save'}
                  </button>
                  {existingSelected && (
                    <button onClick={async () => { await supabase.from('moisture_grid_cells').delete().eq('id', existingSelected.id); setCells(p => p.filter(c => c.id !== existingSelected.id)); setShowPanel(false); setSelectedCell(null); }}
                      className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
