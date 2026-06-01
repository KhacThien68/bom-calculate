import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseBomExcel } from '@/lib/excel';
import {
  selectStepSchema,
  type SelectStepInput,
} from '@/schemas/upload.schema';
import { makeDraft, useUploadWizardStore } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BomDraft } from '@/stores/uploadWizard.store';
import type { DiffResponse } from '@/types';

export function UploadStepSelect() {
  const store = useUploadWizardStore();
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [filePreview, setFilePreview] = useState<{
    count: number;
    codes: string[];
  } | null>(null);

  const { register, handleSubmit } = useForm<SelectStepInput>({
    resolver: zodResolver(selectStepSchema),
    defaultValues: { mode: store.mode },
  });

  const previewMut = useMutation({
    mutationFn: async (input: SelectStepInput) => {
      if (!store.file) throw new Error('NO_FILE');
      const parsed = await parseBomExcel(store.file);
      if (parsed.errors.length > 0) {
        setFileErrors(
          parsed.errors.map(
            (e) =>
              `Dòng ${e.row}${e.materialCode ? ` (BOM ${e.materialCode})` : ''}: ${e.message}`,
          ),
        );
        throw new Error('PARSE_ERROR');
      }
      if (parsed.boms.length === 0) {
        setFileErrors(['File không chứa BOM hợp lệ']);
        throw new Error('PARSE_ERROR');
      }

      const drafts: BomDraft[] = parsed.boms.map((b) =>
        makeDraft(
          b.materialCode,
          b.materialDescription,
          b.topBatchQty,
          b.items,
        ),
      );

      const results = await Promise.allSettled(
        drafts.map((d) =>
          api.post<DiffResponse>('/bom/preview', {
            materialCode: d.materialCode,
            materialDescription: d.materialDescription,
            topBatchQty: d.topBatchQty,
            mode: input.mode,
            items: d.items,
          }),
        ),
      );

      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          drafts[i].previewToken = res.value.data.previewToken;
          drafts[i].diff = res.value.data;
        } else {
          drafts[i].previewError =
            (res.reason as Error)?.message ?? 'Preview thất bại';
        }
      });

      return drafts;
    },
    onSuccess: (drafts) => {
      store.setDrafts(drafts);
      store.goToStep('preview');
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : undefined;
      if (msg === 'NO_FILE') toast.error('Chưa chọn file');
      else if (msg === 'PARSE_ERROR') return;
      else toast.error('Preview thất bại');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bước 1: Chọn chế độ & file</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => {
            store.setMode(v.mode);
            previewMut.mutate(v);
          })}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Chế độ (áp dụng cho tất cả BOM trong file)</Label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2">
                <input type="radio" value="full" {...register('mode')} /> Upload
                toàn bộ
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="append" {...register('mode')} /> Thêm
                mới
              </label>
            </div>
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
                setFilePreview(null);
                if (f) {
                  parseBomExcel(f).then((res) => {
                    setFilePreview({
                      count: res.boms.length,
                      codes: res.boms.map((b) => b.materialCode),
                    });
                    if (res.errors.length > 0) {
                      setFileErrors(
                        res.errors.map(
                          (e) =>
                            `Dòng ${e.row}${e.materialCode ? ` (BOM ${e.materialCode})` : ''}: ${e.message}`,
                        ),
                      );
                    }
                  });
                }
              }}
            />
            {store.file && (
              <p className="text-sm text-muted-foreground">
                Đã chọn: {store.file.name}
              </p>
            )}
            {filePreview && filePreview.count > 0 && (
              <p className="text-sm text-muted-foreground">
                Phát hiện {filePreview.count} BOM:{' '}
                {filePreview.codes.join(', ')}
              </p>
            )}
          </div>
          {fileErrors.length > 0 && (
            <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-1 max-h-60 overflow-auto">
              {fileErrors.map((m, i) => (
                <p key={i} className="text-sm text-destructive">
                  {m}
                </p>
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
