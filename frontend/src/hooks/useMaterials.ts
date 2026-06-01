import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Material, MaterialListResponse, MaterialDiffResponse } from '@/types';
import type { MaterialFormValues } from '@/schemas/material.schema';
import type { MaterialRow } from '@/lib/excel';

export function useMaterialList(q?: string) {
  return useQuery({
    queryKey: ['materials', { q }] as const,
    queryFn: async () => (await api.get<MaterialListResponse>('/materials', { params: { q } })).data,
  });
}

export function useMaterialSearch(q: string) {
  return useQuery({
    queryKey: ['materials-search', q] as const,
    enabled: q.trim().length > 0,
    queryFn: async () => (await api.get<Material[]>('/materials/search', { params: { q, limit: 20 } })).data,
  });
}

export function useMaterial(id: number | undefined) {
  return useQuery({
    queryKey: ['material', id] as const,
    enabled: !!id,
    queryFn: async () => (await api.get<Material>(`/materials/${id}`)).data,
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: MaterialFormValues) =>
      (await api.post<Material>('/materials', values)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function useUpdateMaterial(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<MaterialFormValues>) =>
      (await api.patch<Material>(`/materials/${id}`, values)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      qc.invalidateQueries({ queryKey: ['material', id] });
    },
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/materials/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function usePreviewMaterials() {
  return useMutation({
    mutationFn: async (payload: { mode: 'full' | 'append'; items: MaterialRow[] }) =>
      (await api.post<MaterialDiffResponse>('/materials/preview', payload)).data,
  });
}

export function useCommitMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (previewToken: string) =>
      (await api.post<{ ok: true }>('/materials/commit', { previewToken })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}
