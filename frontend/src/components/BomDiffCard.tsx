import { memo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useUploadWizardStore, type BomDraft } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DiffItem, DiffResponse } from '@/types';

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

const COMMIT_TIMEOUT_MS = 5 * 60 * 1000;

export function BomDiffCard({ draft }: { draft: BomDraft }) {
  const store = useUploadWizardStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<DiffItem['status'] | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);

  const commitMut = useMutation({
    mutationFn: async () => {
      if (!draft.previewToken) throw new Error('NO_TOKEN');
      await api.post(
        '/bom/commit',
        { previewToken: draft.previewToken },
        { timeout: COMMIT_TIMEOUT_MS },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom', draft.materialCode] });
      store.updateDraft(draft.materialCode, { committed: true, commitError: null });
      toast.success(`Đã lưu BOM ${draft.materialCode}`);
    },
    onError: (e: any) => {
      const msg = e?.response?.status === 404
        ? 'Preview đã hết hạn, vui lòng preview lại'
        : 'Commit thất bại';
      store.updateDraft(draft.materialCode, { commitError: msg });
      toast.error(`${draft.materialCode}: ${msg}`);
    },
  });

  const rePreviewMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<DiffResponse>(
        '/bom/preview',
        {
          materialCode: draft.materialCode,
          materialDescription: draft.materialDescription,
          mode: store.mode,
          items: draft.items,
        },
        { timeout: COMMIT_TIMEOUT_MS },
      );
      return res.data;
    },
    onSuccess: (data) => {
      store.updateDraft(draft.materialCode, {
        previewToken: data.previewToken,
        diff: data,
        previewError: null,
        committed: false,
        commitError: null,
      });
      toast.success(`Preview lại ${draft.materialCode} thành công`);
    },
    onError: () => {
      toast.error(`Preview lại ${draft.materialCode} thất bại`);
    },
  });

  if (draft.previewError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">
              {draft.materialCode} — {draft.materialDescription}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rePreviewMut.mutate()}
              disabled={rePreviewMut.isPending}
            >
              {rePreviewMut.isPending ? 'Đang preview…' : 'Preview lại'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Preview thất bại: {draft.previewError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!draft.diff) return null;
  const diff = draft.diff;
  const filtered = filter === 'all' ? diff.items : diff.items.filter((i) => i.status === filter);

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setCollapsed((c) => !c)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{collapsed ? '▶' : '▼'}</span>
            <CardTitle className="text-base">
              {draft.materialCode} — {draft.materialDescription}
            </CardTitle>
            {draft.diff && (
              <span className="text-xs text-muted-foreground">
                ({draft.diff.items.length} items)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {draft.committed && <Badge variant="outline">Đã lưu</Badge>}
            <Button
              size="sm"
              variant="outline"
              onClick={() => rePreviewMut.mutate()}
              disabled={rePreviewMut.isPending}
            >
              {rePreviewMut.isPending ? 'Đang preview…' : 'Preview lại'}
            </Button>
            <Button
              size="sm"
              onClick={() => commitMut.mutate()}
              disabled={commitMut.isPending || draft.committed}
            >
              {commitMut.isPending ? 'Đang lưu…' : draft.committed ? 'Đã lưu' : 'Confirm & Lưu'}
            </Button>
            {draft.committed && (
              <Button size="sm" variant="ghost" onClick={() => navigate(`/bom/${draft.materialCode}`)}>
                Xem
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'new', 'changed', 'unchanged', 'removed'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? 'default' : 'outline'}
                onClick={() => setFilter(s)}
              >
                {s === 'all'
                  ? `Tất cả (${diff.items.length})`
                  : `${statusLabel[s]} (${diff.summary[s]})`}
              </Button>
            ))}
          </div>
          <div className="max-h-96 overflow-auto border border-border rounded-md">
            <table className="w-full caption-bottom text-sm table-fixed">
              <colgroup>
                <col className="w-[90px]" />
                <col className="w-[200px]" />
                <col className="w-[180px]" />
                <col className="w-[90px]" />
                <col className="w-[60px]" />
                <col className="w-[180px]" />
              </colgroup>
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
                  <DiffRow key={i} item={it} />
                ))}
              </TableBody>
            </table>
          </div>
          {draft.commitError && (
            <p className="text-sm text-destructive mt-2">{draft.commitError}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

const DiffRow = memo(function DiffRow({ item }: { item: DiffItem }) {
  const pathStr = [...item.parentPath, item.componentCode].join(' / ');
  const oldStr = item.oldValues
    ? `${item.oldValues.componentName} · ${item.oldValues.quantity} ${item.oldValues.uom}`
    : '';

  return (
    <TableRow>
      <TableCell><Badge variant={statusVariant[item.status]}>{statusLabel[item.status]}</Badge></TableCell>
      <TableCell className="font-mono text-xs">
        <span className="block truncate" title={pathStr}>{pathStr}</span>
      </TableCell>
      <TableCell>
        <span className="block truncate" title={item.componentName}>{item.componentName}</span>
      </TableCell>
      <TableCell className="text-right">{item.quantity}</TableCell>
      <TableCell>{item.uom}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {item.oldValues ? (
          <span className="block truncate" title={oldStr}>{oldStr}</span>
        ) : '-'}
      </TableCell>
    </TableRow>
  );
});
