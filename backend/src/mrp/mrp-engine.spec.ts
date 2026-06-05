import { calculateMrp } from './mrp-engine';
import { MrpDeps, PurchaseType } from './mrp.types';

function mat(overrides: Partial<{
  name: string;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  purchaseType: PurchaseType;
}> = {}) {
  return {
    name: 'X',
    uom: 'PC',
    actualStock: 0,
    standardStock: 0,
    moq: null,
    purchaseType: 'OPTIONAL' as PurchaseType,
    ...overrides,
  };
}

function emptyDeps(overrides: Partial<MrpDeps> = {}): MrpDeps {
  return {
    materialByCode: new Map(),
    directChildrenByCode: new Map(),
    ...overrides,
  };
}

describe('calculateMrp', () => {
  it('level 0: demand = qty + standard - actual; commercial defaults to user input', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', mat({ name: 'Top', actualStock: 3, standardStock: 2 })],
      ]),
      directChildrenByCode: new Map([
        [
          'P1',
          [
            {
              componentCode: 'X',
              componentName: 'X',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp(
      { orders: [{ code: 'P1', qty: 50, commercialQty: 10 }] },
      deps,
    );
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'P1',
      incoming: 50,
      actualStock: 3,
      standardStock: 2,
      stockBuffer: 2,
      demand: 49,
      commercialQty: 10,
      productionQty: 39,
    });
  });

  it('level 0: leaf order marked REQUIRED auto-commercials demand', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        [
          'RAW',
          mat({
            name: 'Raw',
            uom: 'KG',
            actualStock: 2,
            standardStock: 5,
            moq: 10,
            purchaseType: 'REQUIRED',
          }),
        ],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'RAW', qty: 20 }] }, deps);
    // demand = 20 + 5 - 2 = 23; REQUIRED → auto-commercial = 23
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'RAW',
      demand: 23,
      commercialQty: 23,
      productionQty: 0,
    });
    expect(res.aggregate[0]).toMatchObject({
      code: 'RAW',
      totalPurchase: 23,
      moq: 10,
      purchaseByMoq: 30,
    });
  });

  it('level 0: leaf order is auto-commercial regardless of purchaseType', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['RAW', mat({ name: 'Raw', uom: 'KG' })],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'RAW', qty: 20 }] }, deps);
    // Leaf (no BOM) → can't be produced → commercial = demand even though
    // master purchaseType defaults to OPTIONAL.
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'RAW',
      demand: 20,
      commercialQty: 20,
      productionQty: 0,
    });
    expect(res.aggregate).toHaveLength(1);
    expect(res.aggregate[0]).toMatchObject({
      code: 'RAW',
      commercialTotal: 20,
      productionTotal: 0,
    });
  });

  it('level 1 cascade: rawQty=1000 of top batch 1000 → coef 1; production × 1', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['TOP', mat({ name: 'Top' })],
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'REQUIRED' })],
      ]),
      directChildrenByCode: new Map([
        [
          'TOP',
          [
            {
              componentCode: 'LEAF',
              componentName: 'Leaf',
              uom: 'PC',
              rawQty: 1000,
              parentBatchQty: 1000,
            },
          ],
        ],
      ]),
    });
    // order 50 of TOP → production 50; LEAF incoming = 50 × (1000/1000) = 50; REQUIRED → auto-commercial
    const res = calculateMrp({ orders: [{ code: 'TOP', qty: 50 }] }, deps);
    const leaf = res.byLevel.find((l) => l.level === 1)!.rows[0];
    expect(leaf).toMatchObject({
      code: 'LEAF',
      incoming: 50,
      demand: 50,
      commercialQty: 50,
    });
  });

  it('level 1 cascade: rawQty=6000 of top batch 1000 → coef 6; production × 6', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['TOP', mat({ name: 'Top' })],
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'REQUIRED' })],
      ]),
      directChildrenByCode: new Map([
        [
          'TOP',
          [
            {
              componentCode: 'LEAF',
              componentName: 'Leaf',
              uom: 'PC',
              rawQty: 6000,
              parentBatchQty: 1000,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'TOP', qty: 50 }] }, deps);
    // demand top = 50, production = 50; LEAF incoming = 50 × 6 = 300
    expect(res.byLevel.find((l) => l.level === 1)!.rows[0]).toMatchObject({
      code: 'LEAF',
      incoming: 300,
      demand: 300,
      commercialQty: 300,
    });
  });

  it('level 2 cascade: child raw 85.68 / parent raw 6000 = 0.01428 per parent', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['TOP', mat({ name: 'Top' })],
        ['SUB', mat({ name: 'Sub (Nắp)' })],
        [
          'GRAND',
          mat({
            name: 'Grand (Hạt PP)',
            uom: 'KG',
            purchaseType: 'REQUIRED',
          }),
        ],
      ]),
      directChildrenByCode: new Map([
        [
          'TOP',
          [
            {
              componentCode: 'SUB',
              componentName: 'Sub',
              uom: 'PC',
              rawQty: 6000,
              parentBatchQty: 1000,
            },
          ],
        ],
        [
          'SUB',
          [
            {
              componentCode: 'GRAND',
              componentName: 'Grand',
              uom: 'KG',
              rawQty: 85.68,
              parentBatchQty: 6000,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'TOP', qty: 50 }] }, deps);
    // TOP production = 50; SUB incoming = 50 × 6 = 300 (non-leaf, production = 300)
    // GRAND incoming = 300 × (85.68/6000) = 300 × 0.01428 = 4.284
    const grand = res.byLevel
      .find((l) => l.level === 2)!
      .rows.find((r) => r.code === 'GRAND')!;
    expect(grand.incoming).toBeCloseTo(4.284, 5);
    expect(grand.demand).toBeCloseTo(4.284, 5);
    expect(grand.commercialQty).toBeCloseTo(4.284, 5);
  });

  it('aggregate only lists materials being purchased (commercial > 0); in-house production excluded', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['TOP', mat({ name: 'Top' })],
        ['SUB', mat({ name: 'Sub' })],
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'REQUIRED' })],
      ]),
      directChildrenByCode: new Map([
        [
          'TOP',
          [
            {
              componentCode: 'SUB',
              componentName: 'Sub',
              uom: 'PC',
              rawQty: 1000,
              parentBatchQty: 1000,
            },
          ],
        ],
        [
          'SUB',
          [
            {
              componentCode: 'LEAF',
              componentName: 'Leaf',
              uom: 'PC',
              rawQty: 1000,
              parentBatchQty: 1000,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'TOP', qty: 5 }] }, deps);
    // TOP/SUB in-house (commercial=0) → excluded.
    // LEAF REQUIRED → bought entirely → present.
    expect(res.aggregate).toHaveLength(1);
    expect(res.aggregate[0]).toMatchObject({
      code: 'LEAF',
      totalPurchase: 5,
      commercialTotal: 5,
      productionTotal: 0,
      purchaseByMoq: 5,
    });
  });

  it('user override at non-leaf level forces commercial buy-out', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['TOP', mat({ name: 'Top' })],
        ['SUB', mat({ name: 'Sub', moq: 50 })],
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'REQUIRED' })],
      ]),
      directChildrenByCode: new Map([
        [
          'TOP',
          [
            {
              componentCode: 'SUB',
              componentName: 'Sub',
              uom: 'PC',
              rawQty: 1000,
              parentBatchQty: 1000,
            },
          ],
        ],
        [
          'SUB',
          [
            {
              componentCode: 'LEAF',
              componentName: 'Leaf',
              uom: 'PC',
              rawQty: 2000,
              parentBatchQty: 1000,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp(
      {
        orders: [{ code: 'TOP', qty: 10 }],
        commercialOverrides: [{ code: 'SUB', level: 1, commercialQty: 10 }],
      },
      deps,
    );
    const sub = res.byLevel
      .find((l) => l.level === 1)!
      .rows.find((r) => r.code === 'SUB')!;
    expect(sub).toMatchObject({ commercialQty: 10, productionQty: 0 });
    expect(res.byLevel.find((l) => l.level === 2)).toBeUndefined();
    // Aggregate only lists purchased items: SUB (override → all commercial).
    // TOP is in-house (commercial=0) → excluded.
    expect(res.aggregate).toEqual([
      {
        code: 'SUB',
        name: 'Sub',
        uom: 'PC',
        totalPurchase: 10,
        commercialTotal: 10,
        productionTotal: 0,
        moq: 50,
        purchaseByMoq: 50,
      },
    ]);
  });

  it('aggregate: when moq is null, purchaseByMoq equals commercialTotal (no rounding)', () => {
    // LEAF REQUIRED, no MOQ. Demand 7 → commercial=7. purchaseByMoq should be 7.
    const deps = emptyDeps({
      materialByCode: new Map([
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'REQUIRED', moq: null })],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'LEAF', qty: 7 }] }, deps);
    expect(res.aggregate).toEqual([
      {
        code: 'LEAF',
        name: 'Leaf',
        uom: 'PC',
        totalPurchase: 7,
        commercialTotal: 7,
        productionTotal: 0,
        moq: null,
        purchaseByMoq: 7,
      },
    ]);
  });

  it('REQUIRED locks productionQty at 0 even when user override < demand', () => {
    // demand = 50 + 0 - 0 = 50; REQUIRED with no override → commercial=50, production=0.
    // With override commercial=10: commercial=10, production STILL 0 (no in-house make).
    const deps = emptyDeps({
      materialByCode: new Map([
        ['TOP', mat({ name: 'Top' })],
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'REQUIRED' })],
      ]),
      directChildrenByCode: new Map([
        [
          'TOP',
          [
            {
              componentCode: 'LEAF',
              componentName: 'Leaf',
              uom: 'PC',
              rawQty: 1000,
              parentBatchQty: 1000,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp(
      {
        orders: [{ code: 'TOP', qty: 50 }],
        commercialOverrides: [
          { code: 'LEAF', level: 1, commercialQty: 10 },
        ],
      },
      deps,
    );
    const leaf = res.byLevel
      .find((l) => l.level === 1)!
      .rows.find((r) => r.code === 'LEAF')!;
    expect(leaf).toMatchObject({
      demand: 50,
      commercialQty: 10,
      productionQty: 0,
    });
  });

  it('NO purchaseType locks commercialQty at 0 for non-leaf (has BOM) even when user override > 0', () => {
    // NON-LEAF marked NO (has a BOM). Order demand = 30 with override commercial=20.
    // Leaf rule does NOT apply (because hasBom=true), so NO rule kicks in:
    // commercialQty must stay 0, productionQty = demand (must make in-house).
    const deps = emptyDeps({
      materialByCode: new Map([
        ['ASSY', mat({ name: 'Assy', purchaseType: 'NO' })],
        ['PART', mat({ name: 'Part' })],
      ]),
      directChildrenByCode: new Map([
        [
          'ASSY',
          [
            {
              componentCode: 'PART',
              componentName: 'Part',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp(
      { orders: [{ code: 'ASSY', qty: 30, commercialQty: 20 }] },
      deps,
    );
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'ASSY',
      demand: 30,
      commercialQty: 0,
      productionQty: 30,
    });
  });

  it('leaf order rule overrides NO purchaseType — auto-commercial', () => {
    // LEAF (no BOM) marked NO. Since the material cannot be produced
    // (leaf has no BOM), the leaf rule takes precedence: commercial = demand,
    // production = 0. Aggregate must include it.
    const deps = emptyDeps({
      materialByCode: new Map([
        ['LEAF', mat({ name: 'Leaf', purchaseType: 'NO' })],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'LEAF', qty: 30 }] }, deps);
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'LEAF',
      demand: 30,
      commercialQty: 30,
      productionQty: 0,
    });
    expect(res.aggregate).toHaveLength(1);
    expect(res.aggregate[0]).toMatchObject({
      code: 'LEAF',
      commercialTotal: 30,
      productionTotal: 0,
    });
  });

  it('cycle detection: A → B → A emits warning and does not infinite-loop', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['A', mat({ name: 'A' })],
        ['B', mat({ name: 'B' })],
      ]),
      directChildrenByCode: new Map([
        [
          'A',
          [
            {
              componentCode: 'B',
              componentName: 'B',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
        [
          'B',
          [
            {
              componentCode: 'A',
              componentName: 'A',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'A', qty: 1 }] }, deps);
    expect(res.warnings.some((w) => w.type === 'cycle')).toBe(true);
  });

  it('same material at multiple levels: stock + buffer netted only on first occurrence', () => {
    // Two top products A and B both order qty=10.
    // A → SHARED                   (SHARED at level 1)
    // B → SUB    → SHARED          (SHARED at level 2 under SUB)
    // SHARED has actualStock=3.15, standardStock=20.
    // Without dedup: SHARED would be netted twice (level 1 AND level 2),
    // overstating purchase need. With dedup: applied once at level 1, level 2
    // only contributes pure incoming.
    const deps = emptyDeps({
      materialByCode: new Map([
        ['A', mat({ name: 'A' })],
        ['B', mat({ name: 'B' })],
        ['SUB', mat({ name: 'Sub' })],
        [
          'SHARED',
          mat({ name: 'Shared', actualStock: 3.15, standardStock: 20 }),
        ],
      ]),
      directChildrenByCode: new Map([
        [
          'A',
          [
            {
              componentCode: 'SHARED',
              componentName: 'Shared',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
        [
          'B',
          [
            {
              componentCode: 'SUB',
              componentName: 'Sub',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
        [
          'SUB',
          [
            {
              componentCode: 'SHARED',
              componentName: 'Shared',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp(
      {
        orders: [
          { code: 'A', qty: 10 },
          { code: 'B', qty: 10 },
        ],
      },
      deps,
    );
    const lvl1Shared = res.byLevel
      .find((l) => l.level === 1)!
      .rows.find((r) => r.code === 'SHARED')!;
    const lvl2Shared = res.byLevel
      .find((l) => l.level === 2)!
      .rows.find((r) => r.code === 'SHARED')!;
    // Level 1: full netting → max(10 + 20 - 3.15, 0) = 26.85.
    // SHARED is a leaf (no BOM) → auto-commercial = 26.85.
    expect(lvl1Shared).toMatchObject({
      incoming: 10,
      actualStock: 3.15,
      standardStock: 20,
      stockBuffer: 20,
      demand: 26.85,
      commercialQty: 26.85,
      productionQty: 0,
    });
    // Level 2: stock & buffer already consumed. priorCommercial (26.85 from
    // level 1) absorbs the level-2 incoming of 10 → demand=0, commercial=0.
    expect(lvl2Shared).toMatchObject({
      incoming: 10,
      actualStock: 0,
      standardStock: 0,
      stockBuffer: 0,
      demand: 0,
      commercialQty: 0,
    });
    // Aggregate: SHARED appears once with total commercial = 26.85.
    const aggShared = res.aggregate.find((a) => a.code === 'SHARED')!;
    expect(aggShared.commercialTotal).toBeCloseTo(26.85, 4);
  });

  it('leftover stock from earlier level still covers demand at deeper level', () => {
    // SHARED has plenty: actualStock=100, buffer=5.
    // Level 1 incoming=1 (under A), level 2 incoming=10 (under B → SUB).
    // First level uses 1+5=6 → 94 remaining. Level 2 needs 10, has 94 → demand=0.
    const deps = emptyDeps({
      materialByCode: new Map([
        ['A', mat({ name: 'A' })],
        ['B', mat({ name: 'B' })],
        ['SUB', mat({ name: 'Sub' })],
        [
          'SHARED',
          mat({ name: 'Shared', actualStock: 100, standardStock: 5 }),
        ],
      ]),
      directChildrenByCode: new Map([
        [
          'A',
          [
            {
              componentCode: 'SHARED',
              componentName: 'Shared',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
        [
          'B',
          [
            {
              componentCode: 'SUB',
              componentName: 'Sub',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
        [
          'SUB',
          [
            {
              componentCode: 'SHARED',
              componentName: 'Shared',
              uom: 'PC',
              rawQty: 1,
              parentBatchQty: 1,
            },
          ],
        ],
      ]),
    });
    const res = calculateMrp(
      {
        orders: [
          { code: 'A', qty: 1 },
          { code: 'B', qty: 10 },
        ],
      },
      deps,
    );
    const lvl1Shared = res.byLevel
      .find((l) => l.level === 1)!
      .rows.find((r) => r.code === 'SHARED')!;
    const lvl2Shared = res.byLevel
      .find((l) => l.level === 2)!
      .rows.find((r) => r.code === 'SHARED')!;
    // Level 1: full netting → max(1+5-100, 0) = 0; 6 consumed, 94 remaining
    expect(lvl1Shared).toMatchObject({
      incoming: 1,
      actualStock: 100,
      standardStock: 5,
      stockBuffer: 5,
      demand: 0,
    });
    // Level 2: remaining 94 still covers incoming 10 → demand = 0, no double-buffer
    expect(lvl2Shared).toMatchObject({
      incoming: 10,
      actualStock: 94,
      standardStock: 0,
      stockBuffer: 0,
      demand: 0,
    });
    // No demand at all → SHARED absent from aggregate
    expect(res.aggregate.find((a) => a.code === 'SHARED')).toBeUndefined();
  });

  it('missing material in master: defaults stock=0, OPTIONAL purchaseType, leaf-rule auto-commercials demand', () => {
    const res = calculateMrp(
      { orders: [{ code: 'GHOST', qty: 10 }] },
      emptyDeps(),
    );
    // GHOST has no BOM and no master record → leaf rule applies:
    // commercial = demand, production = 0.
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'GHOST',
      actualStock: 0,
      standardStock: 0,
      demand: 10,
      commercialQty: 10,
      productionQty: 0,
      purchaseType: 'OPTIONAL',
    });
    expect(
      res.warnings.some(
        (w) => w.type === 'missing_material' && w.code === 'GHOST',
      ),
    ).toBe(true);
  });
});
