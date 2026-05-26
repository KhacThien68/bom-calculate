import { useParams } from 'react-router-dom';
import { useBomDetail } from '@/hooks/useBom';
import { BomTreeTable } from '@/components/BomTreeTable';

export default function BomDetailPage() {
  const { materialCode } = useParams<{ materialCode: string }>();
  const { data, isLoading } = useBomDetail(materialCode);

  if (isLoading) return <div>Đang tải…</div>;
  if (!data) return <div>Không tìm thấy BOM</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold font-mono">{data.materialCode}</h1>
        <p className="text-muted-foreground">{data.materialDescription}</p>
      </div>
      <BomTreeTable materialCode={data.materialCode} items={data.items} />
    </div>
  );
}
