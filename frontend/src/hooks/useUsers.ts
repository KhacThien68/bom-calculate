import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserListRow {
  id: number;
  username: string;
  name: string | null;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  updatedAt: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'] as const,
    queryFn: async () => (await api.get<UserListRow[]>('/users')).data,
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<{ ok: true; defaultPassword: string }>(`/users/${id}/reset-password`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
