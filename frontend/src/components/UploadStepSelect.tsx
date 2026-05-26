import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseBomExcel } from '@/lib/excel';
import { selectStepSchema, type SelectStepInput } from '@/schemas/upload.schema';
import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiffResponse } from '@/types';

export function UploadStepSelect() {
  const store = useUploadWizardStore();
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const {
    register, handleSubmit, setValue, watch, formState: { errors },
  } = useForm<SelectStepInput>({
    resolver: zodResolver(selectStepSchema),
    defaultValues: {
      mode: store.mode,
      materialCode: store.materialCode,
      materialDescription: store.materialDescription,
    },
  });

  const previewMut = useMutation({
    mutationFn: async (input: SelectStepInput) => {
      if (!store.file) throw new Error('NO_FILE');
      const parsed = await parseBomExcel(store.file);
      if (parsed.errors.length > 0 || !parsed.data) {
        setFileErrors(parsed.errors.map((e) => `Dòng ${e.row}: ${e.message}`));
        throw new Error('PARSE_ERROR');
      }
      if (parsed.data.materialCode !== input.materialCode) {
        setFileErrors([`Material code trong file (${parsed.data.materialCode}) khác với input (${input.materialCode})`]);
        throw new Error('CODE_MISMATCH');
      }
      store.setParsedItems(parsed.data.items);
      const { data } = await api.post<DiffResponse>('/bom/preview', {
        materialCode: input.materialCode,
        materialDescription: input.materialDescription,
        mode: input.mode,
        items: parsed.data.items,
      });
      return data;
    },
    onSuccess: (diff) => {
      store.setPreview(diff.previewToken, diff);
    },
    onError: (e: any) => {
      if (e?.message === 'NO_FILE') toast.error('Chưa chọn file');
      else if (e?.message === 'PARSE_ERROR' || e?.message === 'CODE_MISMATCH') return;
      else toast.error('Preview thất bại');
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Bước 1: Chọn chế độ & file</CardTitle></CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => {
            store.setMode(v.mode);
            store.setMaterial(v.materialCode, v.materialDescription);
            previewMut.mutate(v);
          })}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Chế độ</Label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2">
                <input type="radio" value="full" {...register('mode')} /> Upload toàn bộ
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="append" {...register('mode')} /> Thêm mới
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="materialCode">Material code</Label>
            <Input id="materialCode" {...register('materialCode')} />
            {errors.materialCode && <p className="text-sm text-destructive">{errors.materialCode.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="materialDescription">Material description</Label>
            <Input id="materialDescription" {...register('materialDescription')} />
            {errors.materialDescription && <p className="text-sm text-destructive">{errors.materialDescription.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="file">File Excel (.xlsx)</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                store.setFile(f);
                setFileErrors([]);
                if (f) {
                  parseBomExcel(f).then((res) => {
                    if (res.data) {
                      if (!watch('materialCode')) setValue('materialCode', res.data.materialCode);
                      if (!watch('materialDescription')) setValue('materialDescription', res.data.materialDescription);
                    }
                  });
                }
              }}
            />
            {store.file && <p className="text-sm text-muted-foreground">Đã chọn: {store.file.name}</p>}
          </div>
          {fileErrors.length > 0 && (
            <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-1">
              {fileErrors.map((m, i) => (
                <p key={i} className="text-sm text-destructive">{m}</p>
              ))}
            </div>
          )}
          <Button type="submit" disabled={previewMut.isPending}>
            {previewMut.isPending ? 'Đang preview…' : 'Preview'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
