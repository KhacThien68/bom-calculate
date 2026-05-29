import { useMrpStore } from '@/stores/mrp.store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function MrpAggregateTable() {
  const { result } = useMrpStore();
  if (!result || result.aggregate.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Tổng hợp mua</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead><TableHead>Tên</TableHead><TableHead>ĐVT</TableHead>
            <TableHead className="text-right">Tổng mua</TableHead><TableHead className="text-right">MOQ</TableHead><TableHead className="text-right">Mua theo MOQ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.aggregate.map(r => (
            <TableRow key={r.code}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.uom}</TableCell>
              <TableCell className="text-right">{r.totalPurchase}</TableCell>
              <TableCell className="text-right">{r.moq ?? '-'}</TableCell>
              <TableCell className="text-right font-semibold">{r.purchaseByMoq}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
