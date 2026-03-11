import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  CarrierProfile, CarrierChecklistItem, CarrierSLATimer,
  CarrierJobFile, CarrierSlug, SLATimerStatus,
} from '@/types/carriers';
import { getCarrierConfig } from '@/config/carriers';

interface CarrierModeStore {
  selectedCarrier: CarrierProfile | null;
  checklistItems:  CarrierChecklistItem[];
  slaTimers:       CarrierSLATimer[];
  carrierFiles:    CarrierJobFile[];
  isLoading:       boolean;
  error:           string | null;
  // Computed
  completionPercentage: () => number;
  overdueTimers:        () => CarrierSLATimer[];
  blockedItems:         () => CarrierChecklistItem[];
  canProceed:           () => boolean;
  // Actions
  selectCarrier:    (slug: CarrierSlug) => Promise<void>;
  loadChecklist:    (jobId: string, slug: CarrierSlug) => Promise<void>;
  markItemComplete: (itemId: string) => void;
  updateTimer:      (timerId: string, status: SLATimerStatus) => Promise<void>;
  uploadFile:       (jobId: string, category: string, file: File) => Promise<void>;
  resetCarrierMode: () => void;
}

export const useCarrierModeStore = create<CarrierModeStore>((set, get) => ({
  selectedCarrier: null,
  checklistItems:  [],
  slaTimers:       [],
  carrierFiles:    [],
  isLoading:       false,
  error:           null,

  completionPercentage: () => {
    const items = get().checklistItems.filter(i => i.is_required);
    if (!items.length) return 0;
    return Math.round((items.filter(i => i.completed).length / items.length) * 100);
  },
  overdueTimers: () => get().slaTimers.filter(t => t.status === 'overdue'),
  blockedItems:  () => get().checklistItems.filter(i => i.blocking && !i.completed),
  canProceed:    () => get().checklistItems.filter(i => i.blocking && !i.completed).length === 0,

  selectCarrier: async (slug) => {
    set({ selectedCarrier: getCarrierConfig(slug), error: null });
  },

  loadChecklist: async (jobId, slug) => {
    set({ isLoading: true, error: null });
    try {
      const [checklistRes, timersRes, filesRes] = await Promise.all([
        supabase.from('carrier_checklist_templates').select('*').eq('carrier_slug', slug).order('sort_order'),
        supabase.from('carrier_sla_timers').select('*').eq('job_id', jobId).eq('carrier_slug', slug),
        supabase.from('carrier_job_files').select('*').eq('job_id', jobId).eq('carrier_slug', slug),
      ]);
      const now = Date.now();
      const timers = (timersRes.data ?? []).map(t => {
        const minsLeft = Math.floor((new Date(t.deadline_at).getTime() - now) / 60000);
        return { ...t, minutes_remaining: minsLeft, hours_remaining: Math.floor(minsLeft / 60), is_critical: minsLeft < 60, is_warning: minsLeft < 240 };
      });
      set({ checklistItems: checklistRes.data ?? [], slaTimers: timers, carrierFiles: filesRes.data ?? [], isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Load failed', isLoading: false });
    }
  },

  markItemComplete: (itemId) => {
    set(state => ({
      checklistItems: state.checklistItems.map(item =>
        item.id === itemId ? { ...item, completed: true, completed_at: new Date().toISOString() } : item
      ),
    }));
  },

  updateTimer: async (timerId, status) => {
    await supabase.from('carrier_sla_timers')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', timerId);
    set(state => ({ slaTimers: state.slaTimers.map(t => t.id === timerId ? { ...t, status } : t) }));
  },

  uploadFile: async (jobId, category, file) => {
    const path = `carrier-files/${jobId}/${category}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    if (uploadError) { set({ error: uploadError.message }); return; }
    await supabase.from('carrier_job_files').upsert({
      job_id: jobId, carrier_slug: get().selectedCarrier?.carrier_slug,
      file_category: category, file_name: file.name, storage_path: path,
      upload_status: 'uploaded', uploaded_at: new Date().toISOString(),
    });
    const { data } = await supabase.from('carrier_job_files').select('*').eq('job_id', jobId);
    if (data) set({ carrierFiles: data });
  },

  resetCarrierMode: () => set({ selectedCarrier: null, checklistItems: [], slaTimers: [], carrierFiles: [], isLoading: false, error: null }),
}));
