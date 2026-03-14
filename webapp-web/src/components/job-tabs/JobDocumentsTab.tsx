'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FileText, Upload, Plus, Send, Pen, CheckCircle, Clock,
  Eye, Trash2, Download, X, Loader2, AlertCircle, Copy,
  Phone, Mail, ChevronDown, FilePlus2, FileSignature,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Template {
  id: string;
  name: string;
  doc_type: string;
  description: string | null;
  file_name: string | null;
  body_html: string | null;
  requires_signature: boolean;
  is_active: boolean;
  merge_tags: MergeTag[];
  created_at: string;
}
interface MergeTag { tag: string; label: string; source_field: string }
interface JobDocument {
  id: string;
  name: string;
  doc_type: string;
  status: string;
  sent_to_email: string | null;
  sent_to_phone: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  sign_token: string;
  sign_token_expires: string;
  body_html_filled: string | null;
  created_at: string;
}
interface JobData {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  claim_number: string | null;
  insurance_company: string | null;
  adjuster_name: string | null;
  adjuster_phone: string | null;
  date_of_loss: string | null;
  company_name?: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DOC_TYPE_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  waf:                     { label: 'Work Authorization',       color: 'text-blue-400',   badge: 'bg-blue-900/40 text-blue-300'   },
  direction_to_pay:        { label: 'Direction to Pay',         color: 'text-green-400',  badge: 'bg-green-900/40 text-green-300' },
  assignment_of_benefits:  { label: 'Assignment of Benefits',   color: 'text-purple-400', badge: 'bg-purple-900/40 text-purple-300'},
  certificate_of_completion:{ label: 'Certificate of Completion',color: 'text-teal-400', badge: 'bg-teal-900/40 text-teal-300'   },
  property_access:         { label: 'Property Access Auth',     color: 'text-cyan-400',   badge: 'bg-cyan-900/40 text-cyan-300'   },
  contents_release:        { label: 'Contents Release',         color: 'text-amber-400',  badge: 'bg-amber-900/40 text-amber-300' },
  photo_consent:           { label: 'Photo Consent',            color: 'text-pink-400',   badge: 'bg-pink-900/40 text-pink-300'   },
  mold_auth:               { label: 'Mold Remediation Auth',    color: 'text-orange-400', badge: 'bg-orange-900/40 text-orange-300'},
  scope_of_work:           { label: 'Scope of Work',            color: 'text-indigo-400', badge: 'bg-indigo-900/40 text-indigo-300'},
  final_report:            { label: 'Final Report',             color: 'text-slate-400',  badge: 'bg-slate-700 text-slate-300'    },
  proof_of_loss:           { label: 'Proof of Loss',            color: 'text-red-400',    badge: 'bg-red-900/40 text-red-300'     },
  staff_nda:               { label: 'Staff NDA',                color: 'text-violet-400', badge: 'bg-violet-900/40 text-violet-300'},
  subcontractor_agreement: { label: 'Subcontractor Agreement',  color: 'text-lime-400',   badge: 'bg-lime-900/40 text-lime-300'   },
  other:                   { label: 'Other',                    color: 'text-slate-400',  badge: 'bg-slate-700 text-slate-300'    },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:    { label: 'Draft',    color: 'bg-slate-700 text-slate-300',    icon: <FileText className="w-3 h-3" /> },
  sent:     { label: 'Sent',     color: 'bg-blue-900/60 text-blue-300',   icon: <Send className="w-3 h-3" /> },
  viewed:   { label: 'Viewed',   color: 'bg-amber-900/60 text-amber-300', icon: <Eye className="w-3 h-3" /> },
  signed:   { label: 'Signed',   color: 'bg-green-900/60 text-green-300', icon: <CheckCircle className="w-3 h-3" /> },
  declined: { label: 'Declined', color: 'bg-red-900/60 text-red-300',     icon: <X className="w-3 h-3" /> },
  expired:  { label: 'Expired',  color: 'bg-slate-600 text-slate-400',    icon: <Clock className="w-3 h-3" /> },
};

