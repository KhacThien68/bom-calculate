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
  it('level 0: demand = qty + standard - actual; production = demand - commercial', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 3, standardStock: 2, moq: null }],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 50, commercialQty: 10 }] }, deps);
    expect(res.byLevel[0].rows[0]).toMatchObject({
      code: 'P1', incoming: 50, actualStock: 3, standardStock: 2,
      stockBuffer: 2, demand: 49, commercialQty: 10, productionQty: 39,
    });
  });

  it('level 1: nhu cau BoM = parent.productionQty x quantity, aggregated across parents', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['C1', { name: 'Comp1', uom: 'PC', actualStock: 4, standardStock: 8, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'C1', componentName: 'Comp1', uom: 'PC', quantity: 6 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 39 }] }, deps);
    // level 0: production = 39 (no commercial); level 1: incoming = 39 * 6 = 234, demand = 234 + 8 - 4 = 238
    const lvl1 = res.byLevel.find(l => l.level === 1)!;
    expect(lvl1.rows[0]).toMatchObject({ code: 'C1', incoming: 234, demand: 238, productionQty: 238 });
  });

  it('level 1: if prior-level commercial > 0, do NOT top up standard stock (Excel X formula)', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['C1', { name: 'Comp1', uom: 'PC', actualStock: 0, standardStock: 8, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'C1', componentName: 'Comp1', uom: 'PC', quantity: 1 }]],
      ]),
    });
    // Order has commercial at level 0 for C1 (via override at level 0?) — use direct order for C1 with commercial.
    const res = calculateMrp({
      orders: [{ code: 'C1', qty: 5, commercialQty: 5 }, { code: 'P1', qty: 10 }],
    }, deps);
    // At level 1, C1 already has prior commercial = 5 → stockBuffer should be 0 (not 8)
    const lvl1 = res.byLevel.find(l => l.level === 1);
    const c1 = lvl1?.rows.find(r => r.code === 'C1');
    expect(c1?.stockBuffer).toBe(0);
  });

  it('aggregate skips level 0 orders (top product), includes downstream components only', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['C1', { name: 'Comp1', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'C1', componentName: 'Comp1', uom: 'PC', quantity: 2 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 5 }] }, deps);
    expect(res.aggregate).toHaveLength(1);
    expect(res.aggregate[0]).toMatchObject({ code: 'C1', demand: 10, stock: 0, shortage: 10, purchaseByMoq: 10 });
  });

  it('aggregate: demand = totalQty + standardStock; shortage = max(demand − stock, 0); MOQ rounds up', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['C1', { name: 'Comp1', uom: 'PC', actualStock: 28, standardStock: 4, moq: 20 }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'C1', componentName: 'Comp1', uom: 'PC', quantity: 1 }]],
      ]),
    });
    // matches KQ test sample for code 2004010385: 5 orders × 1 + buffer 4 = 9, stock 28 → shortage 0 → buy 0
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 5 }] }, deps);
    expect(res.aggregate[0]).toMatchObject({ code: 'C1', demand: 9, stock: 28, shortage: 0, purchaseByMoq: 0 });
  });

  it('aggregate: MOQ rounds shortage up (sample case: shortage 71 with MOQ 10 → 80)', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['C1', { name: 'Comp1', uom: 'PC', actualStock: 0, standardStock: 21, moq: 10 }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'C1', componentName: 'Comp1', uom: 'PC', quantity: 10 }]],
      ]),
    });
    // 5 orders × 10 = 50 + buffer 21 = 71, stock 0 → shortage 71 → ceil(71/10)*10 = 80
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 5 }] }, deps);
    expect(res.aggregate[0]).toMatchObject({ code: 'C1', demand: 71, stock: 0, shortage: 71, purchaseByMoq: 80 });
  });

  it('aggregate: code appearing at multiple levels sums incoming, adds buffer ONCE', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['SUB', { name: 'Sub', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['LEAF', { name: 'Leaf', uom: 'M', actualStock: 0, standardStock: 5, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [
          { componentCode: 'SUB', componentName: 'Sub', uom: 'PC', quantity: 1 },
          { componentCode: 'LEAF', componentName: 'Leaf', uom: 'M', quantity: 2 },   // also direct child at level 1
        ]],
        ['SUB', [
          { componentCode: 'LEAF', componentName: 'Leaf', uom: 'M', quantity: 3 },   // and level 2
        ]],
      ]),
    });
    // 1 order × P1 → SUB(1) and LEAF(2) at level 1. SUB(1) → LEAF(3) at level 2.
    // LEAF total incoming = 2 (level1) + 3 (level2) = 5; demand = 5 + buffer 5 = 10
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 1 }] }, deps);
    const leafAgg = res.aggregate.find(a => a.code === 'LEAF');
    expect(leafAgg).toMatchObject({ demand: 10, shortage: 10, purchaseByMoq: 10 });
  });

  it('moq null → purchaseByMoq = shortage (no rounding)', () => {
    const deps = emptyDeps({
      materialByCode: new Map([
        ['P1', { name: 'Top', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
        ['C1', { name: 'Comp1', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
      ]),
      directChildrenByCode: new Map([
        ['P1', [{ componentCode: 'C1', componentName: 'Comp1', uom: 'PC', quantity: 1 }]],
      ]),
    });
    const res = calculateMrp({ orders: [{ code: 'P1', qty: 7 }] }, deps);
    expect(res.aggregate[0].purchaseByMoq).toBe(7);
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

  it('missing material in master: still computes with stock=0', () => {
    const deps = emptyDeps();   // empty materialByCode
    const res = calculateMrp({ orders: [{ code: 'GHOST', qty: 10 }] }, deps);
    expect(res.byLevel[0].rows[0]).toMatchObject({ code: 'GHOST', actualStock: 0, standardStock: 0, demand: 10 });
    expect(res.warnings.some(w => w.type === 'missing_material' && w.code === 'GHOST')).toBe(true);
  });
});
