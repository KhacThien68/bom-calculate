import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MrpCalculateRequest, MrpCalculateResponse } from '@/types';

export function useMrpCalculate() {
  return useMutation({
    mutationFn: async (payload: MrpCalculateRequest) =>
      (await api.post<MrpCalculateResponse>('/mrp/calculate', payload)).data,
  });
}
