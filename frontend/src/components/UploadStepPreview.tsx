import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { BomDiffCard } from './BomDiffCard';

export function UploadStepPreview() {
  const store = useUploadWizardStore();

  const draftsWithChanges = store.drafts.filter((d) => {
    if (!d.diff) return true; // show if no diff yet (error or loading)
    if (d.previewError) return true;
    const { summary } = d.diff;
    return summary.new > 0 || summary.changed > 0 || summary.removed > 0;
  });

  const skippedCount = store.drafts.length - draftsWithChanges.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {store.drafts.length} BOM trong file · chế độ:{' '}
          <span className="font-medium">{store.mode === 'full' ? 'Upload toàn bộ' : 'Thêm mới'}</span>
          {skippedCount > 0 && (
            <span className="ml-2">· {skippedCount} BOM không có thay đổi</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => store.goToStep('select')}>Quay lại</Button>
          <Button variant="ghost" size="sm" onClick={() => store.reset()}>Huỷ</Button>
        </div>
      </div>
      {draftsWithChanges.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Không có BOM nào có thay đổi so với dữ liệu hiện tại.
        </div>
      ) : (
        draftsWithChanges.map((d) => (
          <BomDiffCard key={d.materialCode} draft={d} />
        ))
      )}
    </div>
  );
}
