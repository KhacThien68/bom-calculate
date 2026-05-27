import type { BomItem } from '@/types';

export interface BomTreeNode extends BomItem {
  children: BomTreeNode[];
}

/**
 * Build a hierarchical tree from a flat list of BomItems (each with parentId),
 * sorted by sortOrder at every level.
 */
export function buildBomTree(items: BomItem[]): BomTreeNode[] {
  const byId = new Map<number, BomTreeNode>();
  items.forEach((it) => byId.set(it.id, { ...it, children: [] }));
  const roots: BomTreeNode[] = [];
  for (const it of items) {
    const node = byId.get(it.id)!;
    if (it.parentId == null) roots.push(node);
    else byId.get(it.parentId)?.children.push(node);
  }
  const sortChildren = (n: BomTreeNode) => {
    n.children.sort((a, b) => a.sortOrder - b.sortOrder);
    n.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  roots.forEach(sortChildren);
  return roots;
}
