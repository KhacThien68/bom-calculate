import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BomDetail, BomListItem } from '@/types';

export function useBomList() {
  return useQuery({
    queryKey: ['boms'] as const,
    queryFn: async () => (await api.get<BomListItem[]>('/bom')).data,
  });
}

export function useBomDetail(materialCode: string | undefined) {
  return useQuery({
    queryKey: ['bom', materialCode] as const,
    enabled: !!materialCode,
    queryFn: async () =>
      (await api.get<BomDetail>(`/bom/${materialCode}`)).data,
  });
}
