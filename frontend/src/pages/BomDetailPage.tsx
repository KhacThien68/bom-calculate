import { useParams, Link } from "react-router-dom";
import { useBomDetail } from "@/hooks/useBom";
import { BomTreeTable } from "@/components/BomTreeTable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronRight, Package, Layers } from "lucide-react";

export default function BomDetailPage() {
  const { materialCode } = useParams<{ materialCode: string }>();
  const { data, isLoading } = useBomDetail(materialCode);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Đang tải…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <Package className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Không tìm thấy BOM</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">
          Danh sách BOM
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{data.materialCode}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {data.materialCode}
          </h1>
          <p className="text-muted-foreground">{data.materialDescription}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>{data.items.length} items</span>
          </div>
          <span>Cập nhật: {new Date(data.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Tree table */}
      <Card className="shadow-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Cấu trúc BOM</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Tính với số lượng{" "}
              <span className="font-semibold text-foreground">
                {data.topBatchQty.toLocaleString()}
              </span>{" "}
              {data.items[0]?.uom ?? ""} (top batch)
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <BomTreeTable materialCode={data.materialCode} items={data.items} />
        </CardContent>
      </Card>
    </div>
  );
}
