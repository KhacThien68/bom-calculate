import { Link } from 'react-router-dom';
import { useBomList } from '@/hooks/useBom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BomListPage() {
  const { data = [], isLoading } = useBomList();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Danh sách BOM</h1>
        <Button asChild><Link to="/upload">Upload BOM mới</Link></Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Số item</TableHead>
            <TableHead>Cập nhật</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={4}>Đang tải…</TableCell></TableRow>
          ) : data.length === 0 ? (
            <TableRow><TableCell colSpan={4}>Chưa có BOM nào</TableCell></TableRow>
          ) : data.map((b) => (
            <TableRow key={b.id} className="cursor-pointer">
              <TableCell className="font-mono">
                <Link to={`/bom/${b.materialCode}`} className="hover:underline">{b.materialCode}</Link>
              </TableCell>
              <TableCell>{b.materialDescription}</TableCell>
              <TableCell>{b.itemCount}</TableCell>
              <TableCell>{new Date(b.updatedAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
