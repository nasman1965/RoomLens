// ─────────────────────────────────────────────────────────────────────────────
// Zustand stores — Firebase edition
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { User, Job, CameraState } from '../types';
import { authService } from '../services/auth';

// ─── Auth Store ───────────────────────────────────────────────────────────────
interface AuthStore {
  user:       User | null;
  loading:    boolean;
  setUser:    (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut:    () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:       null,
  loading:    true,
  setUser:    (user)    => set({ user }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    await authService.signOut();
    set({ user: null });
  },
}));

// ─── Jobs Store ───────────────────────────────────────────────────────────────
interface JobsStore {
  jobs:         Job[];
  activeJob:    Job | null;
  loading:      boolean;
  setJobs:      (jobs: Job[]) => void;
  setActiveJob: (job: Job | null) => void;
  addJob:       (job: Job) => void;
  updateJob:    (id: string, updates: Partial<Job>) => void;
  removeJob:    (id: string) => void;
  setLoading:   (loading: boolean) => void;
}

export const useJobsStore = create<JobsStore>((set) => ({
  jobs:         [],
  activeJob:    null,
  loading:      false,
  setJobs:      (jobs)      => set({ jobs }),
  setActiveJob: (activeJob) => set({ activeJob }),
  addJob:       (job)       => set((s) => ({ jobs: [job, ...s.jobs] })),
  updateJob:    (id, updates) =>
    set((s) => ({
      jobs:      s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
      activeJob: s.activeJob?.id === id ? { ...s.activeJob, ...updates } : s.activeJob,
    })),
  removeJob: (id) =>
    set((s) => ({
      jobs:      s.jobs.filter((j) => j.id !== id),
      activeJob: s.activeJob?.id === id ? null : s.activeJob,
    })),
  setLoading: (loading) => set({ loading }),
}));

// ─── Camera Store ─────────────────────────────────────────────────────────────
interface CameraStore {
  camera:          CameraState;
  capturedPhotos:  string[];  // local file URIs
  setCamera:       (state: Partial<CameraState>) => void;
  addCapturedPhoto:(uri: string) => void;
  clearPhotos:     () => void;
  resetCamera:     () => void;
}

const defaultCamera: CameraState = {
  connected:   false,
  cameraType:  'manual',
  ip:          '192.168.42.1',
};

export const useCameraStore = create<CameraStore>((set) => ({
  camera:         defaultCamera,
  capturedPhotos: [],
  setCamera:       (state) => set((s) => ({ camera: { ...s.camera, ...state } })),
  addCapturedPhoto:(uri)   => set((s) => ({ capturedPhotos: [...s.capturedPhotos, uri] })),
  clearPhotos:     ()      => set({ capturedPhotos: [] }),
  resetCamera:     ()      => set({ camera: defaultCamera, capturedPhotos: [] }),
}));

// ─── UI Store ─────────────────────────────────────────────────────────────────
interface UIStore {
  toastMessage: string | null;
  toastType:    'success' | 'error' | 'info' | null;
  showToast:    (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast:    () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  toastMessage: null,
  toastType:    null,
  showToast: (message, type = 'info') => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => set({ toastMessage: null, toastType: null }), 3000);
  },
  hideToast: () => set({ toastMessage: null, toastType: null }),
}));
