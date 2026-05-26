import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewCacheService } from './preview-cache.service';
import {
  DiffResponse,
  DiffResultItem,
  PreviewItemInput,
  UploadMode,
} from './bom.types';

@Injectable()
export class BomService {
  constructor(
    private prisma: PrismaService,
    private cache: PreviewCacheService,
  ) {}

  async list() {
    const boms = await this.prisma.bom.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        materialCode: true,
        materialDescription: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
    return boms.map((b) => ({
      id: b.id,
      materialCode: b.materialCode,
      materialDescription: b.materialDescription,
      updatedAt: b.updatedAt,
      itemCount: b._count.items,
    }));
  }

  async getTree(materialCode: string) {
    const bom = await this.prisma.bom.findUnique({
      where: { materialCode },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!bom) throw new NotFoundException('BOM not found');
    return {
      id: bom.id,
      materialCode: bom.materialCode,
      materialDescription: bom.materialDescription,
      updatedAt: bom.updatedAt,
      items: bom.items.map((it) => ({
        id: it.id,
        parentId: it.parentId,
        componentCode: it.componentCode,
        componentName: it.componentName,
        quantity: Number(it.quantity),
        uom: it.uom,
        level: it.level,
        sortOrder: it.sortOrder,
      })),
    };
  }

  private static readonly PATH_SEP = '\x1f';

  private pathKey(path: string[], componentCode: string): string {
    return [...path, componentCode].join(BomService.PATH_SEP);
  }

  private buildIncomingPaths(items: PreviewItemInput[]): Map<number, string[]> {
    const bySortOrder = new Map<number, PreviewItemInput>();
    for (const it of items) bySortOrder.set(it.sortOrder, it);
    const pathBySort = new Map<number, string[]>();
    const compute = (it: PreviewItemInput): string[] => {
      if (pathBySort.has(it.sortOrder)) return pathBySort.get(it.sortOrder)!;
      let path: string[];
      if (it.parentSortOrder == null) {
        path = [];
      } else {
        const parent = bySortOrder.get(it.parentSortOrder);
        if (!parent) {
          throw new Error(`Invalid parentSortOrder ${it.parentSortOrder} on item ${it.componentCode}`);
        }
        path = [...compute(parent), parent.componentCode];
      }
      pathBySort.set(it.sortOrder, path);
      return path;
    };
    for (const it of items) compute(it);
    return pathBySort;
  }

  async preview(opts: {
    materialCode: string;
    materialDescription: string;
    mode: UploadMode;
    items: PreviewItemInput[];
  }): Promise<DiffResponse> {
    const existing = await this.prisma.bom.findUnique({
      where: { materialCode: opts.materialCode },
      include: { items: true },
    });

    const oldByKey = new Map<
      string,
      { componentName: string; quantity: number; uom: string; path: string[] }
    >();
    if (existing) {
      const byId = new Map(existing.items.map((it) => [it.id, it]));
      const pathById = new Map<number, string[]>();
      const computeOld = (id: number): string[] => {
        if (pathById.has(id)) return pathById.get(id)!;
        const it = byId.get(id)!;
        const path = it.parentId == null
          ? []
          : [...computeOld(it.parentId), byId.get(it.parentId)!.componentCode];
        pathById.set(id, path);
        return path;
      };
      for (const it of existing.items) {
        const path = computeOld(it.id);
        oldByKey.set(this.pathKey(path, it.componentCode), {
          componentName: it.componentName,
          quantity: Number(it.quantity),
          uom: it.uom,
          path,
        });
      }
    }

    const incomingPaths = this.buildIncomingPaths(opts.items);
    const newByKey = new Map<string, PreviewItemInput & { parentPath: string[] }>();
    for (const it of opts.items) {
      const parentPath = incomingPaths.get(it.sortOrder)!;
      newByKey.set(this.pathKey(parentPath, it.componentCode), { ...it, parentPath });
    }

    const diffItems: DiffResultItem[] = [];
    const summary = { new: 0, changed: 0, unchanged: 0, removed: 0 };

    for (const [key, n] of newByKey) {
      const old = oldByKey.get(key);
      if (!old) {
        diffItems.push({
          status: 'new',
          level: n.level,
          componentCode: n.componentCode,
          componentName: n.componentName,
          quantity: n.quantity,
          uom: n.uom,
          parentPath: n.parentPath,
        });
        summary.new++;
      } else if (
        old.componentName === n.componentName &&
        old.quantity === n.quantity &&
        old.uom === n.uom
      ) {
        diffItems.push({
          status: 'unchanged',
          level: n.level,
          componentCode: n.componentCode,
          componentName: n.componentName,
          quantity: n.quantity,
          uom: n.uom,
          parentPath: n.parentPath,
        });
        summary.unchanged++;
      } else {
        diffItems.push({
          status: 'changed',
          level: n.level,
          componentCode: n.componentCode,
          componentName: n.componentName,
          quantity: n.quantity,
          uom: n.uom,
          parentPath: n.parentPath,
          oldValues: {
            componentName: old.componentName,
            quantity: old.quantity,
            uom: old.uom,
          },
        });
        summary.changed++;
      }
    }

    if (opts.mode === 'full') {
      for (const [key, o] of oldByKey) {
        if (!newByKey.has(key)) {
          const codes = key.split(BomService.PATH_SEP);
          const componentCode = codes[codes.length - 1];
          diffItems.push({
            status: 'removed',
            level: o.path.length + 1,
            componentCode,
            componentName: o.componentName,
            quantity: o.quantity,
            uom: o.uom,
            parentPath: o.path,
          });
          summary.removed++;
        }
      }
    }

    const previewToken = uuidv4();
    const diff: DiffResponse = {
      previewToken,
      bomExists: !!existing,
      summary,
      items: diffItems,
    };
    this.cache.set(previewToken, {
      materialCode: opts.materialCode,
      materialDescription: opts.materialDescription,
      mode: opts.mode,
      items: opts.items,
      diff,
    });
    return diff;
  }

  async commit(token: string, userId: number) {
    const cached = this.cache.get(token);
    if (!cached) {
      throw new NotFoundException('Preview token expired or invalid');
    }
    const { materialCode, materialDescription, mode, items } = cached;

    const result = await this.prisma.$transaction(async (tx) => {
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

      const existingById = new Map(bom.items.map((it) => [it.id, it]));
      const existingPathToId = new Map<string, number>();
      const computePath = (id: number): string[] => {
        const it = existingById.get(id);
        if (!it) return [];
        return it.parentId == null
          ? []
          : [...computePath(it.parentId), existingById.get(it.parentId)!.componentCode];
      };
      for (const it of bom.items) {
        const key = [...computePath(it.id), it.componentCode].join(BomService.PATH_SEP);
        existingPathToId.set(key, it.id);
      }

      const incomingBySort = new Map(items.map((it) => [it.sortOrder, it]));
      const incomingPath = new Map<number, string[]>();
      const compute = (sort: number): string[] => {
        if (incomingPath.has(sort)) return incomingPath.get(sort)!;
        const it = incomingBySort.get(sort)!;
        const p = it.parentSortOrder == null
          ? []
          : [...compute(it.parentSortOrder), incomingBySort.get(it.parentSortOrder)!.componentCode];
        incomingPath.set(sort, p);
        return p;
      };
      for (const it of items) compute(it.sortOrder);

      const incomingPathKeys = new Set<string>();
      for (const it of items) {
        const p = incomingPath.get(it.sortOrder)!;
        incomingPathKeys.add([...p, it.componentCode].join(BomService.PATH_SEP));
      }

      if (mode === 'full') {
        const toRemoveIds: number[] = [];
        for (const [pathKey, id] of existingPathToId) {
          if (!incomingPathKeys.has(pathKey)) toRemoveIds.push(id);
        }
        if (toRemoveIds.length > 0) {
          await tx.bomItem.deleteMany({ where: { id: { in: toRemoveIds } } });
        }
      }

      const sortedItems = [...items].sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
      const newIdBySort = new Map<number, number>();

      for (const it of sortedItems) {
        const path = incomingPath.get(it.sortOrder)!;
        const key = [...path, it.componentCode].join(BomService.PATH_SEP);
        const existingId = existingPathToId.get(key);
        const parentId =
          it.parentSortOrder == null
            ? null
            : newIdBySort.get(it.parentSortOrder) ?? (() => {
                const parentItem = incomingBySort.get(it.parentSortOrder!)!;
                const parentPath = incomingPath.get(parentItem.sortOrder)!;
                const parentKey = [...parentPath, parentItem.componentCode].join(BomService.PATH_SEP);
                return existingPathToId.get(parentKey) ?? null;
              })();

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
              bomId: bom!.id,
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
    });

    this.cache.delete(token);
    return result;
  }
}
