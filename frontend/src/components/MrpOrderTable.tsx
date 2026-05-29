import { useMrpStore } from '@/stores/mrp.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtNum } from '@/lib/utils';

export function MrpOrderTable() {
  const { orders, updateOrder, removeOrder, result } = useMrpStore();
  const level0Rows = result?.byLevel.find(l => l.level === 0)?.rows ?? [];
  const byCode = new Map(level0Rows.map(r => [r.code, r]));

  if (orders.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có đơn hàng nào. Dùng ô search ở trên để thêm.</p>;
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
          return (
            <TableRow key={o.code}>
              <TableCell className="font-mono">{o.code}</TableCell>
              <TableCell>{o.name}</TableCell>
              <TableCell>{o.uom}</TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.000001"
                  className="w-24 text-right"
                  value={o.qty}
                  onChange={(e) => updateOrder(idx, { qty: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell className="text-right">{fmtNum(calc?.actualStock)}</TableCell>
              <TableCell className="text-right">{fmtNum(calc?.standardStock)}</TableCell>
              <TableCell className="text-right">{fmtNum(calc?.demand)}</TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.000001"
                  className="w-24 text-right"
                  value={o.commercialQty}
                  onChange={(e) => updateOrder(idx, { commercialQty: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell className="text-right">{fmtNum(calc?.productionQty)}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => removeOrder(idx)}>Xoá</Button></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
