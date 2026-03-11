'use client';
import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, Shield } from 'lucide-react';
import { ALL_CARRIERS, getCarrierConfig } from '@/config/carriers';
import { CarrierProfile, CarrierSlug } from '@/types/carriers';

interface CarrierSelectProps {
  onCarrierSelect: (carrier: CarrierProfile) => void;
  defaultValue?: CarrierSlug;
  disabled?: boolean;
}

export function CarrierSelect({ onCarrierSelect, defaultValue, disabled }: CarrierSelectProps) {
  const [selected, setSelected] = useState<CarrierSlug | undefined>(defaultValue);
  const [preview, setPreview]   = useState<CarrierProfile | null>(defaultValue ? getCarrierConfig(defaultValue) : null);
  const [open, setOpen]         = useState(false);

  const priorityCarriers = ALL_CARRIERS.filter(c => c.priorityScore >= 4 && c.value !== 'other');
  const otherCarriers    = ALL_CARRIERS.filter(c => c.priorityScore < 4 || c.value === 'other');

  const pick = (slug: CarrierSlug) => {
    setSelected(slug);
    const cfg = getCarrierConfig(slug);
    setPreview(cfg);
    onCarrierSelect(cfg);
    setOpen(false);
  };

  const selectedLabel = selected ? ALL_CARRIERS.find(c => c.value === selected)?.label : null;

  return (
    <div className="space-y-2 relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50"
      >
        {selectedLabel
          ? <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preview?.carrier_color }} />
              {selectedLabel}
            </span>
          : <span className="text-slate-400">Select insurance carrier...</span>
        }
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
          {/* Priority carriers */}
          <div className="px-3 py-1.5 bg-red-900/30 border-b border-slate-700">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              🔴 Priority Carriers — Ottawa Top 5
            </span>
          </div>
          {priorityCarriers.map(c => (
            <button key={c.value} type="button" onClick={() => pick(c.value as CarrierSlug)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700 transition text-left border-b border-slate-700/50">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{c.label}</span>
                  {c.isEmergency && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                </div>
                <span className="text-xs text-slate-400">{c.marketShare}% market · {c.platform}</span>
              </div>
              {selected === c.value && <Shield className="w-3 h-3 text-blue-400 flex-shrink-0" />}
            </button>
          ))}

          {/* Other */}
          <div className="px-3 py-1.5 bg-slate-700/30 border-b border-t border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📋 Other</span>
          </div>
          {otherCarriers.map(c => (
            <button key={c.value} type="button" onClick={() => pick(c.value as CarrierSlug)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 transition text-left">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm text-white">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* SLA Preview card */}
      {preview && (
        <div className="rounded-lg border-l-4 bg-slate-700/30 p-3 text-sm" style={{ borderLeftColor: preview.carrier_color }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm" style={{ color: preview.carrier_color }}>{preview.insurer_name}</span>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              Priority {preview.priority_score}/5
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-300">
            <div><span className="text-slate-400">Platform:</span> {preview.claims_platform}</div>
            <div>
              <span className="text-slate-400">1st Contact:</span>{' '}
              <span className={preview.emergency_contact_deadline_minutes <= 60 ? 'text-red-400 font-bold' : 'text-white'}>
                {preview.emergency_contact_deadline_minutes} min
              </span>
            </div>
            <div><span className="text-slate-400">Estimate:</span> {preview.estimate_deadline_hours}h</div>
            <div><span className="text-slate-400">Format:</span> {preview.export_format}</div>
          </div>
          {preview.emergency_contact_deadline_minutes <= 30 && (
            <div className="mt-2 flex items-center gap-1 text-red-400 font-bold text-xs">
              <AlertTriangle className="w-3 h-3" />
              STRICTEST SLAs — contact policyholder immediately
            </div>
          )}
          {preview.requires_hazmat_3stage_photos && (
            <div className="mt-1 text-xs text-yellow-400">☢️ Hazmat 3-stage photos required</div>
          )}
          {preview.tpa_name && (
            <div className="mt-1 text-xs text-blue-400">🏢 TPA: {preview.tpa_name}</div>
          )}
        </div>
      )}
    </div>
  );
}
