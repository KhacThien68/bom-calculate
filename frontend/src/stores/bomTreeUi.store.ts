import { create } from 'zustand';

interface BomTreeUiState {
  expandedByBom: Record<string, Set<number>>;
  toggle: (materialCode: string, itemId: number) => void;
  isExpanded: (materialCode: string, itemId: number) => boolean;
  expandAll: (materialCode: string, ids: number[]) => void;
  collapseAll: (materialCode: string) => void;
  clear: () => void;
}

export const useBomTreeUiStore = create<BomTreeUiState>((set, get) => ({
  expandedByBom: {},
  toggle: (materialCode, itemId) =>
    set((s) => {
      const current = new Set(s.expandedByBom[materialCode] ?? []);
      if (current.has(itemId)) current.delete(itemId);
      else current.add(itemId);
      return { expandedByBom: { ...s.expandedByBom, [materialCode]: current } };
    }),
  isExpanded: (materialCode, itemId) =>
    get().expandedByBom[materialCode]?.has(itemId) ?? false,
  expandAll: (materialCode, ids) =>
    set((s) => ({
      expandedByBom: { ...s.expandedByBom, [materialCode]: new Set(ids) },
    })),
  collapseAll: (materialCode) =>
    set((s) => ({
      expandedByBom: { ...s.expandedByBom, [materialCode]: new Set() },
    })),
  clear: () => set({ expandedByBom: {} }),
}));
