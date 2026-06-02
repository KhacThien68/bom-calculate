import {
  MAX_DEPTH,
  MrpDeps,
  MrpCalculateResponse,
  MrpInput,
  MrpLevel,
  MrpRow,
  MrpWarning,
  PurchaseType,
} from './mrp.types';

const DEFAULT_MATERIAL = {
  name: '',
  uom: 'PC',
  actualStock: 0,
  standardStock: 0,
  moq: null,
  purchaseType: 'OPTIONAL' as PurchaseType,
};

// Production-priority rule:
//   REQUIRED → must buy        → commercialQty = demand
//   NO       → never buy       → commercialQty = 0
//   OPTIONAL → prefer produce  → commercialQty = 0 (user can override per row)
function defaultCommercialQty(
  purchaseType: PurchaseType,
  demand: number,
): number {
  return purchaseType === 'REQUIRED' ? demand : 0;
}

export function calculateMrp(
  input: MrpInput,
  deps: MrpDeps,
): MrpCalculateResponse {
  const warnings: MrpWarning[] = [];
  const priorCommercialByCode = new Map<string, number>();
  const seenMissing = new Set<string>();

  const lookup = (code: string) => {
    const m = deps.materialByCode.get(code);
    if (!m) {
      if (!seenMissing.has(code)) {
        warnings.push({
          type: 'missing_material',
          code,
          message: `Material "${code}" not found in master`,
        });
        seenMissing.add(code);
      }
      return { ...DEFAULT_MATERIAL, name: code };
    }
    return m;
  };

  const hasBom = (code: string) =>
    (deps.directChildrenByCode.get(code)?.length ?? 0) > 0;

  // Level 0
  // - demand = order qty + buffer - actualStock (Excel R7 = O+Q-P, no commercial check)
  // - commercial defaults to user input; if order is for a leaf (raw material order
  //   without BoM), auto-commercial = demand because there's nothing to produce.
  const level0Rows: MrpRow[] = input.orders
    .filter((o) => o.qty > 0)
    .map((o) => {
      const m = lookup(o.code);
      const stockBuffer = m.standardStock;
      const demand = Math.max(o.qty + stockBuffer - m.actualStock, 0);
      const isLeaf = !hasBom(o.code);
      const commercialQty =
        o.commercialQty !== undefined
          ? o.commercialQty
          : defaultCommercialQty(m.purchaseType, demand);
      const productionQty = Math.max(demand - commercialQty, 0);
      priorCommercialByCode.set(
        o.code,
        (priorCommercialByCode.get(o.code) ?? 0) + commercialQty,
      );
      return {
        code: o.code,
        name: m.name || o.code,
        uom: m.uom,
        incoming: o.qty,
        actualStock: m.actualStock,
        standardStock: m.standardStock,
        moq: m.moq,
        purchaseType: m.purchaseType,
        stockBuffer,
        demand,
        commercialQty,
        productionQty,
        hasBom: !isLeaf,
      };
    });

  const byLevel: MrpLevel[] = [{ level: 0, rows: level0Rows }];

  // Track codes that have been expanded as BOM parents (used for cycle detection)
  const expandedAsParent = new Set<string>();

  let currentLevel = 0;
  while (true) {
    const parents = byLevel[currentLevel].rows.filter(
      (r) => r.productionQty > 0 && r.hasBom,
    );
    if (parents.length === 0) break;
    if (currentLevel + 1 > MAX_DEPTH) {
      warnings.push({
        type: 'max_depth',
        message: `Stopped at depth ${MAX_DEPTH}`,
      });
      break;
    }

    const incomingByCode = new Map<
      string,
      { incoming: number; firstChildName: string; firstChildUom: string }
    >();
    parents.forEach((parent) => {
      expandedAsParent.add(parent.code);
      const children = deps.directChildrenByCode.get(parent.code) ?? [];
      children.forEach((child) => {
        // Cycle: child has already been expanded as a parent at a prior level
        if (expandedAsParent.has(child.componentCode)) {
          warnings.push({
            type: 'cycle',
            code: child.componentCode,
            message: `Cycle detected: ${parent.code} → ${child.componentCode}`,
          });
          return;
        }
        // Coefficient per immediate parent = child.rawQty / child.parentBatchQty.
        // (For level=1 children, parentBatchQty = Bom.topBatchQty; for level≥2 children,
        // parentBatchQty = parent BomItem.quantity raw.)
        const coef =
          child.parentBatchQty && child.parentBatchQty !== 0
            ? child.rawQty / child.parentBatchQty
            : child.rawQty;
        const cur = incomingByCode.get(child.componentCode) ?? {
          incoming: 0,
          firstChildName: child.componentName,
          firstChildUom: child.uom,
        };
        cur.incoming += parent.productionQty * coef;
        incomingByCode.set(child.componentCode, cur);
      });
    });

    if (incomingByCode.size === 0) break;

    const rows: MrpRow[] = Array.from(incomingByCode.entries()).map(
      ([code, info]) => {
        const m = deps.materialByCode.get(code) ?? {
          ...DEFAULT_MATERIAL,
          name: info.firstChildName,
          uom: info.firstChildUom,
        };
        if (!deps.materialByCode.get(code) && !seenMissing.has(code)) {
          warnings.push({
            type: 'missing_material',
            code,
            message: `Material "${code}" not found in master`,
          });
          seenMissing.add(code);
        }
        // Net requirements with stock-netting against prior-level commercial:
        // effectiveStock = actualStock + Σ commercial at previous levels for this code
        // (Excel: AE = W + AA, etc.)
        const priorCommercial = priorCommercialByCode.get(code) ?? 0;
        const effectiveStock = m.actualStock + priorCommercial;
        const stockBuffer = priorCommercial > 0 ? 0 : m.standardStock;
        const demand = Math.max(
          info.incoming + stockBuffer - effectiveStock,
          0,
        );

        // Commercial decision (production-priority):
        //   override > REQUIRED→buy > NO/OPTIONAL→produce
        // A leaf marked OPTIONAL/NO will surface productionQty=demand even though
        // it has no BOM — user must promote to REQUIRED or override.
        const isLeaf = !hasBom(code);
        const override = input.commercialOverrides?.find(
          (o) => o.code === code && o.level === currentLevel + 1,
        );
        const commercialQty =
          override !== undefined
            ? override.commercialQty
            : defaultCommercialQty(m.purchaseType, demand);
        const productionQty = Math.max(demand - commercialQty, 0);
        priorCommercialByCode.set(code, priorCommercial + commercialQty);
        return {
          code,
          name: m.name || info.firstChildName || code,
          uom: m.uom,
          incoming: info.incoming,
          actualStock: m.actualStock,
          standardStock: m.standardStock,
          moq: m.moq,
          purchaseType: m.purchaseType,
          stockBuffer,
          demand,
          commercialQty,
          productionQty,
          hasBom: !isLeaf,
        };
      },
    );

    byLevel.push({ level: currentLevel + 1, rows });
    currentLevel++;
  }

  // Aggregate (commercial split — matches Excel cols AT/AU):
  //   AT = Σ commercialQty per code across all levels (including level 0 commercial)
  //   AU = MOQ-rounded AT
  // Only codes with commercial > 0 appear (no point listing items we're producing in-house).
  const aggMap = new Map<
    string,
    { name: string; uom: string; total: number; moq: number | null }
  >();
  byLevel.forEach((lvl) => {
    lvl.rows.forEach((r) => {
      const cur = aggMap.get(r.code) ?? {
        name: r.name,
        uom: r.uom,
        total: 0,
        moq: r.moq,
      };
      cur.total += r.commercialQty;
      aggMap.set(r.code, cur);
    });
  });
  const aggregate = Array.from(aggMap.entries())
    .filter(([, v]) => v.total > 0)
    .map(([code, v]) => ({
      code,
      name: v.name,
      uom: v.uom,
      totalPurchase: v.total,
      moq: v.moq,
      purchaseByMoq: v.moq ? Math.ceil(v.total / v.moq) * v.moq : v.total,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { byLevel, aggregate, warnings };
}
