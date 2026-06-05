import { useMrpStore } from '@/stores/mrp.store';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/ui/numeric-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, fmtNum } from '@/lib/utils';

export function MrpOrderTable() {
  const { orders, updateOrder, removeOrder, result } = useMrpStore();
  const level0Rows = result?.byLevel.find((l) => l.level === 0)?.rows ?? [];
  const byCode = new Map(level0Rows.map((r) => [r.code, r]));

  if (orders.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Chưa có đơn hàng nào. Dùng ô search ở trên để thêm.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã</TableHead>
          <TableHead>Tên</TableHead>
          <TableHead>ĐVT</TableHead>
          <TableHead className="text-right">Đơn hàng</TableHead>
          <TableHead className="text-right">Tồn</TableHead>
          <TableHead className="text-right">Tồn ĐM</TableHead>
          <TableHead className="text-right">Nhu cầu</TableHead>
          <TableHead className="text-right">Thương mại</TableHead>
          <TableHead className="text-right">Sản xuất</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o, idx) => {
          const calc = byCode.get(o.code);
          const isLeaf = calc !== undefined && !calc.hasBom;
          // NO purchaseType disables commercial input — but leaves are
          // always auto-commercial (engine forces it), so input stays enabled
          // for leaves so the user can over-buy if needed.
          const isNo = calc?.purchaseType === 'NO' && !isLeaf;
          const isRequiredShort =
            calc?.purchaseType === 'REQUIRED' &&
            calc.demand > 0 &&
            o.commercialQty < calc.demand;
          return (
            <TableRow key={o.code}>
              <TableCell className="font-mono">{o.code}</TableCell>
              <TableCell>{o.name}</TableCell>
              <TableCell>{o.uom}</TableCell>
              <TableCell className="text-right">
                <NumericInput
                  className="w-24 text-right"
                  value={o.qty}
                  onChange={(e) =>
                    updateOrder(idx, { qty: Number(e.target.value) })
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                {fmtNum(calc?.actualStock)}
              </TableCell>
              <TableCell className="text-right">
                {fmtNum(calc?.standardStock)}
              </TableCell>
              <TableCell className="text-right">
                {fmtNum(calc?.demand)}
              </TableCell>
              <TableCell className="text-right align-top">
                <NumericInput
                  className={cn(
                    'w-24 text-right',
                    isRequiredShort &&
                      'border-red-500 focus-visible:ring-red-500',
                  )}
                  disabled={isNo}
                  value={isNo ? 0 : o.commercialQty}
                  onChange={(e) =>
                    updateOrder(idx, { commercialQty: Number(e.target.value) })
                  }
                />
                {isRequiredShort && (
                  <p className="mt-1 text-xs text-red-600">
                    Bắt buộc mua: cần ≥ {fmtNum(calc?.demand)}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">
                {fmtNum(calc?.productionQty)}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeOrder(idx)}
                >
                  Xoá
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
