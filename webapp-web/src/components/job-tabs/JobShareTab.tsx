'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Share2, Link, Copy, Check, Plus, Trash2, Loader2, ExternalLink, Eye, Users, UserCheck } from 'lucide-react';

interface ShareLink {
  id: string; token: string; label: string;
  expires_at: string | null; access_count: number; last_accessed: string | null; created_at: string;
}

interface TeamMember {
  id: string; full_name: string; role: string; email: string | null; cell_phone: string | null;
}

export default function JobShareTab({ jobId, userId }: { jobId: string; userId: string }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('Adjuster Link');
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://roomlenspro.com';

  useEffect(() => { load(); }, [jobId]);

  const load = async () => {
    setLoading(true);
    const [linksRes, membersRes] = await Promise.all([
      supabase.from('job_share_links').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
      supabase.from('team_members').select('id, full_name, role, email, cell_phone').eq('is_active', true).order('full_name'),
    ]);
    setLinks(linksRes.data || []);
    setMembers(membersRes.data || []);
    setLoading(false);
  };

  const createLink = async () => {
    setCreating(true); setError('');
    const { data, error: err } = await supabase
      .from('job_share_links')
      .insert({ job_id: jobId, user_id: userId, label: newLabel })
      .select().single();
    if (err) setError(err.message);
    else { setLinks(prev => [data, ...prev]); setShowNewForm(false); setNewLabel('Adjuster Link'); setSuccess('Share link created!'); setTimeout(() => setSuccess(''), 3000); }
    setCreating(false);
  };

  const deleteLink = async (id: string) => {
    if (!confirm('Delete this share link?')) return;
    await supabase.from('job_share_links').delete().eq('id', id);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const copyLink = async (token: string) => {
    const url = `${baseUrl}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token); setTimeout(() => setCopied(null), 2500);
  };

  const sendSMS = (member: TeamMember, token: string) => {
    const url = `${baseUrl}/share/${token}`;
    const msg = `Hi ${member.full_name.split(' ')[0]}, here is the job link: ${url}`;
    window.open(`sms:${member.cell_phone}?body=${encodeURIComponent(msg)}`);
  };

  const sendEmail = (member: TeamMember, token: string) => {
    const url = `${baseUrl}/share/${token}`;
    window.open(`mailto:${member.email}?subject=Job File - RoomLens Pro&body=Hi ${member.full_name.split(' ')[0]},%0A%0AHere is the job file link:%0A${url}%0A%0AThis link gives read-only access to the job details, photos, moisture map and floor plans.%0A%0AThank you.`);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Share Job File</h3>
          <p className="text-sm text-gray-500 mt-0.5">Create read-only links for adjusters, staff, or management</p>
        </div>
        <button onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" /> Create Link
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">{success}</div>}

      {/* New link form */}
      {showNewForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">New Share Link</h4>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Link Label</label>
              <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none"
                placeholder="e.g. Adjuster Link, TD Insurance, Field Tech" />
            </div>
            <div className="flex items-end">
              <button onClick={createLink} disabled={creating || !newLabel.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />} Generate
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {['Adjuster Link', 'TD Insurance', 'Intact Financial', 'Field Tech', 'Management'].map(preset => (
              <button key={preset} onClick={() => setNewLabel(preset)}
                className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-full hover:border-blue-400 text-gray-600 transition">
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Share links list */}
      {links.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No share links yet</p>
          <p className="text-sm text-gray-400 mt-1">Create a link to share this job with adjusters, staff or management</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const url = `${baseUrl}/share/${link.token}`;
            const isCopied = copied === link.token;
            return (
              <div key={link.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{link.label}</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Eye className="w-3 h-3" /> {link.access_count} views
                      </span>
                      {link.last_accessed && (
                        <span className="text-[10px] text-gray-400">· last {new Date(link.last_accessed).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-xs">{url}</code>
                      <button onClick={() => copyLink(link.token)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${isCopied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}>
                        {isCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-2 py-1">
                        <ExternalLink className="w-3 h-3" /> Preview
                      </a>
                    </div>
                  </div>
                  <button onClick={() => deleteLink(link.id)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Send to staff */}
                {members.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Send to staff:</p>
                    <div className="flex flex-wrap gap-2">
                      {members.slice(0, 6).map(m => (
                        <div key={m.id} className="flex items-center gap-1">
                          <span className="text-xs text-gray-600 font-medium">{m.full_name.split(' ')[0]}</span>
                          {m.cell_phone && (
                            <button onClick={() => sendSMS(m, link.token)}
                              className="text-[10px] px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded-full hover:bg-green-100 transition">
                              SMS
                            </button>
                          )}
                          {m.email && (
                            <button onClick={() => sendEmail(m, link.token)}
                              className="text-[10px] px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full hover:bg-blue-100 transition">
                              Email
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Access levels info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">What share links include</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600">
          {[
            { icon: '📋', label: 'Job overview & status' },
            { icon: '📷', label: 'All job photos' },
            { icon: '💧', label: 'Moisture map readings' },
            { icon: '📐', label: 'Floor plan scans' },
            { icon: '📊', label: 'Drying progress' },
            { icon: '🔒', label: 'Read-only, no edits' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
