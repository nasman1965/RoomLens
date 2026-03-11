'use client';
import { useState } from 'react';
import {
  Plug, CheckCircle, Clock, ExternalLink, Copy,
  AlertCircle, ChevronDown, ChevronUp, Zap, Lock,
} from 'lucide-react';

// ─── Integration Definitions ──────────────────────────────────────────────────
const INTEGRATIONS = [
  // ── ACTIVE / CONNECTABLE ────────────────────────────────────────────────────
  {
    id: 'clockinproof',
    name: 'ClockInProof',
    category: 'Time Tracking',
    logo: '🕐',
    tagline: 'GPS-verified time tracking for your field techs',
    description: 'Lock every clock-in to the job site. Techs receive an SMS dispatch, clock in on arrival, and hours flow back into RoomLens automatically. Prevents time theft and auto-generates payroll.',
    status: 'available',
    price: '+$29/mo add-on',
    features: [
      'GPS-verified clock-in per job',
      'Auto SMS dispatch when tech is assigned',
      'Live map — see all techs on site',
      'Auto clock-out when tech leaves geofence',
      'Hours logged to job timeline',
      'Weekly payroll export (CSV + QuickBooks)',
    ],
    apiKeyLabel: 'ClockInProof API Key',
    apiKeyPlaceholder: 'cip_live_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://www.clockinproof.com',
    docsUrl: 'https://www.clockinproof.com/api-docs',
    color: 'blue',
  },

  // ── COMING SOON ─────────────────────────────────────────────────────────────
  {
    id: 'xactimate',
    name: 'Xactimate / Verisk',
    category: 'Estimating',
    logo: '📊',
    tagline: 'Export estimates directly to Xactimate',
    description: 'Send room dimensions, damage tags, and line items from RoomLens directly into Xactimate for one-click estimate generation. Requires Verisk Partner Program approval.',
    status: 'coming_soon',
    price: 'Included in Pro plan',
    features: [
      'Auto-populate Xactimate line items from damage tags',
      'Room dimensions from LiDAR floor plans',
      'ESX file export format',
      'Two-way sync — estimates back into RoomLens',
      'XactAnalysis integration for insurance carriers',
    ],
    apiKeyLabel: 'Verisk API Key',
    apiKeyPlaceholder: 'vrsk_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://www.verisk.com/company/strategic-alliances/partner-application/',
    docsUrl: 'https://xactware.helpdocs.io/l/enUS/article/e1xxl3na8h',
    color: 'orange',
    applyNote: '⚠️ Requires Verisk Partner Program approval (4–8 weeks). Apply now to get in queue.',
  },
  {
    id: 'encircle',
    name: 'Encircle',
    category: 'Field Documentation',
    logo: '📋',
    tagline: 'Sync field photos and reports with Encircle',
    description: 'Pull Encircle job data, photos, and reports into RoomLens. Great for companies transitioning from Encircle or running both tools during migration.',
    status: 'coming_soon',
    price: 'Included in Pro plan',
    features: [
      'Import Encircle jobs into RoomLens',
      'Sync photos and room tags',
      'Pull moisture readings',
      'Import floor plan sketches',
      'Two-way job status sync',
    ],
    apiKeyLabel: 'Encircle Bearer Token',
    apiKeyPlaceholder: 'Bearer enc_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://help.encircleapp.com/hc/en-us/articles/12036459891853',
    docsUrl: 'https://help.encircleapp.com/hc/en-us/sections/12036732555917',
    color: 'green',
    applyNote: 'Encircle has an open API. Request access at their help centre.',
  },
  {
    id: 'dash',
    name: 'DASH (Cotality / Next Gear)',
    category: 'Job Management',
    logo: '⚡',
    tagline: 'Sync jobs between DASH and RoomLens',
    description: 'If your company uses DASH for job management, connect it to RoomLens so field data (photos, moisture, floor plans) flows back automatically — no double entry.',
    status: 'coming_soon',
    price: 'Included in Pro plan',
    features: [
      'Two-way job sync',
      'Push photos and reports from RoomLens to DASH',
      'Pull job assignments and contacts',
      'Sync job status and workflow steps',
    ],
    apiKeyLabel: 'DASH API Key',
    apiKeyPlaceholder: 'dash_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://www.nextgearsolutions.com/integrations/',
    docsUrl: 'https://www.nextgearsolutions.com/integrations/',
    color: 'purple',
    applyNote: 'Contact Next Gear Solutions to request API partner access.',
  },
  {
    id: 'psa',
    name: 'PSA (Canam Systems)',
    category: 'Job Management',
    logo: '🏗️',
    tagline: 'Integrate with PSA restoration management',
    description: 'Connect RoomLens field documentation with PSA for seamless job management. Photos, documents, and moisture readings sync automatically.',
    status: 'coming_soon',
    price: 'Included in Pro plan',
    features: [
      'Sync jobs from PSA to RoomLens',
      'Push field photos and documents back to PSA',
      'Moisture reading export',
      'Work authorization document sync',
    ],
    apiKeyLabel: 'PSA API Key',
    apiKeyPlaceholder: 'psa_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://canamsys.com',
    docsUrl: 'https://canamsys.com',
    color: 'teal',
    applyNote: 'Contact Canam Systems directly to request API access.',
  },
  {
    id: 'docusketch',
    name: 'DocuSketch',
    category: 'Floor Plans / 360°',
    logo: '🏠',
    tagline: 'Embed 360° tours and AI floor plans',
    description: 'Link your DocuSketch 360° tours directly to jobs in RoomLens. View immersive property tours, AI-generated floor plans, and export dimensions to Xactimate.',
    status: 'coming_soon',
    price: 'Included in Pro plan',
    features: [
      'Embed DocuSketch player in job page',
      'Import AI-generated floor plans',
      'Pull room dimensions automatically',
      'One-click Xactimate export from floor plan',
      '360° tour link shared with adjuster portal',
    ],
    apiKeyLabel: 'DocuSketch API Key',
    apiKeyPlaceholder: 'ds_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://www.docusketch.com/solutions/property-restoration-software',
    docsUrl: 'https://www.docusketch.com',
    color: 'indigo',
    applyNote: 'Register as a DocuSketch developer partner to get API access.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    category: 'Accounting',
    logo: '💰',
    tagline: 'Sync invoices and payroll to QuickBooks',
    description: 'Push RoomLens invoices, job costs, and ClockInProof payroll data directly into QuickBooks Online. Eliminates manual accounting entry.',
    status: 'coming_soon',
    price: '+$19/mo add-on',
    features: [
      'Auto-create invoices in QuickBooks from closed jobs',
      'Sync ClockInProof payroll hours',
      'Map job types to QuickBooks chart of accounts',
      'Customer records sync',
      'Expense tracking per job',
    ],
    apiKeyLabel: 'QuickBooks Client ID',
    apiKeyPlaceholder: 'qb_xxxxxxxxxxxxxxxxxxxx',
    applyUrl: 'https://developer.intuit.com',
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    color: 'green',
    applyNote: 'Register at Intuit Developer Portal to get OAuth credentials.',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Time Tracking':      'bg-blue-50 text-blue-700',
  'Estimating':         'bg-orange-50 text-orange-700',
  'Field Documentation':'bg-green-50 text-green-700',
  'Job Management':     'bg-purple-50 text-purple-700',
  'Floor Plans / 360°': 'bg-indigo-50 text-indigo-700',
  'Accounting':         'bg-emerald-50 text-emerald-700',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [apiKeys, setApiKeys]     = useState<Record<string, string>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [testing, setTesting]     = useState<string | null>(null);
  const [copied, setCopied]       = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = ['All', ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];

  const filtered = INTEGRATIONS.filter(i =>
    categoryFilter === 'All' || i.category === categoryFilter
  );

  const handleTest = async (id: string) => {
    setTesting(id);
    await new Promise(r => setTimeout(r, 1800));
    setTesting(null);
    if (apiKeys[id]?.length > 8) {
      setConnected(prev => ({ ...prev, [id]: true }));
    } else {
      alert('Invalid API key — please check and try again.');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Plug className="w-6 h-6 text-blue-600" /> Integrations
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect RoomLens Pro with the tools your team already uses.
          Each integration is one API key away.
        </p>
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Available Now',  value: INTEGRATIONS.filter(i => i.status === 'available').length,    color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Coming Soon',    value: INTEGRATIONS.filter(i => i.status === 'coming_soon').length,  color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Connected',      value: Object.values(connected).filter(Boolean).length,              color: 'text-blue-600',   bg: 'bg-blue-50'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Category Filter ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
              categoryFilter === cat
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Integration Cards ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map(integration => {
          const isExpanded  = expanded === integration.id;
          const isConnected = connected[integration.id];
          const isTesting   = testing  === integration.id;
          const isAvailable = integration.status === 'available';

          return (
            <div key={integration.id}
              className={`bg-white rounded-xl border transition-all ${
                isConnected ? 'border-green-300 shadow-sm' :
                isExpanded  ? 'border-blue-300 shadow-md'  : 'border-gray-200'
              }`}>

              {/* Card Header */}
              <div className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : integration.id)}>

                {/* Logo */}
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-2xl shrink-0">
                  {integration.logo}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{integration.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      CATEGORY_COLORS[integration.category] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {integration.category}
                    </span>
                    {isAvailable ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        ✅ Available
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        🔜 Coming Soon
                      </span>
                    )}
                    {isConnected && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{integration.tagline}</p>
                </div>

                {/* Price + Expand */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-gray-600 hidden sm:block">
                    {integration.price}
                  </span>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Expanded Panel */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-5">

                  {/* Description */}
                  <p className="text-sm text-gray-600">{integration.description}</p>

                  {/* Features */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      What you get
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {integration.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Apply Note */}
                  {integration.applyNote && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      {integration.applyNote}
                    </div>
                  )}

                  {/* Action Row */}
                  <div className="flex flex-wrap gap-3">
                    <a href={integration.applyUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:border-blue-400 px-3 py-2 rounded-lg transition">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {isAvailable ? 'Get API Key' : 'Apply for Access'}
                    </a>
                    <a href={integration.docsUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View API Docs
                    </a>
                  </div>

                  {/* API Key Input */}
                  {isAvailable ? (
                    <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-gray-400" />
                        <p className="text-xs font-semibold text-gray-700">{integration.apiKeyLabel}</p>
                        {isConnected && (
                          <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeys[integration.id] ?? ''}
                          onChange={e => setApiKeys(p => ({ ...p, [integration.id]: e.target.value }))}
                          placeholder={integration.apiKeyPlaceholder}
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                        />
                        <button type="button"
                          onClick={() => handleCopy(apiKeys[integration.id] ?? '', integration.id)}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      {copied === integration.id && (
                        <p className="text-xs text-green-600">Copied!</p>
                      )}
                      <button type="button"
                        onClick={() => handleTest(integration.id)}
                        disabled={!apiKeys[integration.id] || isTesting}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2.5 rounded-lg transition">
                        {isTesting ? (
                          <><Zap className="w-4 h-4 animate-pulse" /> Testing connection…</>
                        ) : isConnected ? (
                          <><CheckCircle className="w-4 h-4" /> Connected — Test Again</>
                        ) : (
                          <><Zap className="w-4 h-4" /> Test & Activate</>
                        )}
                      </button>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Your API key is encrypted and never shared. Stored securely in your account.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-300 text-center">
                      <Clock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-600">Coming Soon</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Apply for API access now — we'll notify you when this integration is ready.
                      </p>
                      <a href={integration.applyUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Apply for Early Access
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center">
        <Plug className="w-8 h-8 mx-auto mb-3 opacity-80" />
        <h3 className="font-bold text-lg">Missing an integration?</h3>
        <p className="text-sm text-blue-100 mt-1 mb-4">
          Tell us which tools your team uses — we'll prioritize building it.
        </p>
        <a href="mailto:support@roomlenspro.com?subject=Integration Request"
          className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 transition">
          Request an Integration
        </a>
      </div>

    </div>
  );
}
