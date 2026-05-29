import { useEffect } from 'react';
import { useMrpStore } from '@/stores/mrp.store';
import { useMrpCalculate } from '@/hooks/useMrp';
import { useDebounced } from '@/lib/debounce';
import { MaterialSearchCombobox } from '@/components/MaterialSearchCombobox';
import { MrpOrderTable } from '@/components/MrpOrderTable';
import { MrpLevelAccordion } from '@/components/MrpLevelAccordion';
import { MrpAggregateTable } from '@/components/MrpAggregateTable';
import { MrpExportButton } from '@/components/MrpExportButton';
import { Button } from '@/components/ui/button';

export default function MrpPage() {
  const { orders, commercialOverrides, result, addOrder, setResult, setCalculating, clear } = useMrpStore();
  const calc = useMrpCalculate();
  const debouncedOrders = useDebounced(orders, 300);
  const debouncedOverrides = useDebounced(commercialOverrides, 300);

  useEffect(() => {
    if (debouncedOrders.length === 0) {
      setResult(null);
      return;
    }
    const overridesArr = Object.entries(debouncedOverrides).map(([key, qty]) => {
      const [code, levelStr] = key.split('|');
      return { code, level: parseInt(levelStr, 10), commercialQty: qty };
    });
    setCalculating(true);
    calc.mutateAsync({
      orders: debouncedOrders.map(o => ({ code: o.code, qty: o.qty, commercialQty: o.commercialQty })),
      commercialOverrides: overridesArr,
    })
      .then(setResult)
      .finally(() => setCalculating(false));
  }, [debouncedOrders, debouncedOverrides]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tính nhu cầu mua hàng</h1>
        <div className="flex gap-2">
          <MrpExportButton />
          <Button variant="outline" onClick={() => clear()}>Xoá tất cả</Button>
        </div>
      </div>
      {result?.warnings && result.warnings.length > 0 && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <p className="font-medium text-yellow-800">Cảnh báo:</p>
          <ul className="ml-4 list-disc text-yellow-700">
            {result.warnings.map((w, idx) => (
              <li key={idx}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <MaterialSearchCombobox onSelect={(m) => addOrder({ code: m.code, name: m.name, uom: m.uom })} placeholder="Thêm đơn hàng..." />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Đơn hàng</h2>
        <MrpOrderTable />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Kết quả MRP</h2>
        <MrpLevelAccordion />
      </div>
      <MrpAggregateTable />
    </div>
  );
}
