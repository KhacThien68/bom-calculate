import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useBomTreeUiStore } from '@/stores/bomTreeUi.store';
import { BomTreeRow } from './BomTreeRow';
import type { BomItem, BomTreeNode } from '@/types';

interface Props {
  materialCode: string;
  items: BomItem[];
}

function buildTree(items: BomItem[]): BomTreeNode[] {
  const byId = new Map<number, BomTreeNode>();
  items.forEach((it) => byId.set(it.id, { ...it, children: [] }));
  const roots: BomTreeNode[] = [];
  items.forEach((it) => {
    const node = byId.get(it.id)!;
    if (it.parentId == null) roots.push(node);
    else byId.get(it.parentId)?.children.push(node);
  });
  const sortChildren = (n: BomTreeNode) => {
    n.children.sort((a, b) => a.sortOrder - b.sortOrder);
    n.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  roots.forEach(sortChildren);
  return roots;
}

export function BomTreeTable({ materialCode, items }: Props) {
  const roots = buildTree(items);
  const expandedByBom = useBomTreeUiStore((s) => s.expandedByBom);
  const toggle = useBomTreeUiStore((s) => s.toggle);
  const expandAll = useBomTreeUiStore((s) => s.expandAll);
  const collapseAll = useBomTreeUiStore((s) => s.collapseAll);

  const expanded = expandedByBom[materialCode];
  const isExpanded = (id: number) => expanded?.has(id) ?? false;

  const renderRow = (node: BomTreeNode): React.ReactNode[] => {
    const rows: React.ReactNode[] = [
      <BomTreeRow
        key={node.id}
        node={node}
        materialCode={materialCode}
        isExpanded={isExpanded}
        toggle={toggle}
      />,
    ];
    if (isExpanded(node.id))
      node.children.forEach((child) => rows.push(...renderRow(child)));
    return rows;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            expandAll(
              materialCode,
              items.map((i) => i.id),
            )
          }
        >
          Mở tất cả
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => collapseAll(materialCode)}
        >
          Đóng tất cả
        </Button>
      </div>
      <Table>
        <colgroup>
          <col className="w-[180px]" />
          <col className="w-[200px]" />
          <col className="w-[100px]" />
          <col className="w-[70px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col className="w-[60px]" />
          <col className="w-[70px]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>UoM</TableHead>
            <TableHead className="text-right">TK thực tế</TableHead>
            <TableHead className="text-right">TK tiêu chuẩn</TableHead>
            <TableHead className="text-right">Level</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{roots.flatMap(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
