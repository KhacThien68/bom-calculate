import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DiffItem } from '@/types';

const statusVariant: Record<DiffItem['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'default',
  changed: 'secondary',
  unchanged: 'outline',
  removed: 'destructive',
};

const statusLabel: Record<DiffItem['status'], string> = {
  new: 'Mới',
  changed: 'Thay đổi',
  unchanged: 'Giữ nguyên',
  removed: 'Bị xoá',
};

export function UploadStepPreview() {
  const store = useUploadWizardStore();
  const diff = store.diff!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<DiffItem['status'] | 'all'>('all');

  const commitMut = useMutation({
    mutationFn: async () => {
      await api.post('/bom/commit', { previewToken: store.previewToken });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom', store.materialCode] });
      toast.success('Lưu BOM thành công');
      const code = store.materialCode;
      store.reset();
      navigate(`/bom/${code}`);
    },
    onError: (e: any) => {
      if (e?.response?.status === 404) toast.error('Preview đã hết hạn, vui lòng preview lại');
      else toast.error('Commit thất bại');
    },
  });

  const filtered = filter === 'all' ? diff.items : diff.items.filter((i) => i.status === filter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Bước 2: Xem diff</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'new', 'changed', 'unchanged', 'removed'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? 'default' : 'outline'}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? `Tất cả (${diff.items.length})` :
                  `${statusLabel[s]} (${diff.summary[s]})`}
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đường dẫn → Code</TableHead>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead>Old (nếu changed)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant={statusVariant[it.status]}>{statusLabel[it.status]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">
                    {[...it.parentPath, it.componentCode].join(' / ')}
                  </TableCell>
                  <TableCell>{it.componentName}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell>{it.uom}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {it.oldValues ? `${it.oldValues.componentName} · ${it.oldValues.quantity} ${it.oldValues.uom}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
          {commitMut.isPending ? 'Đang lưu…' : 'Confirm & Lưu'}
        </Button>
        <Button variant="outline" onClick={() => store.goToStep('select')}>Quay lại</Button>
        <Button variant="ghost" onClick={() => store.reset()}>Huỷ</Button>
      </div>
    </div>
  );
}
