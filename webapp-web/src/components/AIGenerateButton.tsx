'use client';
import { useState } from 'react';
import { Sparkles, Loader2, Copy, CheckCircle, RefreshCw, X } from 'lucide-react';

interface AIGenerateButtonProps {
  label?: string;
  loadingLabel?: string;
  onGenerate: () => Promise<string>;
  onAccept?: (result: string) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

export default function AIGenerateButton({
  label = 'Generate with AI',
  loadingLabel = 'Generating...',
  onGenerate,
  onAccept,
  placeholder = 'AI-generated content will appear here...',
  compact = false,
  className = '',
}: AIGenerateButtonProps) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState('');
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState(false);

  const run = async () => {
    setLoading(true); setError(''); setResult('');
    try {
      const text = await onGenerate();
      setResult(text);
    } catch (e: any) {
      setError(e.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accept = () => {
    if (onAccept) { onAccept(result); setResult(''); }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={`flex items-center gap-2 font-semibold transition rounded-lg ${
          compact
            ? 'text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30'
            : 'text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white'
        }`}
      >
        {loading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{loadingLabel}</>
          : <><Sparkles className="w-3.5 h-3.5" />{label}</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/30 text-red-300 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
          <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-violet-900/20 border border-violet-600/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-violet-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Generated
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={run} className="text-slate-400 hover:text-white transition p-1 rounded" title="Regenerate">
                <RefreshCw className="w-3 h-3" />
              </button>
              <button onClick={copy} className="text-slate-400 hover:text-violet-300 transition p-1 rounded" title="Copy">
                {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <button onClick={() => setResult('')} className="text-slate-400 hover:text-white transition p-1 rounded" title="Dismiss">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
          {onAccept && (
            <button
              onClick={accept}
              className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Use This
            </button>
          )}
        </div>
      )}
    </div>
  );
}
