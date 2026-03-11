'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CarrierChecklistItem, CarrierJobFile, CarrierProfile, CarrierSLATimer, CarrierSlug } from '@/types/carriers';
import { getCarrierConfig } from '@/config/carriers';

export function useCarrierMode(jobId: string, carrierSlug: CarrierSlug | null) {
  const [carrier, setCarrier]             = useState<CarrierProfile | null>(null);
  const [checklist, setChecklist]         = useState<CarrierChecklistItem[]>([]);
  const [slaTimers, setSlaTimers]         = useState<CarrierSLATimer[]>([]);
  const [carrierFiles, setCarrierFiles]   = useState<CarrierJobFile[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const channelRef                        = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadChecklist = useCallback(async (jId: string, slug: CarrierSlug) => {
    setIsLoading(true);
    setError(null);
    try {
      const [checklistRes, timersRes, filesRes] = await Promise.all([
        supabase.from('carrier_checklist_templates').select('*').eq('carrier_slug', slug).order('sort_order'),
        supabase.from('carrier_sla_timers').select('*').eq('job_id', jId).eq('carrier_slug', slug),
        supabase.from('carrier_job_files').select('*').eq('job_id', jId).eq('carrier_slug', slug),
      ]);
      const now = Date.now();
      const timers: CarrierSLATimer[] = (timersRes.data ?? []).map((t: CarrierSLATimer) => {
        const minsLeft = Math.floor((new Date(t.deadline_at).getTime() - now) / 60000);
        return {
          ...t,
          minutes_remaining: minsLeft,
          hours_remaining: Math.floor(minsLeft / 60),
          is_critical: minsLeft < 60,
          is_warning: minsLeft < 240,
          status: minsLeft < 0 && t.status === 'pending' ? 'overdue' : t.status,
        };
      });
      setChecklist(checklistRes.data ?? []);
      setSlaTimers(timers);
      setCarrierFiles(filesRes.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobId || !carrierSlug) return;
    setCarrier(getCarrierConfig(carrierSlug));
    loadChecklist(jobId, carrierSlug);

    channelRef.current = supabase
      .channel(`carrier-sla-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'carrier_sla_timers',
        filter: `job_id=eq.${jobId}`,
      }, () => loadChecklist(jobId, carrierSlug))
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
      setCarrier(null);
      setChecklist([]);
      setSlaTimers([]);
      setCarrierFiles([]);
    };
  }, [jobId, carrierSlug, loadChecklist]);

  // ── Computed values ──────────────────────────────────────────────────────
  const requiredItems  = checklist.filter(i => i.is_required);
  const completedItems = requiredItems.filter(i => i.completed);
  const completionPct  = requiredItems.length ? Math.round((completedItems.length / requiredItems.length) * 100) : 0;
  const overdueTimers  = slaTimers.filter(t => t.status === 'overdue');
  const blockedItems   = checklist.filter(i => i.blocking && !i.completed);

  // ── Actions ──────────────────────────────────────────────────────────────
  const markItemComplete = (itemId: string) => {
    setChecklist(prev =>
      prev.map(item => item.id === itemId ? { ...item, completed: true, completed_at: new Date().toISOString() } : item)
    );
  };

  const updateTimer = async (timerId: string, status: CarrierSLATimer['status']) => {
    await supabase.from('carrier_sla_timers')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', timerId);
    setSlaTimers(prev => prev.map(t => t.id === timerId ? { ...t, status } : t));
  };

  const uploadFile = async (jId: string, category: string, file: File) => {
    const path = `carrier-files/${jId}/${category}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    if (uploadError) { setError(uploadError.message); return; }
    await supabase.from('carrier_job_files').upsert({
      job_id: jId, carrier_slug: carrierSlug,
      file_category: category, file_name: file.name, storage_path: path,
      upload_status: 'uploaded', uploaded_at: new Date().toISOString(),
    });
    if (carrierSlug) {
      const { data } = await supabase.from('carrier_job_files').select('*').eq('job_id', jId).eq('carrier_slug', carrierSlug);
      if (data) setCarrierFiles(data);
    }
  };

  return {
    carrier,
    checklist,
    slaTimers,
    carrierFiles,
    isLoading,
    error,
    completionPct,
    overdueTimers,
    blockedItems,
    canProceed: blockedItems.length === 0,
    markItemComplete,
    updateTimer,
    uploadFile,
  };
}
