import { Link, useNavigate } from 'react-router-dom';
import { useBomList } from '@/hooks/useBom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Clock } from 'lucide-react';

export default function BomListPage() {
  const { data = [], isLoading } = useBomList();
  const navigate = useNavigate();

  const totalItems = data.reduce((sum, b) => sum + b.itemCount, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Danh sách BOM</h1>
          <p className="text-muted-foreground mt-1">Quản lý tất cả Bill of Materials</p>
        </div>
        <Button asChild className="gradient-primary text-white">
          <Link to="/upload">
            <Plus className="h-4 w-4 mr-2" />
            Upload BOM mới
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.length}</p>
              <p className="text-sm text-muted-foreground">Tổng BOM</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-sm text-muted-foreground">Tổng items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.length > 0 ? new Date(data[0].updatedAt).toLocaleDateString() : '—'}
              </p>
              <p className="text-sm text-muted-foreground">Cập nhật gần nhất</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tất cả BOM</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Material Code</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold text-center">Số item</TableHead>
                <TableHead className="font-semibold">Cập nhật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Đang tải…
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-10 w-10 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Chưa có BOM nào</p>
                      <Button asChild variant="outline" size="sm" className="mt-2">
                        <Link to="/upload">Upload BOM đầu tiên</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.map((b) => (
                <TableRow
                  key={b.id}
                  className="cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => navigate(`/bom/${b.materialCode}`)}
                >
                  <TableCell className="font-mono font-medium text-primary">{b.materialCode}</TableCell>
                  <TableCell>{b.materialDescription}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-muted text-xs font-medium">
                      {b.itemCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(b.updatedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
