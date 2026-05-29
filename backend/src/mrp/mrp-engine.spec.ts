import { calculateMrp } from './mrp-engine';
import { MrpDeps } from './mrp.types';

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
        ['P1', { name: 'Top', uom: 'PC', actualStock: 3, standardStock: 2, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'X', componentName: 'X', uom: 'PC', quantity: 1 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 50, commercialQty: 10 }] }, deps);
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'P1', incoming: 50, actualStock: 3, standardStock: 2,
      stockBuffer: 2, demand: 49, commercialQty: 10, productionQty: 39,
    });
  });

  it('level 0: leaf order (raw material) auto-commercials demand', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['RAW', { name: 'Raw', uom: 'KG', actualStock: 2, standardStock: 5, moq: 10 }],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'RAW', qty: 20 }] }, deps);
    // demand = 20 + 5 - 2 = 23; no BoM → auto-commercial = 23
    expect(res.byLevel[0].rows[0]).toMatchObject({ code: 'RAW', demand: 23, commercialQty: 23, productionQty: 0 });
    expect(res.aggregate[0]).toMatchObject({ code: 'RAW', totalPurchase: 23, moq: 10, purchaseByMoq: 30 });
  });

  it('level 1 non-leaf: commercial defaults to 0, production cascades', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['SUB', { name: 'Sub', uom: 'PC', actualStock: 0, standardStock: 8, moq: null }],
        ['LEAF', { name: 'Leaf', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'SUB', componentName: 'Sub', uom: 'PC', quantity: 10 }]],
        ['SUB', [{ componentCode: 'LEAF', componentName: 'Leaf', uom: 'PC', quantity: 2 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 50 }] }, deps);
    // SUB: incoming = 50 × 10 = 500, demand = 500 + 8 - 0 = 508, non-leaf → commercial = 0, production = 508
    const sub = res.byLevel.find(l => l.level === 1)!.rows.find(r => r.code === 'SUB')!;
    expect(sub).toMatchObject({ demand: 508, commercialQty: 0, productionQty: 508 });
    // LEAF: incoming = 508 × 2 = 1016, demand = 1016, leaf → commercial = 1016
    const leaf = res.byLevel.find(l => l.level === 2)!.rows.find(r => r.code === 'LEAF')!;
    expect(leaf).toMatchObject({ demand: 1016, commercialQty: 1016, productionQty: 0 });
    // Aggregate: SUB skipped (commercial=0), LEAF appears with totalPurchase=1016
    expect(res.aggregate).toEqual([{ code: 'LEAF', name: 'Leaf', uom: 'PC', totalPurchase: 1016, moq: null, purchaseByMoq: 1016 }]);
  });

  it('multi-level code: prior-level commercial nets effective stock, buffer applied once', () => {
    // 4006040008 sample: appears as level-1 child of top AND level-2 child of various sub-assemblies
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['SUB', { name: 'Sub', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['TAPE', { name: 'Tape', uom: 'M', actualStock: 3.15, standardStock: 20, moq: 10 }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [
          { componentCode: 'SUB', componentName: 'Sub', uom: 'PC', quantity: 1 },
          { componentCode: 'TAPE', componentName: 'Tape', uom: 'M', quantity: 0.016 },
        ]],
        ['SUB', [{ componentCode: 'TAPE', componentName: 'Tape', uom: 'M', quantity: 0.005 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 50 }] }, deps);
    // L1 TAPE: incoming = 50 × 0.016 = 0.8, buffer 20 (no prior commercial), effectiveStock 3.15
    //   demand = max(0.8 + 20 - 3.15, 0) = 17.65, leaf → commercial = 17.65
    const tapeL1 = res.byLevel.find(l => l.level === 1)!.rows.find(r => r.code === 'TAPE')!;
    expect(tapeL1.commercialQty).toBeCloseTo(17.65, 5);
    // L2 TAPE: incoming = SUB.production × 0.005 = 50 × 0.005 = 0.25
    //   prior commercial = 17.65 > 0 → buffer = 0
    //   effectiveStock = 3.15 + 17.65 = 20.8
    //   demand = max(0.25 + 0 - 20.8, 0) = 0, commercial = 0
    const tapeL2 = res.byLevel.find(l => l.level === 2)!.rows.find(r => r.code === 'TAPE')!;
    expect(tapeL2.commercialQty).toBe(0);
    // Aggregate: TAPE.total = 17.65 + 0 = 17.65; MOQ 10 → ceil(17.65/10)*10 = 20
    const tapeAgg = res.aggregate.find(a => a.code === 'TAPE')!;
    expect(tapeAgg.totalPurchase).toBeCloseTo(17.65, 5);
    expect(tapeAgg.purchaseByMoq).toBe(20);
  });

  it('aggregate filters out codes with zero commercial (in-house produced)', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['SUB', { name: 'Sub', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['LEAF', { name: 'Leaf', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'SUB', componentName: 'Sub', uom: 'PC', quantity: 1 }]],
        ['SUB', [{ componentCode: 'LEAF', componentName: 'Leaf', uom: 'PC', quantity: 1 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 5 }] }, deps);
    // SUB has commercial=0 (produced), LEAF has commercial=5. Only LEAF in aggregate.
    expect(res.aggregate).toHaveLength(1);
    expect(res.aggregate[0].code).toBe('LEAF');
  });

  it('user override at non-leaf level forces commercial buy-out', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['SUB', { name: 'Sub', uom: 'PC', actualStock: 0, standardStock: 0, moq: 50 }],
        ['LEAF', { name: 'Leaf', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'SUB', componentName: 'Sub', uom: 'PC', quantity: 1 }]],
        ['SUB', [{ componentCode: 'LEAF', componentName: 'Leaf', uom: 'PC', quantity: 2 }]],
      ]),
    });
    const res = calculateMrp({
      orders: [{ code: 'P1', qty: 10 }],
      commercialOverrides: [{ code: 'SUB', level: 1, commercialQty: 10 }],
    }, deps);
    // SUB at level 1: demand 10, override commercial = 10, production = 0
    const sub = res.byLevel.find(l => l.level === 1)!.rows.find(r => r.code === 'SUB')!;
    expect(sub).toMatchObject({ commercialQty: 10, productionQty: 0 });
    // No level 2 because SUB.production = 0 → LEAF never explodes
    const lvl2 = res.byLevel.find(l => l.level === 2);
    expect(lvl2).toBeUndefined();
    // Aggregate: only SUB (commercial=10), rounded to MOQ 50
    expect(res.aggregate).toEqual([{ code: 'SUB', name: 'Sub', uom: 'PC', totalPurchase: 10, moq: 50, purchaseByMoq: 50 }]);
  });

  it('cycle detection: A → B → A emits warning and does not infinite-loop', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['A', { name: 'A', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['B', { name: 'B', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['A', [{ componentCode: 'B', componentName: 'B', uom: 'PC', quantity: 1 }]],
        ['B', [{ componentCode: 'A', componentName: 'A', uom: 'PC', quantity: 1 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'A', qty: 1 }] }, deps);
    expect(res.warnings.some(w => w.type === 'cycle')).toBe(true);
  });

  it('missing material in master: still computes with stock=0, treated as leaf', () => {
    const deps = emptyDeps();   // empty materialByCode, no BoM
    const res = calculateMrp({ orders: [{ code: 'GHOST', qty: 10 }] }, deps);
    // GHOST has no BoM → leaf at level 0; demand = 10 + 0 - 0 = 10; auto-commercial = 10
    expect(res.byLevel[0].rows[0]).toMatchObject({ code: 'GHOST', actualStock: 0, standardStock: 0, demand: 10, commercialQty: 10 });
    expect(res.warnings.some(w => w.type === 'missing_material' && w.code === 'GHOST')).toBe(true);
  });
});