const MERGE_TAG_OPTIONS: MergeTag[] = [
  { tag: '{{client_name}}',      label: 'Client Name',        source_field: 'contact_name'       },
  { tag: '{{client_phone}}',     label: 'Client Phone',       source_field: 'contact_phone'      },
  { tag: '{{client_email}}',     label: 'Client Email',       source_field: 'contact_email'      },
  { tag: '{{property_address}}', label: 'Property Address',   source_field: 'address'            },
  { tag: '{{claim_number}}',     label: 'Claim Number',       source_field: 'claim_number'       },
  { tag: '{{insurance_company}}',label: 'Insurance Company',  source_field: 'insurance_company'  },
  { tag: '{{adjuster_name}}',    label: 'Adjuster Name',      source_field: 'adjuster_name'      },
  { tag: '{{adjuster_phone}}',   label: 'Adjuster Phone',     source_field: 'adjuster_phone'     },
  { tag: '{{date_of_loss}}',     label: 'Date of Loss',       source_field: 'date_of_loss'       },
  { tag: '{{company_name}}',     label: 'Company Name',       source_field: 'company_name'       },
  { tag: '{{today_date}}',       label: 'Today\'s Date',      source_field: '__today'            },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function mergeTags(text: string, job: JobData): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return text
    .replace(/\{\{client_name\}\}/g,       job.contact_name        || '')
    .replace(/\{\{client_phone\}\}/g,      job.contact_phone       || '')
    .replace(/\{\{client_email\}\}/g,      job.contact_email       || '')
    .replace(/\{\{property_address\}\}/g,  job.address             || '')
    .replace(/\{\{claim_number\}\}/g,      job.claim_number        || '')
    .replace(/\{\{insurance_company\}\}/g, job.insurance_company   || '')
    .replace(/\{\{adjuster_name\}\}/g,     job.adjuster_name       || '')
    .replace(/\{\{adjuster_phone\}\}/g,    job.adjuster_phone      || '')
    .replace(/\{\{date_of_loss\}\}/g,      job.date_of_loss        || '')
    .replace(/\{\{company_name\}\}/g,      job.company_name        || '')
    .replace(/\{\{today_date\}\}/g,        today)
    .replace(/\{\{sign_date\}\}/g,         today);
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function DocTypeBadge({ type }: { type: string }) {
  const cfg = DOC_TYPE_CONFIG[type] || DOC_TYPE_CONFIG.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  jobId: string;
  jobData: JobData;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
export default function JobDocumentsTab({ jobId, jobData }: Props) {
  // State
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userId, setUserId]       = useState<string | null>(null);

  // Send modal state
  const [sendModal, setSendModal]   = useState(false);
  const [selTemplate, setSelTemplate] = useState<Template | null>(null);
  const [sendEmail, setSendEmail]   = useState('');
  const [sendPhone, setSendPhone]   = useState('');
  const [sending, setSending]       = useState(false);
  const [sendOk, setSendOk]         = useState('');
  const [sendErr, setSendErr]       = useState('');

  // Sign-in-app modal state
  const [signModal, setSignModal]   = useState(false);
  const [signDoc, setSignDoc]       = useState<JobDocument | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning]       = useState(false);
  const [signOk, setSignOk]         = useState(false);
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [hasSig, setHasSig]         = useState(false);

  // Copy link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Load templates for this company
      const { data: tmpl } = await supabase
        .from('document_templates')
        .select('*')
        .eq('company_id', user.id)
        .eq('is_active', true)
        .order('sort_order');
      setTemplates((tmpl as Template[]) || []);

      // Load job documents
      const { data: docs } = await supabase
        .from('job_documents')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      setDocuments((docs as JobDocument[]) || []);

      setLoading(false);
    }
    load();
  }, [jobId]);

  // ── Send document ────────────────────────────────────────────────────────────
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selTemplate || !userId) return;
    setSending(true); setSendErr(''); setSendOk('');

    // Build filled data from job
    const filled: Record<string, string> = {};
    MERGE_TAG_OPTIONS.forEach(mt => {
      const val = mt.source_field === '__today'
        ? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : (jobData as unknown as Record<string,string>)[mt.source_field] || '';
      filled[mt.tag] = val;
    });

    // Render body_html with merge tags replaced
    const bodyFilled = selTemplate.body_html ? mergeTags(selTemplate.body_html, jobData) : null;

    const { data: doc, error } = await supabase
      .from('job_documents')
      .insert({
        job_id: jobId,
        template_id: selTemplate.id,
        doc_type: selTemplate.doc_type,
        name: selTemplate.name,
        status: sendEmail || sendPhone ? 'sent' : 'draft',
        filled_data: filled,
        body_html_filled: bodyFilled,
        sent_to_email: sendEmail || null,
        sent_to_phone: sendPhone || null,
        sent_at: sendEmail || sendPhone ? new Date().toISOString() : null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) { setSendErr(error.message); setSending(false); return; }

    setDocuments(prev => [doc as JobDocument, ...prev]);
    const signLink = `${window.location.origin}/sign/${doc.sign_token}`;
    setSendOk(signLink);
    setSending(false);
  }

  // ── Sign in-app (on tech's phone) ────────────────────────────────────────────
  function openSign(doc: JobDocument) {
    setSignDoc(doc);
    setSignerName(jobData.contact_name || '');
    setHasSig(false);
    setSignOk(false);
    setSignModal(true);
    setTimeout(initCanvas, 100);
  }

  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    setIsDrawing(true);
    setHasSig(true);
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  async function submitSign() {
    if (!signDoc || !hasSig || !signerName.trim()) return;
    setSigning(true);
    const canvas = canvasRef.current;
    const sigData = canvas?.toDataURL('image/png') || '';

    const { data: updated } = await supabase
      .from('job_documents')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by_name: signerName,
        signature_data: sigData,
      })
      .eq('id', signDoc.id)
      .select()
      .single();

    if (updated) {
      setDocuments(prev => prev.map(d => d.id === signDoc.id ? updated as JobDocument : d));
    }
    setSigning(false);
    setSignOk(true);
  }

  // ── Copy sign link ───────────────────────────────────────────────────────────
  function copyLink(doc: JobDocument) {
    const link = `${window.location.origin}/sign/${doc.sign_token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Delete doc ───────────────────────────────────────────────────────────────
  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('job_documents').delete().eq('id', id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Documents</h2>
          <p className="text-xs text-slate-400 mt-0.5">Auto-fill, send & collect e-signatures</p>
        </div>
        <button
          onClick={() => { setSendModal(true); setSendOk(''); setSendErr(''); setSelTemplate(null); setSendEmail(jobData.contact_email || ''); setSendPhone(jobData.contact_phone || ''); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-blue-900/30"
        >
          <FilePlus2 className="w-4 h-4" />
          Send Document
        </button>
      </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 border-dashed p-10 text-center">
          <FileSignature className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium text-sm">No documents yet</p>
          <p className="text-slate-500 text-xs mt-1 mb-4">
            Send a Work Authorization, Direction to Pay, or any other document for signature.
          </p>
          <button
            onClick={() => setSendModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> Send First Document
          </button>
        </div>
      )}

      {/* Documents list */}
      {documents.length > 0 && (
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="bg-slate-800/60 rounded-2xl border border-slate-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm truncate">{doc.name}</p>
                    <DocTypeBadge type={doc.doc_type} />
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    {doc.sent_to_email && (
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{doc.sent_to_email}</span>
                    )}
                    {doc.sent_to_phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{doc.sent_to_phone}</span>
                    )}
                    {doc.signed_at && (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Signed by {doc.signed_by_name} · {new Date(doc.signed_at).toLocaleDateString()}
                      </span>
                    )}
                    {!doc.signed_at && doc.sent_at && (
                      <span>Sent {new Date(doc.sent_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {doc.status !== 'signed' && (
                    <button
                      onClick={() => openSign(doc)}
                      title="Sign on this device"
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition"
                    >
                      <Pen className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => copyLink(doc)}
                    title="Copy sign link"
                    className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded-lg transition"
                  >
                    {copiedId === doc.id ? <CheckCircle className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    title="Delete"
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sign link (for sharing) */}
              {doc.status !== 'signed' && (
                <div className="mt-3 flex items-center gap-2 bg-slate-700/50 rounded-xl px-3 py-2">
                  <span className="text-[11px] text-slate-400 truncate flex-1 font-mono">
                    {window.location.origin}/sign/{doc.sign_token}
                  </span>
                  {doc.sent_to_phone && (
                    <a
                      href={`sms:${doc.sent_to_phone}?body=${encodeURIComponent(`Please sign your ${doc.name}: ${window.location.origin}/sign/${doc.sign_token}`)}`}
                      className="shrink-0 text-xs text-teal-400 hover:text-teal-300 font-semibold transition flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" /> SMS
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Templates note if none */}
      {templates.length === 0 && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">No document templates yet</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Go to <strong>Settings → Documents</strong> to upload your WAF, Direction to Pay, and other templates.
              Once uploaded, you can auto-fill and send them from any job.
            </p>
          </div>
        </div>
      )}

      {/* ── SEND MODAL ─────────────────────────────────────────────────────────── */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl border border-slate-700 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 rounded-t-3xl sm:rounded-t-2xl">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white">Send Document</h3>
              </div>
              <button onClick={() => setSendModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-5 space-y-5">

              {/* Template picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                  Select Template
                </label>
                {templates.length === 0 ? (
                  <div className="bg-slate-700/50 rounded-xl p-4 text-center text-sm text-slate-400">
                    No templates available. Add templates in Settings → Documents.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {templates.map(t => (
                      <button
                        key={t.id} type="button"
                        onClick={() => setSelTemplate(t)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${
                          selTemplate?.id === t.id
                            ? 'border-blue-500 bg-blue-900/30'
                            : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
                        }`}
                      >
                        <FileText className={`w-4 h-4 shrink-0 ${DOC_TYPE_CONFIG[t.doc_type]?.color || 'text-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{DOC_TYPE_CONFIG[t.doc_type]?.label || t.doc_type}</p>
                        </div>
                        {t.requires_signature && <Pen className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Auto-filled preview */}
              {selTemplate && (
                <div className="bg-slate-700/50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Auto-filled from Job</p>
                  {[
                    { label: 'Client', value: jobData.contact_name },
                    { label: 'Phone', value: jobData.contact_phone },
                    { label: 'Email', value: jobData.contact_email },
                    { label: 'Address', value: jobData.address },
                    { label: 'Claim #', value: jobData.claim_number },
                    { label: 'Insurance', value: jobData.insurance_company },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-16 shrink-0">{f.label}</span>
                      <span className="text-slate-200 font-medium">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recipient */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Send To (optional)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email" placeholder="Client email"
                    value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel" placeholder="Client phone (for SMS)"
                    value={sendPhone} onChange={e => setSendPhone(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {sendErr && (
                <div className="bg-red-900/30 border border-red-800/60 rounded-xl p-3 text-sm text-red-300">{sendErr}</div>
              )}

              {/* Success — show link */}
              {sendOk && (
                <div className="bg-green-900/30 border border-green-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold text-green-300">Document created!</span>
                  </div>
                  <p className="text-xs text-slate-400">Share this link for the client to sign:</p>
                  <div className="flex items-center gap-2 bg-slate-700/60 rounded-xl px-3 py-2">
                    <span className="text-xs text-slate-300 font-mono truncate flex-1">{sendOk}</span>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(sendOk); }}
                      className="shrink-0 text-slate-400 hover:text-white transition">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {sendPhone && (
                    <a href={`sms:${sendPhone}?body=${encodeURIComponent(`Please sign your document: ${sendOk}`)}`}
                      className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 font-semibold">
                      <Phone className="w-3.5 h-3.5" /> Send via SMS
                    </a>
                  )}
                </div>
              )}

              {!sendOk && (
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setSendModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-600 transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={!selTemplate || sending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'Sending…' : 'Create & Send'}
                  </button>
                </div>
              )}
              {sendOk && (
                <button type="button" onClick={() => { setSendModal(false); setSendOk(''); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-600 transition">
                  Done
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── SIGN MODAL ─────────────────────────────────────────────────────────── */}
      {signModal && signDoc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl border border-slate-700 w-full sm:max-w-lg">

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Pen className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white">Sign: {signDoc.name}</h3>
              </div>
              {!signOk && (
                <button onClick={() => setSignModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {signOk ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-900/40 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-white font-bold text-lg">Document Signed!</p>
                <p className="text-slate-400 text-sm">Signed by {signerName}</p>
                <button onClick={() => { setSignModal(false); setSignOk(false); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Signer name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Print Full Name *
                  </label>
                  <input
                    type="text" placeholder="Client's full name"
                    value={signerName} onChange={e => setSignerName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Signature canvas */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Draw Signature *
                    </label>
                    <button type="button" onClick={clearCanvas}
                      className="text-xs text-slate-400 hover:text-white transition">Clear</button>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-600">
                    <canvas
                      ref={canvasRef}
                      width={460} height={160}
                      className="w-full touch-none cursor-crosshair block"
                      style={{ background: '#0f172a' }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={() => setIsDrawing(false)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    By signing above, you agree to authorize the work described in this document.
                  </p>
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSignModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-600 transition">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitSign}
                    disabled={!hasSig || !signerName.trim() || signing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition"
                  >
                    {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {signing ? 'Saving…' : 'Sign Document'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
