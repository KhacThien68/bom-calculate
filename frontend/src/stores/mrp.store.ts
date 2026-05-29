import { create } from 'zustand';
import type { MrpCalculateResponse } from '@/types';

interface OrderRow {
  code: string;
  name: string;
  uom: string;
  qty: number;
  commercialQty: number;
}

interface MrpStore {
  orders: OrderRow[];
  commercialOverrides: Record<string, number>;   // key = `${code}|${level}`
  result: MrpCalculateResponse | null;
  isCalculating: boolean;

  addOrder: (m: { code: string; name: string; uom: string }) => void;
  updateOrder: (index: number, patch: Partial<OrderRow>) => void;
  removeOrder: (index: number) => void;
  setCommercialOverride: (code: string, level: number, qty: number) => void;
  setResult: (r: MrpCalculateResponse | null) => void;
  setCalculating: (v: boolean) => void;
  clear: () => void;
}

export const useMrpStore = create<MrpStore>((set) => ({
  orders: [],
  commercialOverrides: {},
  result: null,
  isCalculating: false,

  addOrder: (m) => set((s) => {
    if (s.orders.some(o => o.code === m.code)) return s;
    return { orders: [...s.orders, { ...m, qty: 0, commercialQty: 0 }] };
  }),
  updateOrder: (idx, patch) => set((s) => ({
    orders: s.orders.map((o, i) => i === idx ? { ...o, ...patch } : o),
  })),
  removeOrder: (idx) => set((s) => ({ orders: s.orders.filter((_, i) => i !== idx) })),
  setCommercialOverride: (code, level, qty) => set((s) => ({
    commercialOverrides: { ...s.commercialOverrides, [`${code}|${level}`]: qty },
  })),
  setResult: (result) => set({ result }),
  setCalculating: (isCalculating) => set({ isCalculating }),
  clear: () => set({ orders: [], commercialOverrides: {}, result: null }),
}));
