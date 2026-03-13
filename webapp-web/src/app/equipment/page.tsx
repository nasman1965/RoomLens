'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Wrench, Plus, Search, Loader2, AlertCircle,
  CheckCircle, X, QrCode, Edit2, Package,
  Battery, Clock, Zap
} from 'lucide-react';

interface Equipment {
  id: string;
  qr_code: string | null;
  equipment_type: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  daily_rate: number | null;
  status: string;
  created_at: string;
}

const EQUIP_TYPES = [
  'dehumidifier', 'air_mover', 'heater', 'air_scrubber',
  'moisture_meter', 'thermal_camera', 'generator', 'other'
];
const TYPE_LABELS: Record<string, string> = {
  dehumidifier: '💧 Dehumidifier',
  air_mover: '🌀 Air Mover',
  heater: '🔥 Heater',
  air_scrubber: '🌫️ Air Scrubber',
  moisture_meter: '📏 Moisture Meter',
  thermal_camera: '📷 Thermal Camera',
  generator: '⚡ Generator',
  other: '📦 Other',
};
const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  deployed: 'bg-blue-100 text-cyan-300',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired: 'bg-slate-700/50 text-slate-600',
};

export default function EquipmentPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Equipment | null>(null);

  const [form, setForm] = useState({
    equipment_type: 'dehumidifier',
    make: '',
    model: '',
    serial_number: '',
    daily_rate: '',
    status: 'available',
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data } = await supabase
        .from('equipment_inventory')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setEquipment(data || []);
      setLoading(false);
    };
    init();
  }, [router]);

  const openAddForm = () => {
    setEditItem(null);
    setForm({ equipment_type: 'dehumidifier', make: '', model: '', serial_number: '', daily_rate: '', status: 'available' });
    setShowForm(true);
  };

  const openEditForm = (item: Equipment) => {
    setEditItem(item);
    setForm({
      equipment_type: item.equipment_type,
      make: item.make || '',
      model: item.model || '',
      serial_number: item.serial_number || '',
      daily_rate: item.daily_rate?.toString() || '',
      status: item.status,
    });
    setShowForm(true);
  };

  const generateQR = () => {
    return `RLP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload = {
      user_id: session.user.id,
      equipment_type: form.equipment_type,
      make: form.make || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
      status: form.status,
    };

    if (editItem) {
      const { data: updated, error: updateErr } = await supabase
        .from('equipment_inventory')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editItem.id)
        .select()
        .single();

      if (updateErr) { setError(updateErr.message); }
      else if (updated) {
        setEquipment(prev => prev.map(e => e.id === updated.id ? updated : e));
        setSuccess('Equipment updated!');
        setTimeout(() => setSuccess(''), 3000);
        setShowForm(false);
      }
    } else {
      const { data: created, error: createErr } = await supabase
        .from('equipment_inventory')
        .insert({ ...payload, qr_code: generateQR() })
        .select()
        .single();

      if (createErr) { setError(createErr.message); }
      else if (created) {
        setEquipment(prev => [created, ...prev]);
        setSuccess('Equipment added!');
        setTimeout(() => setSuccess(''), 3000);
        setShowForm(false);
      }
    }
    setSaving(false);
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Remove this equipment from inventory?')) return;
    await supabase.from('equipment_inventory').delete().eq('id', id);
    setEquipment(prev => prev.filter(e => e.id !== id));
  };

  const updateStatus = async (item: Equipment, newStatus: string) => {
    const { data: updated } = await supabase
      .from('equipment_inventory')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .select()
      .single();
    if (updated) setEquipment(prev => prev.map(e => e.id === updated.id ? updated : e));
  };

  const filtered = equipment.filter(e => {
    const matchSearch = !search || [e.make, e.model, e.serial_number, e.qr_code, e.equipment_type]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const available = equipment.filter(e => e.status === 'available').length;
  const deployed = equipment.filter(e => e.status === 'deployed').length;
  const maintenance = equipment.filter(e => e.status === 'maintenance').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-cyan-400" /> Equipment Inventory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{equipment.length} items · {deployed} deployed · {available} available</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> Add Equipment
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* Stats */}
      {equipment.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Available', value: available, icon: CheckCircle, color: 'green' },
            { label: 'Deployed', value: deployed, icon: Zap, color: 'blue' },
            { label: 'Maintenance', value: maintenance, icon: Battery, color: 'yellow' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-4">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by make, model, serial, QR..."
            className="w-full pl-9 pr-4 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'available', 'deployed', 'maintenance', 'retired'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition capitalize ${
                statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-gray-300 hover:border-blue-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-cyan-700/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200">{editItem ? 'Edit Equipment' : 'Add New Equipment'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-500" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
              <select
                value={form.equipment_type}
                onChange={e => setForm(p => ({ ...p, equipment_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {EQUIP_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Make / Brand</label>
              <input
                type="text" value={form.make}
                onChange={e => setForm(p => ({ ...p, make: e.target.value }))}
                placeholder="e.g. Dri-Eaz"
                className="w-full px-3 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Model</label>
              <input
                type="text" value={form.model}
                onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
                placeholder="e.g. Evolution LGR"
                className="w-full px-3 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Serial Number</label>
              <input
                type="text" value={form.serial_number}
                onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))}
                placeholder="SN-123456"
                className="w-full px-3 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Daily Rate ($)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.daily_rate}
                onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))}
                placeholder="e.g. 45.00"
                className="w-full px-3 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="available">Available</option>
                <option value="deployed">Deployed</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="submit" disabled={saving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editItem ? 'Save Changes' : 'Add to Inventory'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm text-slate-500 px-4 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white hover:bg-slate-700/30 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Equipment List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-16 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {equipment.length === 0 ? 'No equipment in inventory. Add your first item above.' : 'No equipment matches your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/30 border-b border-slate-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Equipment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 hidden sm:table-cell">Serial / QR</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 hidden md:table-cell">Daily Rate</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{TYPE_LABELS[item.equipment_type] || item.equipment_type}</div>
                    {(item.make || item.model) && (
                      <div className="text-xs text-slate-500">{[item.make, item.model].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="space-y-0.5">
                      {item.serial_number && (
                        <div className="text-xs font-mono text-slate-400">{item.serial_number}</div>
                      )}
                      {item.qr_code && (
                        <div className="flex items-center gap-1 text-xs text-cyan-400">
                          <QrCode className="w-3 h-3" />{item.qr_code}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {item.daily_rate
                      ? <span className="font-medium text-slate-200">${item.daily_rate.toFixed(2)}/day</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={item.status}
                      onChange={e => updateStatus(item, e.target.value)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[item.status] || 'bg-slate-700/50 text-slate-400'}`}
                    >
                      <option value="available">Available</option>
                      <option value="deployed">Deployed</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditForm(item)}
                        className="p-1.5 hover:bg-slate-700/50 rounded-lg transition text-slate-600 hover:text-cyan-400"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition text-slate-600 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
