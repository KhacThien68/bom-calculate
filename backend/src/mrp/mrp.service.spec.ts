import { calculateMrp } from './mrp-engine';

// Excel parity with `DVC_Test MRP.xlsx`.
// Order 2003031013 qty=50, level-0 commercial=10 → top production = 39.
// BOM stores raw Qty_B; parentBatchQty drives the cascade divisor.
describe('MRP parity vs DVC_Test sample (raw Qty_B + topBatchQty=1000)', () => {
  it('level-1 leaf Gioăng chỉ (raw 1000, batch 1000): AT=47, AU=50', () => {
    const res = calculateMrp(
      { orders: [{ code: '2003031013', qty: 50, commercialQty: 10 }] },
      {
        materialByCode: new Map([
          ['2003031013', { name: 'Bộ lõi', uom: 'PC', actualStock: 3, standardStock: 2, moq: 5 }],
          ['2017030156', { name: 'Gioăng chỉ', uom: 'PC', actualStock: 0, standardStock: 8, moq: 50 }],
        ]),
        directChildrenByCode: new Map([
          ['2003031013', [
            { componentCode: '2017030156', componentName: 'Gioăng chỉ', uom: 'PC', rawQty: 1000, parentBatchQty: 1000 },
          ]],
        ]),
      },
    );
    // top production = 39; gioăng incoming = 39 × (1000/1000) = 39; demand = 39+8 = 47; leaf → AT=47
    const agg = res.aggregate.find(a => a.code === '2017030156')!;
    expect(agg.totalPurchase).toBe(47);
    expect(agg.purchaseByMoq).toBe(50);
  });

  it('level-2 grand-child (Hạt PP T3034 under Nắp): raw 85.68 / parent raw 6000 → demand 4.284 + buffer', () => {
    const res = calculateMrp(
      { orders: [{ code: '2003031013', qty: 50, commercialQty: 10 }] },
      {
        materialByCode: new Map([
          ['2003031013', { name: 'Bộ lõi', uom: 'PC', actualStock: 3, standardStock: 2, moq: 5 }],
          ['2010020224', { name: 'Nắp lõi', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
          ['4002010030', { name: 'Hạt PP T3034', uom: 'KG', actualStock: 0, standardStock: 0, moq: 1 }],
        ]),
        directChildrenByCode: new Map([
          ['2003031013', [
            { componentCode: '2010020224', componentName: 'Nắp lõi', uom: 'PC', rawQty: 6000, parentBatchQty: 1000 },
          ]],
          ['2010020224', [
            { componentCode: '4002010030', componentName: 'Hạt PP T3034', uom: 'KG', rawQty: 85.68, parentBatchQty: 6000 },
          ]],
        ]),
      },
    );
    // top production = 39; Nắp incoming = 39 × (6000/1000) = 234, non-leaf production=234
    // Hạt incoming = 234 × (85.68/6000) = 234 × 0.01428 = 3.34152; demand=3.34152, MOQ 1 → 4
    const agg = res.aggregate.find(a => a.code === '4002010030')!;
    expect(agg.totalPurchase).toBeCloseTo(3.34152, 4);
    expect(agg.purchaseByMoq).toBe(4);
  });
});
