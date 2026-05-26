import { ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useBomTreeUiStore } from '@/stores/bomTreeUi.store';
import type { BomItem } from '@/types';

interface Props {
  materialCode: string;
  items: BomItem[];
}

interface TreeNode extends BomItem {
  children: TreeNode[];
}

function buildTree(items: BomItem[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  items.forEach((it) => byId.set(it.id, { ...it, children: [] }));
  const roots: TreeNode[] = [];
  for (const it of items) {
    const node = byId.get(it.id)!;
    if (it.parentId == null) roots.push(node);
    else byId.get(it.parentId)?.children.push(node);
  }
  const sortChildren = (n: TreeNode) => {
    n.children.sort((a, b) => a.sortOrder - b.sortOrder);
    n.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  roots.forEach(sortChildren);
  return roots;
}

export function BomTreeTable({ materialCode, items }: Props) {
  const roots = buildTree(items);
  const isExpanded = useBomTreeUiStore((s) => s.isExpanded);
  const toggle = useBomTreeUiStore((s) => s.toggle);
  const expandAll = useBomTreeUiStore((s) => s.expandAll);
  const collapseAll = useBomTreeUiStore((s) => s.collapseAll);

  const renderRow = (node: TreeNode): React.ReactNode[] => {
    const hasChildren = node.children.length > 0;
    const open = isExpanded(materialCode, node.id);
    const rows: React.ReactNode[] = [
      <TableRow key={node.id}>
        <TableCell style={{ paddingLeft: 8 + (node.level - 1) * 24 }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggle(materialCode, node.id)}>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="w-6 inline-block" />
            )}
            <span className="font-mono">{node.componentCode}</span>
          </div>
        </TableCell>
        <TableCell>{node.componentName}</TableCell>
        <TableCell className="text-right">{node.quantity}</TableCell>
        <TableCell>{node.uom}</TableCell>
        <TableCell className="text-right">{node.level}</TableCell>
      </TableRow>,
    ];
    if (open) for (const child of node.children) rows.push(...renderRow(child));
    return rows;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => expandAll(materialCode, items.map((i) => i.id))}>
          Mở tất cả
        </Button>
        <Button size="sm" variant="outline" onClick={() => collapseAll(materialCode)}>
          Đóng tất cả
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>UoM</TableHead>
            <TableHead className="text-right">Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{roots.flatMap(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
