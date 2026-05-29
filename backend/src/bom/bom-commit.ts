import { Prisma } from '@prisma/client';
import { CachedPreview } from './bom.types';
import { buildDbPaths, buildInputPaths, pathKey } from './bom-path.util';

/**
 * Apply a previously-computed diff to the database inside a transaction.
 * - In `full` mode, items present in the DB but not in the upload are deleted.
 * - In both modes, items are upserted (matched by tree path); rows are
 *   processed in level order so a parent's id is available for its children.
 */
export async function applyCommit(
  tx: Prisma.TransactionClient,
  cached: CachedPreview,
  userId: number,
): Promise<{ materialCode: string }> {
  const { materialCode, materialDescription, mode, items } = cached;

  let bom = await tx.bom.findUnique({
    where: { materialCode },
    include: { items: true },
  });

  if (!bom) {
    bom = await tx.bom.create({
      data: {
        materialCode,
        materialDescription,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
      include: { items: true },
    });
  } else {
    await tx.bom.update({
      where: { id: bom.id },
      data: { materialDescription, updatedByUserId: userId },
    });
  }

  const existingPathById = buildDbPaths(bom.items);
  const existingPathToId = new Map<string, number>();
  for (const it of bom.items) {
    existingPathToId.set(pathKey(existingPathById.get(it.id)!, it.componentCode), it.id);
  }

  const incomingPath = buildInputPaths(items);
  const incomingPathKeys = new Set<string>();
  for (const it of items) {
    incomingPathKeys.add(pathKey(incomingPath.get(it.sortOrder)!, it.componentCode));
  }

  if (mode === 'full') {
    const toRemoveIds: number[] = [];
    for (const [key, id] of existingPathToId) {
      if (!incomingPathKeys.has(key)) toRemoveIds.push(id);
    }
    if (toRemoveIds.length > 0) {
      await tx.bomItem.deleteMany({ where: { id: { in: toRemoveIds } } });
    }
  }

  const incomingBySort = new Map(items.map((it) => [it.sortOrder, it]));
  const sorted = [...items].sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
  const newIdBySort = new Map<number, number>();

  for (const it of sorted) {
    const path = incomingPath.get(it.sortOrder)!;
    const key = pathKey(path, it.componentCode);
    const existingId = existingPathToId.get(key);
    let parentId: number | null = null;
    if (it.parentSortOrder != null) {
      parentId = newIdBySort.get(it.parentSortOrder) ?? null;
      if (parentId == null) {
        const parentItem = incomingBySort.get(it.parentSortOrder)!;
        const parentKey = pathKey(incomingPath.get(parentItem.sortOrder)!, parentItem.componentCode);
        parentId = existingPathToId.get(parentKey) ?? null;
      }
    }

    if (existingId) {
      await tx.bomItem.update({
        where: { id: existingId },
        data: {
          componentName: it.componentName,
          quantity: it.quantity,
          uom: it.uom,
          level: it.level,
          sortOrder: it.sortOrder,
          parentId,
        },
      });
      newIdBySort.set(it.sortOrder, existingId);
    } else {
      const created = await tx.bomItem.create({
        data: {
          bomId: bom.id,
          parentId,
          componentCode: it.componentCode,
          componentName: it.componentName,
          quantity: it.quantity,
          uom: it.uom,
          level: it.level,
          sortOrder: it.sortOrder,
        },
      });
      newIdBySort.set(it.sortOrder, created.id);
      existingPathToId.set(key, created.id);
    }
  }

  return { materialCode };
}
