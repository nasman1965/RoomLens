'use client';
import React, { useRef, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, Upload, Camera, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { CarrierChecklistItem, CarrierSLATimer, CarrierJobFile, CarrierProfile } from '@/types/carriers';

interface CarrierChecklistProps {
  jobId: string;
  carrier: CarrierProfile;
  checklist: CarrierChecklistItem[];
  slaTimers: CarrierSLATimer[];
  files: CarrierJobFile[];
  onItemComplete: (itemId: string) => void;
  onFileUpload: (category: string, file: File) => void;
}

function SLABadge({ timer }: { timer: CarrierSLATimer }) {
  const cls = timer.status === 'completed' ? 'bg-green-100 text-green-700 border-green-300'
    : timer.status === 'overdue' ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
    : timer.is_critical ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
    : timer.is_warning  ? 'bg-orange-100 text-orange-700 border-orange-300'
    : 'bg-green-100 text-green-700 border-green-300';
  const label = timer.status === 'completed' ? '✓ Done'
    : timer.status === 'overdue' ? 'OVERDUE'
    : (timer.hours_remaining ?? 0) > 0 ? `${timer.hours_remaining}h ${(timer.minutes_remaining ?? 0) % 60}m`
    : 'OVERDUE';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${cls}`}>
      <Clock className="w-3 h-3" /> {label}
    </span>
  );
}

const TIMER_LABELS: Record<string, string> = {
  emergency_contact: 'Emergency Contact',
  site_arrival: 'Site Arrival',
  '24hr_report': '24-Hr Report',
  estimate_submission: 'Estimate Due',
};

export function CarrierChecklist({ jobId, carrier, checklist, slaTimers, files, onItemComplete, onFileUpload }: CarrierChecklistProps) {
  const color = carrier.carrier_color;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [expandedSections, setExpandedSections] = useState({ warnings: true, photos: true, documents: true, actions: true });

  const warnings   = checklist.filter(i => i.step_category === 'warning');
  const photos     = checklist.filter(i => i.step_category === 'photo');
  const documents  = checklist.filter(i => i.step_category === 'document');
  const actions    = checklist.filter(i => i.step_category === 'action');
  const required   = checklist.filter(i => i.is_required);
  const completed  = required.filter(i => i.completed);
  const pct        = required.length ? Math.round((completed.length / required.length) * 100) : 0;

  const triggerUpload = (cat: string) => { setUploadCategory(cat); fileInputRef.current?.click(); };
  const toggle = (s: keyof typeof expandedSections) => setExpandedSections(p => ({ ...p, [s]: !p[s] }));

  return (
    <div className="space-y-3">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: color }}>
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: color }}>
          <div>
            <span className="font-bold text-lg">{carrier.insurer_name}</span>
            <span className="ml-3 text-xs opacity-80">{carrier.vendor_program_name}</span>
          </div>
          <div className="text-right text-xs opacity-90">
            <div>📋 {carrier.claims_platform}</div>
            {carrier.tpa_name && <div>🏢 TPA: {carrier.tpa_name}</div>}
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 py-3 bg-gray-50 border-t" style={{ borderColor: color + '44' }}>
          <div className="flex items-center justify-between mb-1 text-sm">
            <span className="font-medium text-gray-700">Checklist Progress</span>
            <span className="font-bold" style={{ color }}>{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{completed.length} of {required.length} required items complete</p>
        </div>
      </div>

      {/* ── SLA Timers ─────────────────────────────────────────── */}
      {slaTimers.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> SLA Countdown Timers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {slaTimers.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-white rounded border border-slate-200 px-2 py-1.5">
                <span className="text-xs text-slate-600">{TIMER_LABELS[t.timer_name] ?? t.timer_name}</span>
                <SLABadge timer={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor Info ────────────────────────────────────────── */}
      {(carrier.vendor_phone || carrier.vendor_email || carrier.vendor_onboarding_url) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-blue-800 mb-1.5">📞 Vendor Network Contact</p>
          <div className="flex flex-wrap gap-3 text-blue-700">
            {carrier.vendor_phone && <span>📱 {carrier.vendor_phone}</span>}
            {carrier.vendor_email && <a href={`mailto:${carrier.vendor_email}`} className="underline">{carrier.vendor_email}</a>}
            {carrier.vendor_onboarding_url && (
              <a href={carrier.vendor_onboarding_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                <ExternalLink className="w-3 h-3" /> Apply to Network
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Warnings ───────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div>
          <button onClick={() => toggle('warnings')} className="w-full flex items-center justify-between px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm font-semibold text-yellow-800">
            <span>⚠️ Warnings & Alerts ({warnings.length})</span>
            {expandedSections.warnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.warnings && (
            <div className="mt-1.5 space-y-2">
              {warnings.map(w => (
                <div key={w.id} className={`rounded-lg border-2 p-3 flex items-start gap-2 ${w.blocking ? 'border-red-500 bg-red-50' : 'border-yellow-400 bg-yellow-50'}`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${w.blocking ? 'text-red-600' : 'text-yellow-600'}`} />
                  <div>
                    <p className={`font-bold text-sm ${w.blocking ? 'text-red-700' : 'text-yellow-700'}`}>{w.step_title}</p>
                    {w.warning_message && <p className="text-xs mt-1 text-gray-700">{w.warning_message}</p>}
                    {w.step_description && w.step_description !== w.warning_message && (
                      <p className="text-xs mt-1 text-gray-500 italic">{w.step_description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Photos ─────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => toggle('photos')} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" style={{ color }} />
              <span className="font-semibold text-sm text-gray-700">
                Required Photos ({photos.filter(p => p.completed).length}/{photos.length})
              </span>
            </div>
            {expandedSections.photos ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {expandedSections.photos && (
            <div className="divide-y divide-gray-100">
              {photos.map(photo => (
                <div key={photo.id} className={`px-3 py-2.5 flex items-start justify-between gap-2 ${photo.completed ? 'bg-green-50' : ''}`}>
                  <div className="flex items-start gap-2 flex-1">
                    <input type="checkbox" checked={!!photo.completed} onChange={() => onItemComplete(photo.id)}
                      className="mt-1 rounded" style={{ accentColor: color }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm font-medium ${photo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {photo.step_title}
                        </p>
                        {photo.blocking && !photo.completed && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">BLOCKING</span>
                        )}
                        {photo.is_required && !photo.completed && (
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded">REQ</span>
                        )}
                      </div>
                      {photo.photo_label && (
                        <p className="text-[11px] font-mono mt-0.5 px-1.5 py-0.5 bg-slate-100 rounded inline-block" style={{ color }}>
                          Label: {photo.photo_label}
                        </p>
                      )}
                      {photo.step_description && (
                        <p className="text-xs text-gray-500 mt-0.5">{photo.step_description}</p>
                      )}
                      {photo.warning_message && !photo.completed && (
                        <p className="text-xs text-orange-600 mt-0.5">⚠️ {photo.warning_message}</p>
                      )}
                    </div>
                  </div>
                  {photo.completed && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Documents ──────────────────────────────────────────── */}
      {documents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => toggle('documents')} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color }} />
              <span className="font-semibold text-sm text-gray-700">
                Required Documents ({documents.filter(d => d.completed).length}/{documents.length})
              </span>
            </div>
            {expandedSections.documents ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {expandedSections.documents && (
            <div className="divide-y divide-gray-100">
              {documents.map(doc => {
                const uploaded = files.find(f => f.file_category === doc.step_title.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''));
                const isDone = doc.completed || uploaded?.upload_status === 'uploaded';
                return (
                  <div key={doc.id} className={`px-3 py-2.5 flex items-center justify-between gap-2 ${isDone ? 'bg-green-50' : ''}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input type="checkbox" checked={isDone} onChange={() => onItemComplete(doc.id)}
                        className="rounded flex-shrink-0" style={{ accentColor: color }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {doc.step_title}
                          </p>
                          {doc.blocking && !isDone && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">BLOCKING</span>
                          )}
                        </div>
                        {doc.warning_message && !isDone && (
                          <p className="text-xs text-orange-600">{doc.warning_message}</p>
                        )}
                        {uploaded?.upload_status === 'uploaded' && (
                          <p className="text-xs text-green-600">✓ {uploaded.file_name}</p>
                        )}
                      </div>
                    </div>
                    {isDone
                      ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : (
                        <button onClick={() => triggerUpload(doc.step_title)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-white flex-shrink-0"
                          style={{ backgroundColor: color }}>
                          <Upload className="w-3 h-3" /> Upload
                        </button>
                      )
                    }
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => toggle('actions')} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <span className="font-semibold text-sm text-gray-700">
              ✅ Actions ({actions.filter(a => a.completed).length}/{actions.length})
            </span>
            {expandedSections.actions ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {expandedSections.actions && (
            <div className="divide-y divide-gray-100">
              {actions.map(action => (
                <div key={action.id} className={`px-3 py-2.5 flex items-start gap-2 ${action.completed ? 'bg-green-50' : ''}`}>
                  <input type="checkbox" checked={!!action.completed} onChange={() => onItemComplete(action.id)}
                    className="mt-1 rounded" style={{ accentColor: color }} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${action.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {action.step_title}
                      {action.blocking && !action.completed && (
                        <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">BLOCKING</span>
                      )}
                    </p>
                    {action.step_description && <p className="text-xs text-gray-500 mt-0.5">{action.step_description}</p>}
                    {action.warning_message && !action.completed && (
                      <p className="text-xs text-orange-600 mt-0.5">{action.warning_message}</p>
                    )}
                  </div>
                  {action.completed && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx"
        onChange={e => { const file = e.target.files?.[0]; if (file) onFileUpload(uploadCategory, file); e.target.value = ''; }}
      />
    </div>
  );
}
