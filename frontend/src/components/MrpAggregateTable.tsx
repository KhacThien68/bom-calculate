import { useMrpStore } from '@/stores/mrp.store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}

export function MrpAggregateTable() {
  const { result } = useMrpStore();
  if (!result || result.aggregate.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Tổng hợp mua (BOM gross requirements)</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã vật tư</TableHead>
            <TableHead>Tên vật tư</TableHead>
            <TableHead>ĐVT</TableHead>
            <TableHead className="text-right">Nhu cầu (S+I2)</TableHead>
            <TableHead className="text-right">Kho (I1)</TableHead>
            <TableHead className="text-right">Cần mua</TableHead>
            <TableHead className="text-right">MOQ</TableHead>
            <TableHead className="text-right">Cần mua thêm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.aggregate.map(r => (
            <TableRow key={r.code} className={r.purchaseByMoq > 0 ? 'bg-amber-50' : ''}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.uom}</TableCell>
              <TableCell className="text-right">{fmt(r.demand)}</TableCell>
              <TableCell className="text-right">{fmt(r.stock)}</TableCell>
              <TableCell className="text-right">{fmt(r.shortage)}</TableCell>
              <TableCell className="text-right">{r.moq ?? '-'}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(r.purchaseByMoq)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
