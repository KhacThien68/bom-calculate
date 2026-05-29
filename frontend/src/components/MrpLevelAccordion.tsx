import { useMrpStore } from '@/stores/mrp.store';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function MrpLevelAccordion() {
  const { result, commercialOverrides, setCommercialOverride } = useMrpStore();
  if (!result) return null;
  const nonZero = result.byLevel.filter(l => l.level > 0 && l.rows.length > 0);

  return (
    <div className="space-y-6">
      {nonZero.map(lvl => (
        <details key={lvl.level} open className="rounded border">
          <summary className="cursor-pointer bg-gray-50 p-3 font-medium">Cấp {lvl.level} — {lvl.rows.length} dòng</summary>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Nhu cầu BoM</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
                <TableHead className="text-right">Tồn ĐM phải bù</TableHead>
                <TableHead className="text-right">Nhu cầu</TableHead>
                <TableHead className="text-right">Thương mại</TableHead>
                <TableHead className="text-right">Sản xuất</TableHead>
                <TableHead>Có BoM?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lvl.rows.map(r => (
                <TableRow key={r.code}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.uom}</TableCell>
                  <TableCell className="text-right">{r.incoming}</TableCell>
                  <TableCell className="text-right">{r.actualStock}</TableCell>
                  <TableCell className="text-right">{r.stockBuffer}</TableCell>
                  <TableCell className="text-right">{r.demand}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.000001"
                      className="w-24 text-right"
                      value={commercialOverrides[`${r.code}|${lvl.level}`] ?? r.commercialQty}
                      onChange={(e) => setCommercialOverride(r.code, lvl.level, Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right">{r.productionQty}</TableCell>
                  <TableCell>{r.hasBom ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      ))}
    </div>
  );
}
