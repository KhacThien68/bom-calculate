import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { MaterialPreviewCacheService } from './material-preview-cache.service';
import {
  PreviewMaterialsDto,
  PreviewMaterialRowDto,
} from './dto/preview-materials.dto';
import {
  MaterialDiffResponse,
  MaterialDiffRow,
  MaterialDiffSummary,
} from './materials.types';

const EPS = 1e-6;
const numEq = (a: number, b: number) => Math.abs(a - b) < EPS;
const moqEq = (a: number | null, b: number | null) =>
  a === null && b === null ? true : a !== null && b !== null && numEq(a, b);

function compareRow(
  old: {
    name: string;
    uom: string;
    actualStock: number;
    standardStock: number;
    moq: number | null;
  },
  n: PreviewMaterialRowDto,
): boolean {
  return (
    old.name === n.name &&
    old.uom === n.uom &&
    numEq(old.actualStock, n.actualStock) &&
    numEq(old.standardStock, n.standardStock) &&
    moqEq(old.moq, n.moq ?? null)
  );
}

@Injectable()
export class MaterialUploadService {
  constructor(
    private prisma: PrismaService,
    private cache: MaterialPreviewCacheService,
  ) {}

  async preview(dto: PreviewMaterialsDto): Promise<MaterialDiffResponse> {
    const codes = dto.items.map((i) => i.code);
    const existing = await this.prisma.material.findMany({
      where: { code: { in: codes } },
    });
    const oldByCode = new Map(
      existing.map((e) => [
        e.code,
        {
          name: e.name,
          uom: e.uom,
          actualStock: Number(e.actualStock),
          standardStock: Number(e.standardStock),
          moq: e.moq === null ? null : Number(e.moq),
        },
      ]),
    );

    const items: MaterialDiffRow[] = [];
    const summary: MaterialDiffSummary = {
      new: 0,
      changed: 0,
      unchanged: 0,
      removed: 0,
    };

    const newByCode = new Map(dto.items.map((i) => [i.code, i]));
    dto.items.forEach((n) => {
      const old = oldByCode.get(n.code);
      const moq = n.moq ?? null;
      if (!old) {
        items.push({
          status: 'new',
          code: n.code,
          name: n.name,
          uom: n.uom,
          actualStock: n.actualStock,
          standardStock: n.standardStock,
          moq,
        });
        summary.new++;
      } else if (compareRow(old, n)) {
        items.push({
          status: 'unchanged',
          code: n.code,
          name: n.name,
          uom: n.uom,
          actualStock: n.actualStock,
          standardStock: n.standardStock,
          moq,
        });
        summary.unchanged++;
      } else {
        items.push({
          status: 'changed',
          code: n.code,
          name: n.name,
          uom: n.uom,
          actualStock: n.actualStock,
          standardStock: n.standardStock,
          moq,
          oldValues: {
            name: old.name,
            uom: old.uom,
            actualStock: old.actualStock,
            standardStock: old.standardStock,
            moq: old.moq,
          },
        });
        summary.changed++;
      }
    });

    if (dto.mode === 'full') {
      existing.forEach((e) => {
        if (!newByCode.has(e.code)) {
          items.push({
            status: 'removed',
            code: e.code,
            name: e.name,
            uom: e.uom,
            actualStock: Number(e.actualStock),
            standardStock: Number(e.standardStock),
            moq: e.moq === null ? null : Number(e.moq),
          });
          summary.removed++;
        }
      });
    }

    const previewToken = uuidv4();
    this.cache.set(previewToken, {
      mode: dto.mode,
      items: dto.items.map((i) => ({ ...i, moq: i.moq ?? null })),
    });
    return { previewToken, summary, items };
  }

  async commit(token: string, userId: number) {
    const cached = this.cache.get(token);
    if (!cached)
      throw new NotFoundException('Preview token expired or invalid');

    await this.prisma.$transaction(async (tx) => {
      const incomingCodes = cached.items.map((i) => i.code);

      if (cached.mode === 'full') {
        await tx.material.deleteMany({
          where: { code: { notIn: incomingCodes } },
        });
      }

      // Upsert each row
      await Promise.all(
        cached.items.map((i) =>
          tx.material.upsert({
            where: { code: i.code },
            create: {
              code: i.code,
              name: i.name,
              uom: i.uom,
              actualStock: i.actualStock,
              standardStock: i.standardStock,
              moq: i.moq,
              createdByUserId: userId,
              updatedByUserId: userId,
            },
            update: {
              name: i.name,
              uom: i.uom,
              actualStock: i.actualStock,
              standardStock: i.standardStock,
              moq: i.moq,
              updatedByUserId: userId,
            },
          }),
        ),
      );
    });

    this.cache.delete(token);
    return { ok: true };
  }
}
