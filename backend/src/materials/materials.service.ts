import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

const toNum = (d: Prisma.Decimal | number | null): number | null => {
  if (d === null || d === undefined) return null;
  return typeof d === 'number' ? d : Number(d);
};

function serialize(m: {
  id: number;
  code: string;
  name: string;
  uom: string;
  actualStock: Prisma.Decimal;
  standardStock: Prisma.Decimal;
  moq: Prisma.Decimal | null;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    uom: m.uom,
    actualStock: Number(m.actualStock),
    standardStock: Number(m.standardStock),
    moq: toNum(m.moq),
    updatedAt: m.updatedAt,
  };
}

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  async list(opts: { q?: string; limit?: number; offset?: number }) {
    const where: Prisma.MaterialWhereInput | undefined = opts.q
      ? { OR: [{ code: { contains: opts.q } }, { name: { contains: opts.q } }] }
      : undefined;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: { code: 'asc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { total, items: rows.map(serialize) };
  }

  async search(q: string, limit = 20) {
    if (!q || q.trim() === '') return [];
    const rows = await this.prisma.material.findMany({
      where: { OR: [{ code: { contains: q } }, { name: { contains: q } }] },
      orderBy: { code: 'asc' },
      take: limit,
    });
    return rows.map(serialize);
  }

  async getById(id: number) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Material not found');
    return serialize(m);
  }

  async getByCode(code: string) {
    return this.prisma.material.findUnique({ where: { code } });
  }

  async create(dto: CreateMaterialDto, userId: number) {
    const existing = await this.prisma.material.findUnique({
      where: { code: dto.code },
    });
    if (existing)
      throw new ConflictException(`Material code "${dto.code}" already exists`);
    const m = await this.prisma.material.create({
      data: {
        code: dto.code,
        name: dto.name,
        uom: dto.uom,
        actualStock: dto.actualStock,
        standardStock: dto.standardStock,
        moq: dto.moq ?? null,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
    return serialize(m);
  }

  async update(id: number, dto: UpdateMaterialDto, userId: number) {
    const existing = await this.prisma.material.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Material not found');
    const m = await this.prisma.material.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.uom !== undefined && { uom: dto.uom }),
        ...(dto.actualStock !== undefined && { actualStock: dto.actualStock }),
        ...(dto.standardStock !== undefined && {
          standardStock: dto.standardStock,
        }),
        ...(dto.moq !== undefined && { moq: dto.moq }),
        updatedByUserId: userId,
      },
    });
    return serialize(m);
  }

  async delete(id: number) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Material not found');
    const usedInBom = await this.prisma.bomItem.count({
      where: { componentCode: m.code },
    });
    const usedAsTop = await this.prisma.bom.count({
      where: { materialCode: m.code },
    });
    if (usedInBom + usedAsTop > 0) {
      throw new ConflictException(
        `Material "${m.code}" is referenced by ${usedInBom + usedAsTop} BOM records`,
      );
    }
    await this.prisma.material.delete({ where: { id } });
    return { ok: true };
  }

  async upsertMissingByCodes(
    rows: Array<{ code: string; name: string; uom: string }>,
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const codes = rows.map((r) => r.code);
    if (codes.length === 0) return;
    const existing = await client.material.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const existingSet = new Set(existing.map((e) => e.code));
    const toCreate = rows.filter((r) => !existingSet.has(r.code));
    if (toCreate.length === 0) return;
    await client.material.createMany({
      data: toCreate.map((r) => ({
        code: r.code,
        name: r.name,
        uom: r.uom,
        actualStock: 0,
        standardStock: 0,
        moq: null,
        createdByUserId: userId,
        updatedByUserId: userId,
      })),
      skipDuplicates: true,
    });
  }
}
