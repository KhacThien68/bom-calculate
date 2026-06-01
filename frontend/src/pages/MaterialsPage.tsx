import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMaterialList, useDeleteMaterial } from '@/hooks/useMaterials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';

export default function MaterialsPage() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useMaterialList(q);
  const del = useDeleteMaterial();

  const handleDelete = (id: number, code: string) => {
    if (!confirm(`Xoá material ${code}?`)) return;
    del.mutate(id, {
      onSuccess: () => toast.success('Đã xoá'),
      onError: (e: unknown) =>
        toast.error(getApiErrorMessage(e) ?? 'Xoá thất bại'),
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vật tư</h1>
        <div className="flex gap-2">
          <Link to="/materials/upload">
            <Button variant="outline">Upload Excel</Button>
          </Link>
          <Link to="/materials/new">
            <Button>Tạo mới</Button>
          </Link>
        </div>
      </div>
      <Input
        placeholder="Tìm theo mã hoặc tên..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      {isLoading ? (
        <p>Đang tải...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>ĐVT</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
              <TableHead className="text-right">Tồn ĐM</TableHead>
              <TableHead className="text-right">MOQ</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.code}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.uom}</TableCell>
                <TableCell className="text-right">
                  {fmtNum(m.actualStock)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtNum(m.standardStock)}
                </TableCell>
                <TableCell className="text-right">{fmtNum(m.moq)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Link to={`/materials/${m.id}`}>
                    <Button size="sm" variant="outline">
                      Sửa
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(m.id, m.code)}
                  >
                    Xoá
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
