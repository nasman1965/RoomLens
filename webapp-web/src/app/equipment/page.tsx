'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Package, Plus, Loader2, AlertCircle,
  CheckCircle, X, QrCode, Wrench, Battery
} from 'lucide-react';

interface Equipment {
  id: string;
  user_id: string;
  qr_code: string | null;
  equipment_type: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  daily_rate: number | null;
  status: string;
  created_at: string;
}

const EQUIPMENT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  dehumidifier: { label: 'Dehumidifier',   icon: '💨', color: 'bg-blue-100 text-blue-700'   },
  air_mover:    { label: 'Air Mover',      icon: '🌀', color: 'bg-cyan-100 text-cyan-700'   },
  air_scrubber: { label: 'Air Scrubber',   icon: '🫧', color: 'bg-green-100 text-green-700' },
  heater:       { label: 'Heater',         icon: '🔥', color: 'bg-orange-100 text-orange-700'},
  desiccant:    { label: 'Desiccant',      icon: '🧂', color: 'bg-yellow-100 text-yellow-700'},
  injectidry:   { label: 'Injectidry',     icon: '💉', color: 'bg-purple-100 text-purple-700'},
  other:        { label: 'Other',          icon: '🔧', color: 'bg-gray-100 text-gray-700'   },
};

const STATUS_STYLE: Record<string, string> = {
  available:  'bg-green-100 text-green-700 border-green-200',
  deployed:   'bg-blue-100 text-blue-700 border-blue-200',
  maintenance:'bg-yellow-100 text-yellow-700 border-yellow-200',
  retired:    'bg-gray-100 text-gray-400 border-gray-200',
};

export default function EquipmentPage() {
  const router = useRouter();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [userId, setUserId] = useState('');

  const [form, setForm] = useState({
    equipment_type: 'dehumidifier',
    make: '',
    model: '',
    serial_number: '',
    daily_rate: '',
    status: 'available',
  });

  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make && !form.model) { setError('Please enter make or model.'); return; }
    setSaving(true); setError('');

    const qr = `EQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const { error: insErr } = await supabase.from('equipment_inventory').insert({
      user_id: userId,
      qr_code: qr,
      equipment_type: form.equipment_type,
      make: form.make || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
      status: form.status,
    });

    if (insErr) { setError(insErr.message); setSaving(false); return; }

    const { data } = await supabase
      .from('equipment_inventory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setEquipment(data || []);
    setShowForm(false);
    setForm({ equipment_type: 'dehumidifier', make: '', model: '', serial_number: '', daily_rate: '', status: 'available' });
    setSaving(false);
  };

  const deleteEquipment = async (id: string) => {
    if (!confirm('Remove this equipment from inventory?')) return;
    await supabase.from('equipment_inventory').delete().eq('id', id);
    setEquipment(prev => prev.filter(e => e.id !== id));
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('equipment_inventory').update({ status }).eq('id', id);
    setEquipment(prev => prev.map(e => e.id === id ? { ...e, status } : e));
  };

  const filtered = equipment.filter(e =>
    (filterStatus === 'all' || e.status === filterStatus) &&
    (filterType === 'all' || e.equipment_type === filterType)
  );

  const statCounts = {
    total:      equipment.length,
    available:  equipment.filter(e => e.status === 'available').length,
    deployed:   equipment.filter(e => e.status === 'deployed').length,
    maintenance:equipment.filter(e => e.status === 'maintenance').length,
  };

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
            <Package className="w-6 h-6 text-blue-600" /> Equipment Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track drying equipment with QR codes and rental rates</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
          <Plus className="w-4 h-4" /> Add Equipment
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: statCounts.total,       color: 'text-gray-800',  bg: 'bg-white' },
          { label: 'Available',   value: statCounts.available,   color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Deployed',    value: statCounts.deployed,    color: 'text-blue-700',  bg: 'bg-blue-50'  },
          { label: 'Maintenance', value: statCounts.maintenance, color: 'text-yellow-700',bg: 'bg-yellow-50'},
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border border-gray-200 p-4 ${stat.bg}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {equipment.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-xs font-medium text-gray-500 mr-1">Status:</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="deployed">Deployed</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mr-1">Type:</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">All Types</option>
              {Object.entries(EQUIPMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-400">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Equipment grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {equipment.length === 0 ? 'No equipment in inventory yet.' : 'No equipment matches your filters.'}
          </p>
          {equipment.length === 0 && (
            <button onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> Add First Equipment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const typeInfo = EQUIPMENT_TYPES[item.equipment_type] || EQUIPMENT_TYPES.other;
            return (
              <div key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteEquipment(item.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-bold text-gray-900">
                    {[item.make, item.model].filter(Boolean).join(' ') || 'Unknown model'}
                  </p>
                  {item.serial_number && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> S/N: {item.serial_number}
                    </p>
                  )}
                  {item.qr_code && (
                    <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                      <QrCode className="w-3 h-3" /> {item.qr_code}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none ${STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}
                  >
                    <option value="available">✅ Available</option>
                    <option value="deployed">🔵 Deployed</option>
                    <option value="maintenance">⚠️ Maintenance</option>
                    <option value="retired">⬛ Retired</option>
                  </select>

                  {item.daily_rate && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Battery className="w-3.5 h-3.5 text-green-500" />
                      <span className="font-semibold">${item.daily_rate}/day</span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 mt-2">
                  Added {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Equipment Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Add Equipment</h3>
              <button onClick={() => setShowForm(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={form.equipment_type} onChange={e => upd('equipment_type', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {Object.entries(EQUIPMENT_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => upd('status', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="available">Available</option>
                    <option value="deployed">Deployed</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input type="text" placeholder="Dri-Eaz" value={form.make}
                    onChange={e => upd('make', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input type="text" placeholder="LGR 2800i" value={form.model}
                    onChange={e => upd('model', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input type="text" placeholder="SN-001234" value={form.serial_number}
                    onChange={e => upd('serial_number', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Rate ($)</label>
                  <input type="number" step="0.01" min="0" placeholder="45.00" value={form.daily_rate}
                    onChange={e => upd('daily_rate', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <QrCode className="w-4 h-4 inline mr-1.5" />
                A unique QR code (e.g. EQ-XXXX-XXX) will be auto-generated for this equipment.
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><CheckCircle className="w-4 h-4" /> Add to Inventory</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
