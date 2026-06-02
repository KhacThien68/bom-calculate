import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateMrp } from './mrp-engine';
import { MrpCalculateResponse, MrpInput, MrpDeps } from './mrp.types';

@Injectable()
export class MrpService {
  constructor(private prisma: PrismaService) {}

  async calculate(input: MrpInput): Promise<MrpCalculateResponse> {
    // Materials master
    const materials = await this.prisma.material.findMany();
    const materialByCode = new Map(
      materials.map((m) => [
        m.code,
        {
          name: m.name,
          uom: m.uom,
          actualStock: Number(m.actualStock),
          standardStock: Number(m.standardStock),
          moq: m.moq === null ? null : Number(m.moq),
          purchaseType: m.purchaseType,
        },
      ]),
    );

    // Load every BOM with all items so we can walk the tree at any depth.
    const boms = await this.prisma.bom.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    // directChildrenByCode keys = ANY parent code (top product OR sub-assembly).
    // Each child entry carries `parentBatchQty` — the divisor used to derive the
    // per-1-parent coefficient: coefficient = rawQty / parentBatchQty.
    // For level=1 children of top product:  parentBatchQty = Bom.topBatchQty.
    // For level=k≥2 children of a sub-assembly: parentBatchQty = parent BomItem.quantity (raw).
    const directChildrenByCode = new Map<
      string,
      Array<{
        componentCode: string;
        componentName: string;
        uom: string;
        rawQty: number;
        parentBatchQty: number;
      }>
    >();

    boms.forEach((b) => {
      const topBatch = Number(b.topBatchQty);
      const itemById = new Map(b.items.map((it) => [it.id, it]));

      // Group children by parent: parentId === null → top product is the parent.
      const childrenByParent = new Map<number | null, typeof b.items>();
      b.items.forEach((it) => {
        const key = it.parentId;
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key)!.push(it);
      });

      // Top product's children (parentId === null, typically level=1).
      const topChildren = childrenByParent.get(null) ?? [];
      const existingTopList = directChildrenByCode.get(b.materialCode) ?? [];
      topChildren.forEach((child) => {
        existingTopList.push({
          componentCode: child.componentCode,
          componentName: child.componentName,
          uom: child.uom,
          rawQty: Number(child.quantity),
          parentBatchQty: topBatch,
        });
      });
      directChildrenByCode.set(b.materialCode, existingTopList);

      // For every BomItem that has children, register them keyed by the parent's componentCode.
      // The parent's BomItem.quantity (raw) is the divisor for those children.
      childrenByParent.forEach((children, parentItemId) => {
        if (parentItemId === null) return; // handled above
        const parentItem = itemById.get(parentItemId);
        if (!parentItem) return;
        const parentRawQty = Number(parentItem.quantity);
        const list = directChildrenByCode.get(parentItem.componentCode) ?? [];
        children.forEach((child) => {
          list.push({
            componentCode: child.componentCode,
            componentName: child.componentName,
            uom: child.uom,
            rawQty: Number(child.quantity),
            parentBatchQty: parentRawQty,
          });
        });
        directChildrenByCode.set(parentItem.componentCode, list);
      });
    });

    const deps: MrpDeps = { materialByCode, directChildrenByCode };
    return calculateMrp(input, deps);
  }
}
