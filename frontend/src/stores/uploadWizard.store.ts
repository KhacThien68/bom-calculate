import { create } from 'zustand';
import type { DiffResponse, PreviewItem } from '@/types';

export type WizardStep = 'select' | 'preview' | 'done';

interface UploadWizardState {
  step: WizardStep;
  mode: 'full' | 'append';
  materialCode: string;
  materialDescription: string;
  file: File | null;
  items: PreviewItem[];
  previewToken: string | null;
  diff: DiffResponse | null;

  setMode: (mode: 'full' | 'append') => void;
  setMaterial: (code: string, desc: string) => void;
  setFile: (file: File | null) => void;
  setParsedItems: (items: PreviewItem[]) => void;
  setPreview: (token: string, diff: DiffResponse) => void;
  goToStep: (step: WizardStep) => void;
  reset: () => void;
}

const initial = {
  step: 'select' as WizardStep,
  mode: 'full' as const,
  materialCode: '',
  materialDescription: '',
  file: null as File | null,
  items: [] as PreviewItem[],
  previewToken: null as string | null,
  diff: null as DiffResponse | null,
};

export const useUploadWizardStore = create<UploadWizardState>((set) => ({
  ...initial,
  setMode: (mode) => set({ mode }),
  setMaterial: (materialCode, materialDescription) => set({ materialCode, materialDescription }),
  setFile: (file) => set({ file }),
  setParsedItems: (items) => set({ items }),
  setPreview: (previewToken, diff) => set({ previewToken, diff, step: 'preview' }),
  goToStep: (step) => set({ step }),
  reset: () => set({ ...initial }),
}));
