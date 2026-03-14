'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Loader2, AlertCircle, Pen, Building2 } from 'lucide-react';

interface JobDoc {
  id: string;
  name: string;
  doc_type: string;
  status: string;
  filled_data: Record<string, string>;
  sign_token: string;
  sign_token_expires: string;
  signed_at: string | null;
  signed_by_name: string | null;
  job_id: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  waf: 'Work Authorization Form',
  direction_to_pay: 'Direction to Pay',
  assignment_of_benefits: 'Assignment of Benefits',
  certificate_of_completion: 'Certificate of Completion',
  property_access: 'Property Access Authorization',
  contents_release: 'Contents Inventory Release',
  photo_consent: 'Photo/Video Consent',
  mold_auth: 'Mold Remediation Authorization',
  scope_of_work: 'Scope of Work',
  final_report: 'Final Report',
  proof_of_loss: 'Proof of Loss',
  staff_nda: 'Staff NDA',
  subcontractor_agreement: 'Subcontractor Agreement',
  other: 'Document',
};

export default function SignPage() {
  const params = useParams();
  const token = params?.token as string;

  const [doc, setDoc] = useState<JobDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [signerName, setSignerName] = useState('');
  const [isDrawing, setIsDrawing]   = useState(false);
  const [hasSig, setHasSig]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load document by sign token ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    async function load() {
      const { data, error } = await supabase
        .from('job_documents')
        .select('*')
        .eq('sign_token', token)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const d = data as JobDoc;

      if (d.status === 'signed') { setAlreadySigned(true); setDoc(d); setLoading(false); return; }

      if (new Date(d.sign_token_expires) < new Date()) {
        setExpired(true); setLoading(false); return;
      }

      setDoc(d);
      setSignerName(d.filled_data['{{client_name}}'] || '');

      // Mark as viewed
      await supabase
        .from('job_documents')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', d.id);

      setLoading(false);
      setTimeout(initCanvas, 100);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
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

  async function submit() {
    if (!doc || !hasSig || !signerName.trim()) return;
    setSubmitting(true);
    setError('');

    const canvas = canvasRef.current;
    const sigData = canvas?.toDataURL('image/png') || '';

    const { error: err } = await supabase
      .from('job_documents')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by_name: signerName.trim(),
        signature_data: sigData,
      })
      .eq('id', doc.id);

    if (err) {
      setError('Failed to save signature. Please try again.');
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <SignLayout>
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Document Not Found</h2>
          <p className="text-gray-500 text-sm">This signing link is invalid or has been removed.</p>
        </div>
      </SignLayout>
    );
  }

  if (expired) {
    return (
      <SignLayout>
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Link Expired</h2>
          <p className="text-gray-500 text-sm">This signing link has expired. Please contact your restoration company for a new link.</p>
        </div>
      </SignLayout>
    );
  }

  if (alreadySigned && doc) {
    return (
      <SignLayout>
        <div className="text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Already Signed</h2>
          <p className="text-gray-500 text-sm">
            This document was signed by <strong>{doc.signed_by_name}</strong> on{' '}
            {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}.
          </p>
        </div>
      </SignLayout>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <SignLayout>
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Document Signed!</h2>
          <p className="text-gray-500 text-sm">
            Thank you, <strong>{signerName}</strong>. Your signature has been recorded for:
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="font-semibold text-blue-800">{doc?.name}</p>
            <p className="text-xs text-blue-600 mt-1">{DOC_TYPE_LABELS[doc?.doc_type || ''] || ''}</p>
          </div>
          <p className="text-xs text-gray-400">
            Signed on {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </SignLayout>
    );
  }

  // ── Main signing view ────────────────────────────────────────────────────────
  if (!doc) return null;

  const filledData = doc.filled_data || {};

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Brand header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">RoomLensPro</p>
            <p className="text-xs text-gray-500">Secure Document Signing</p>
          </div>
        </div>

        {/* Document card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 px-5 py-4">
            <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">
              {DOC_TYPE_LABELS[doc.doc_type] || 'Document'}
            </p>
            <h1 className="text-xl font-bold text-white mt-0.5">{doc.name}</h1>
          </div>

          <div className="p-5 space-y-3">
            {/* Auto-filled details */}
            {[
              { label: 'Client', value: filledData['{{client_name}}'] },
              { label: 'Property', value: filledData['{{property_address}}'] },
              { label: 'Claim #', value: filledData['{{claim_number}}'] },
              { label: 'Insurance', value: filledData['{{insurance_company}}'] },
              { label: 'Date of Loss', value: filledData['{{date_of_loss}}'] },
              { label: 'Company', value: filledData['{{company_name}}'] },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="flex items-center gap-3 text-sm border-b border-gray-100 pb-2 last:border-0">
                <span className="text-gray-400 w-24 shrink-0">{f.label}</span>
                <span className="font-medium text-gray-800">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Authorization text */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Important Notice</p>
          <p className="text-xs leading-relaxed">
            By signing below, you authorize the work described above to be performed on your property.
            You confirm that all information provided is accurate to the best of your knowledge.
            This signature is legally binding.
          </p>
        </div>

        {/* Signing form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Pen className="w-4 h-4 text-blue-600" /> Your Signature
          </h2>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Full Name *
            </label>
            <input
              type="text"
              placeholder="Type your full name"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-500 transition bg-gray-50"
            />
          </div>

          {/* Canvas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Draw Signature *
              </label>
              <button type="button" onClick={clearCanvas}
                className="text-xs text-gray-400 hover:text-gray-600 transition underline">
                Clear
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-white">
              <canvas
                ref={canvasRef}
                width={460} height={160}
                className="w-full touch-none cursor-crosshair block"
                style={{ background: '#fff', touchAction: 'none' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={() => setIsDrawing(false)}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Sign using your finger or mouse</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!hasSig || !signerName.trim() || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-blue-600/30"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><CheckCircle className="w-4 h-4" /> Sign Document</>
            }
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Secured by RoomLensPro · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">RoomLensPro</p>
            <p className="text-xs text-gray-500">Document Signing</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
