import { create } from 'zustand';
import type { MaterialRow } from '@/lib/excel';
import type { MaterialDiffResponse } from '@/types';

type Step = 'select' | 'preview' | 'done';

interface MaterialUploadStore {
  step: Step;
  mode: 'full' | 'append';
  rows: MaterialRow[];
  diff: MaterialDiffResponse | null;

  setMode: (m: 'full' | 'append') => void;
  setRows: (rows: MaterialRow[]) => void;
  setDiff: (d: MaterialDiffResponse) => void;
  reset: () => void;
  goPreview: () => void;
  goDone: () => void;
}

export const useMaterialUploadStore = create<MaterialUploadStore>((set) => ({
  step: 'select',
  mode: 'append',
  rows: [],
  diff: null,
  setMode: (mode) => set({ mode }),
  setRows: (rows) => set({ rows }),
  setDiff: (diff) => set({ diff }),
  goPreview: () => set({ step: 'preview' }),
  goDone: () => set({ step: 'done' }),
  reset: () => set({ step: 'select', mode: 'append', rows: [], diff: null }),
}));
