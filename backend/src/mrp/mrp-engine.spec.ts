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

  it('level 0: leaf order with default OPTIONAL produces nothing automatically', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['RAW', mat({ name: 'Raw', uom: 'KG' })],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'RAW', qty: 20 }] }, deps);
    // OPTIONAL + leaf → commercial=0, productionQty=demand (user must promote or override)
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'RAW',
      demand: 20,
      commercialQty: 0,
      productionQty: 20,
    });
    expect(res.aggregate).toHaveLength(0);
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

  it('aggregate filters out non-leaf in-house items; only REQUIRED leaves appear', () => {
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
    // SUB non-leaf, commercial=0, not in aggregate; LEAF REQUIRED → commercial = 5
    expect(res.aggregate).toHaveLength(1);
    expect(res.aggregate[0]).toMatchObject({
      code: 'LEAF',
      totalPurchase: 5,
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
    expect(res.aggregate).toEqual([
      {
        code: 'SUB',
        name: 'Sub',
        uom: 'PC',
        totalPurchase: 10,
        moq: 50,
        purchaseByMoq: 50,
      },
    ]);
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

  it('missing material in master: stock=0, DEFAULT purchaseType=OPTIONAL → no auto-buy', () => {
    const res = calculateMrp(
      { orders: [{ code: 'GHOST', qty: 10 }] },
      emptyDeps(),
    );
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'GHOST',
      actualStock: 0,
      standardStock: 0,
      demand: 10,
      commercialQty: 0,
      productionQty: 10,
      purchaseType: 'OPTIONAL',
    });
    expect(
      res.warnings.some(
        (w) => w.type === 'missing_material' && w.code === 'GHOST',
      ),
    ).toBe(true);
  });
});
