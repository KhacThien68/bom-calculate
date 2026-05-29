import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewCacheService } from './preview-cache.service';
import { MaterialsService } from '../materials/materials.service';
import { DiffResponse, PreviewItemInput, UploadMode } from './bom.types';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { buildDbPaths, pathKey } from './bom-path.util';
import { computeDiff, OldEntry } from './bom-diff';
import { applyCommit } from './bom-commit';

@Injectable()
export class BomService {
  constructor(
    private prisma: PrismaService,
    private cache: PreviewCacheService,
    private materials: MaterialsService,
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

    const codes = bom.items.map(it => it.componentCode);
    const mats = await this.prisma.material.findMany({
      where: { code: { in: codes } },
      select: { code: true, actualStock: true, standardStock: true, moq: true },
    });
    const stockByCode = new Map(mats.map(m => [m.code, {
      actualStock: Number(m.actualStock),
      standardStock: Number(m.standardStock),
      moq: m.moq === null ? null : Number(m.moq),
    }]));

    return {
      id: bom.id,
      materialCode: bom.materialCode,
      materialDescription: bom.materialDescription,
      updatedAt: bom.updatedAt,
      items: bom.items.map((it) => {
        const stock = stockByCode.get(it.componentCode) ?? { actualStock: 0, standardStock: 0, moq: null };
        return {
          id: it.id, parentId: it.parentId,
          componentCode: it.componentCode,
          componentName: it.componentName,
          quantity: Number(it.quantity),
          uom: it.uom,
          actualStock: stock.actualStock,
          standardStock: stock.standardStock,
          moq: stock.moq,
          level: it.level, sortOrder: it.sortOrder,
        };
      }),
    };
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

    const oldByKey = new Map<string, OldEntry>();
    if (existing) {
      const pathById = buildDbPaths(existing.items);
      for (const it of existing.items) {
        const path = pathById.get(it.id)!;
        oldByKey.set(pathKey(path, it.componentCode), {
          componentName: it.componentName,
          quantity: Number(it.quantity),
          uom: it.uom,
          path,
        });
      }
    }

    const { items, summary } = computeDiff({ items: opts.items, oldByKey, mode: opts.mode });

    const previewToken = uuidv4();
    const diff: DiffResponse = {
      previewToken,
      bomExists: !!existing,
      summary,
      items,
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
    const result = await this.prisma.$transaction(async (tx) => {
      // Collect codes: top + every component
      const allCodes = [
        { code: cached.materialCode, name: cached.materialDescription, uom: 'PC' },
        ...cached.items.map(it => ({ code: it.componentCode, name: it.componentName, uom: it.uom })),
      ];
      await this.materials.upsertMissingByCodes(allCodes, userId, tx);
      return applyCommit(tx, cached, userId);
    });
    this.cache.delete(token);
    return result;
  }

  async updateItem(itemId: number, dto: UpdateBomItemDto, userId: number) {
    const item = await this.prisma.bomItem.findUnique({
      where: { id: itemId },
      include: { bom: true },
    });
    if (!item) throw new NotFoundException('BOM item not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.bomItem.update({
        where: { id: itemId },
        data: {
          ...(dto.componentName !== undefined && { componentName: dto.componentName }),
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.uom !== undefined && { uom: dto.uom }),
        },
      });
      await tx.bom.update({
        where: { id: item.bomId },
        data: { updatedByUserId: userId },
      });
      return result;
    });

    return {
      id: updated.id,
      componentCode: updated.componentCode,
      componentName: updated.componentName,
      quantity: Number(updated.quantity),
      uom: updated.uom,
    };
  }
}
