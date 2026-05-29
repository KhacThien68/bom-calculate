import { calculateMrp } from './mrp-engine';

describe('MRP Excel parity (subset)', () => {
  it('matches Excel sample for code 2003031013 with order=50, commercial=10', () => {
    const res = calculateMrp(
      { orders: [{ code: '2003031013', qty: 50, commercialQty: 10 }] },
      {
        materialByCode: new Map([
          ['2003031013', { name: 'Bộ lõi', uom: 'PC', actualStock: 3, standardStock: 2, moq: 5 }],
          ['2004010385', { name: 'Phôi lõi PPN 178-36 Nano', uom: 'PC', actualStock: 0, standardStock: 0, moq: 5 }],
        ]),
        directChildrenByCode: new Map([
          ['2003031013', [{ componentCode: '2004010385', componentName: 'Phôi lõi PPN 178-36 Nano', uom: 'PC', quantity: 1 }]],
        ]),
      },
    );
    expect(res.byLevel[0].rows[0]).toMatchObject({ demand: 49, productionQty: 39 });
    expect(res.byLevel[1].rows.find(r => r.code === '2004010385')).toMatchObject({ incoming: 39, demand: 39 });
  });
});
