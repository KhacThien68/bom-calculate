import { create } from 'zustand';
import type { DiffResponse, PreviewItem } from '@/types';

export type WizardStep = 'select' | 'preview' | 'done';

export interface BomDraft {
  materialCode: string;
  materialDescription: string;
  items: PreviewItem[];
  previewToken: string | null;
  diff: DiffResponse | null;
  previewError: string | null;
  committed: boolean;
  commitError: string | null;
}

interface UploadWizardState {
  step: WizardStep;
  mode: 'full' | 'append';
  file: File | null;
  drafts: BomDraft[];

  setMode: (mode: 'full' | 'append') => void;
  setFile: (file: File | null) => void;
  setDrafts: (drafts: BomDraft[]) => void;
  updateDraft: (materialCode: string, patch: Partial<BomDraft>) => void;
  goToStep: (step: WizardStep) => void;
  reset: () => void;
}

const initial = {
  step: 'select' as WizardStep,
  mode: 'full' as const,
  file: null as File | null,
  drafts: [] as BomDraft[],
};

export const useUploadWizardStore = create<UploadWizardState>((set) => ({
  ...initial,
  setMode: (mode) => set({ mode }),
  setFile: (file) => set({ file }),
  setDrafts: (drafts) => set({ drafts }),
  updateDraft: (materialCode, patch) =>
    set((s) => ({
      drafts: s.drafts.map((d) => (d.materialCode === materialCode ? { ...d, ...patch } : d)),
    })),
  goToStep: (step) => set({ step }),
  reset: () => set({ ...initial }),
}));

export function makeDraft(
  materialCode: string,
  materialDescription: string,
  items: PreviewItem[],
): BomDraft {
  return {
    materialCode,
    materialDescription,
    items,
    previewToken: null,
    diff: null,
    previewError: null,
    committed: false,
    commitError: null,
  };
}
