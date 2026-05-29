import { calculateMrp } from './mrp-engine';

// Excel parity vs `KQ test MRP 2003031013.xlsx`:
// Order qty = 5 for top product 2003031013; aggregate reproduces the
// "Nhu Cầu (S+I2) / Kho / Cần Mua Thêm" output of the test file's "MRP trả" sheet.
describe('MRP Excel parity (subset)', () => {
  it('matches KQ test for 2004010385: 5×1 + buffer 4 = 9, stock 28 → buy 0', () => {
    const res = calculateMrp(
      { orders: [{ code: '2003031013', qty: 5 }] },
      {
        materialByCode: new Map([
          ['2003031013', { name: 'Bộ lõi', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
          ['2004010385', { name: 'Phôi lõi PPN 178-36 Nano', uom: 'PC', actualStock: 28, standardStock: 4, moq: 20 }],
        ]),
        directChildrenByCode: new Map([
          ['2003031013', [{ componentCode: '2004010385', componentName: 'Phôi lõi PPN 178-36 Nano', uom: 'PC', quantity: 1 }]],
        ]),
      },
    );
    expect(res.aggregate.find(a => a.code === '2004010385')).toMatchObject({
      demand: 9, stock: 28, shortage: 0, moq: 20, purchaseByMoq: 0,
    });
  });

  it('matches KQ test for 2010020321: 5×6 + buffer 21 = 51… (use 5×10+21=71 from test) shortage 71 → MOQ 10 → 80', () => {
    const res = calculateMrp(
      { orders: [{ code: '2003031013', qty: 5 }] },
      {
        materialByCode: new Map([
          ['2003031013', { name: 'Bộ lõi', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
          ['2010020321', { name: 'Tấm chắn T33-6HP', uom: 'PC', actualStock: 0, standardStock: 21, moq: 10 }],
        ]),
        directChildrenByCode: new Map([
          ['2003031013', [{ componentCode: '2010020321', componentName: 'Tấm chắn T33-6HP', uom: 'PC', quantity: 10 }]],
        ]),
      },
    );
    expect(res.aggregate.find(a => a.code === '2010020321')).toMatchObject({
      demand: 71, stock: 0, shortage: 71, moq: 10, purchaseByMoq: 80,
    });
  });

  it('matches KQ test for 4004050004 (Hạt ORP): 5×0.03 + buffer 1 = 1.15, stock 0 → MOQ 5 → 5', () => {
    const res = calculateMrp(
      { orders: [{ code: '2003031013', qty: 5 }] },
      {
        materialByCode: new Map([
          ['2003031013', { name: 'Bộ lõi', uom: 'PC', actualStock: 0, standardStock: 0, moq: null }],
          ['4004050004', { name: 'Hạt ORP', uom: 'KG', actualStock: 0, standardStock: 1, moq: 5 }],
        ]),
        directChildrenByCode: new Map([
          ['2003031013', [{ componentCode: '4004050004', componentName: 'Hạt ORP', uom: 'KG', quantity: 0.03 }]],
        ]),
      },
    );
    const agg = res.aggregate.find(a => a.code === '4004050004')!;
    expect(agg.demand).toBeCloseTo(1.15, 5);
    expect(agg.stock).toBe(0);
    expect(agg.purchaseByMoq).toBe(5);
  });
});
