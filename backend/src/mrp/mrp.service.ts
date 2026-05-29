import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateMrp } from './mrp-engine';
import { MrpCalculateResponse, MrpInput, MrpDeps } from './mrp.types';

@Injectable()
export class MrpService {
  constructor(private prisma: PrismaService) {}

  async calculate(input: MrpInput): Promise<MrpCalculateResponse> {
    const codes = new Set<string>();
    input.orders.forEach(o => codes.add(o.code));
    input.commercialOverrides?.forEach(o => codes.add(o.code));

    // Materials lookup will be expanded by engine as it traverses; we preload everything for simplicity.
    const materials = await this.prisma.material.findMany();
    const materialByCode = new Map(materials.map(m => [m.code, {
      name: m.name, uom: m.uom,
      actualStock: Number(m.actualStock),
      standardStock: Number(m.standardStock),
      moq: m.moq === null ? null : Number(m.moq),
    }]));

    // Preload direct children of every Bom (level=1 BomItems).
    const boms = await this.prisma.bom.findMany({
      include: { items: { where: { level: 1 } } },
    });
    const directChildrenByCode = new Map<string, Array<{ componentCode: string; componentName: string; uom: string; quantity: number }>>();
    boms.forEach(b => {
      directChildrenByCode.set(b.materialCode, b.items.map(it => ({
        componentCode: it.componentCode,
        componentName: it.componentName,
        uom: it.uom,
        quantity: Number(it.quantity),
      })));
    });

    const deps: MrpDeps = { materialByCode, directChildrenByCode };
    return calculateMrp(input, deps);
  }
}
