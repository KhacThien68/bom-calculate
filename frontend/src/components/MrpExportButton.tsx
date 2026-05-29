import { useMrpStore } from '@/stores/mrp.store';
import { exportMrpExcel } from '@/lib/excel';
import { Button } from '@/components/ui/button';

export function MrpExportButton() {
  const { result } = useMrpStore();
  return (
    <Button
      variant="outline"
      disabled={!result || result.aggregate.length === 0}
      onClick={() => result && exportMrpExcel(result)}
    >
      Export Excel
    </Button>
  );
}
