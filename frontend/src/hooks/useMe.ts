import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Me } from '@/types';

export function useMe() {
  return useQuery({
    queryKey: ['me'] as const,
    queryFn: async (): Promise<Me | null> => {
      try {
        const { data } = await api.get<Me>('/auth/me');
        return data;
      } catch {
        return null;
      }
    },
  });
}
