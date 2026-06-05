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

// Decide commercial vs production split.
//
//   isLeaf   → no BOM → physically cannot produce → commercial is forced
//              to (override>0 ? override : demand); purchaseType is ignored
//              (a leaf marked NO is treated as commercial because there's no
//              way to make it in-house).
//   REQUIRED → must buy externally → productionQty LOCKED at 0; commercial
//              defaults to full demand.
//   NO       → cannot buy externally → commercialQty LOCKED at 0;
//              productionQty = demand (must make in-house).
//   OPTIONAL → prefer in-house → commercial defaults to 0 (or user override);
//              productionQty = demand - commercial (clamped ≥0).
function decideQuantities(
  purchaseType: PurchaseType,
  demand: number,
  override: number | undefined,
  isLeaf: boolean,
): { commercialQty: number; productionQty: number } {
  if (isLeaf) {
    // Treat 0 override as "use default" — orders default commercialQty to 0
    // from the client, which would otherwise produce demand-unsatisfied rows.
    const commercialQty = override && override > 0 ? override : demand;
    return { commercialQty, productionQty: 0 };
  }
  if (purchaseType === 'NO') {
    return { commercialQty: 0, productionQty: demand };
  }
  if (purchaseType === 'REQUIRED') {
    return { commercialQty: override ?? demand, productionQty: 0 };
  }
  const commercialQty = override ?? 0;
  return {
    commercialQty,
    productionQty: Math.max(demand - commercialQty, 0),
  };
}

export function calculateMrp(
  input: MrpInput,
  deps: MrpDeps,
): MrpCalculateResponse {
  const warnings: MrpWarning[] = [];
  const priorCommercialByCode = new Map<string, number>();
  const seenMissing = new Set<string>();
  // Track REMAINING actualStock per code as it gets consumed level by level.
  // A material may appear at multiple BOM levels; we want the math to net
  // stock+buffer only ONCE across all occurrences, but also let leftover
  // stock from an early level cover demand at deeper levels.
  //   Initialized lazily on first observation to m.actualStock.
  //   Depleted by each level's draw (incoming + buffer, minus priorCommercial).
  const remainingStockByCode = new Map<string, number>();
  // Codes whose safety buffer has already been included in a prior level —
  // subsequent levels must NOT add it again (we only want to refill the
  // buffer once across the whole BOM rollup).
  const bufferAppliedByCode = new Set<string>();

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
      if (!remainingStockByCode.has(o.code)) {
        remainingStockByCode.set(o.code, m.actualStock);
      }
      const remaining = remainingStockByCode.get(o.code)!;
      const stockBuffer = m.standardStock;
      const totalNeed = o.qty + stockBuffer;
      const demand = Math.max(totalNeed - remaining, 0);
      // Deplete leftover stock for any deeper-level reuse of this code.
      remainingStockByCode.set(o.code, Math.max(remaining - totalNeed, 0));
      bufferAppliedByCode.add(o.code);
      const isLeaf = !hasBom(o.code);
      const { commercialQty, productionQty } = decideQuantities(
        m.purchaseType,
        demand,
        o.commercialQty,
        isLeaf,
      );
      priorCommercialByCode.set(
        o.code,
        (priorCommercialByCode.get(o.code) ?? 0) + commercialQty,
      );
      return {
        code: o.code,
        name: m.name || o.code,
        uom: m.uom,
        incoming: o.qty,
        actualStock: remaining,
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
        //   effectiveStock = remainingStock + Σ commercial at previous levels
        // Stock is tracked as a *remaining* balance that depletes across
        // levels, so a material used at multiple BOM levels gets stock netted
        // exactly once cumulatively (not duplicated, but also not lost when
        // there's leftover after the first level).
        // Buffer (standardStock) is applied at most once across all levels —
        // either via bufferAppliedByCode here or implicitly via priorCommercial.
        const priorCommercial = priorCommercialByCode.get(code) ?? 0;
        if (!remainingStockByCode.has(code)) {
          remainingStockByCode.set(code, m.actualStock);
        }
        const remaining = remainingStockByCode.get(code)!;
        const bufferAlreadyApplied = bufferAppliedByCode.has(code);
        const stockBuffer =
          bufferAlreadyApplied || priorCommercial > 0 ? 0 : m.standardStock;
        const effectiveStock = remaining + priorCommercial;
        const totalNeed = info.incoming + stockBuffer;
        const demand = Math.max(totalNeed - effectiveStock, 0);
        // Deplete remaining stock for any deeper-level reuse of this code.
        // priorCommercial supply is consumed first (treat as virtual external
        // inventory); whatever the level still needs draws from `remaining`.
        const drawFromRemaining = Math.min(
          Math.max(totalNeed - priorCommercial, 0),
          remaining,
        );
        remainingStockByCode.set(code, remaining - drawFromRemaining);
        bufferAppliedByCode.add(code);

        // Commercial / production split — see decideQuantities. Leaves
        // (no BOM) are auto-commercial regardless of purchaseType because
        // they can't be produced in-house.
        const isLeaf = !hasBom(code);
        const override = input.commercialOverrides?.find(
          (o) => o.code === code && o.level === currentLevel + 1,
        );
        const { commercialQty, productionQty } = decideQuantities(
          m.purchaseType,
          demand,
          override?.commercialQty,
          isLeaf,
        );
        priorCommercialByCode.set(code, priorCommercial + commercialQty);
        return {
          code,
          name: m.name || info.firstChildName || code,
          uom: m.uom,
          incoming: info.incoming,
          // Show the *remaining* stock at start of this level — visualises the
          // depletion across cascaded levels.
          actualStock: remaining,
          standardStock: bufferAlreadyApplied ? 0 : m.standardStock,
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

  // Aggregate (purchase rollup) — only materials with commercial > 0 across
  // all levels, i.e. things actually being bought. Items produced 100%
  // in-house (commercial=0) are intentionally excluded; production columns
  // remain so mixed buy+make items still surface both quantities.
  //   totalPurchase    = Σ demand        (in-house production + commercial purchase)
  //   commercialTotal  = Σ commercialQty (what we actually buy)
  //   productionTotal  = Σ productionQty (what we produce in-house)
  //   purchaseByMoq    = MOQ-rounded commercialTotal (= commercial when no MOQ set)
  const aggMap = new Map<
    string,
    {
      name: string;
      uom: string;
      demand: number;
      commercial: number;
      production: number;
      moq: number | null;
    }
  >();
  byLevel.forEach((lvl) => {
    lvl.rows.forEach((r) => {
      const cur = aggMap.get(r.code) ?? {
        name: r.name,
        uom: r.uom,
        demand: 0,
        commercial: 0,
        production: 0,
        moq: r.moq,
      };
      cur.demand += r.demand;
      cur.commercial += r.commercialQty;
      cur.production += r.productionQty;
      aggMap.set(r.code, cur);
    });
  });
  const aggregate = Array.from(aggMap.entries())
    .filter(([, v]) => v.commercial > 0)
    .map(([code, v]) => ({
      code,
      name: v.name,
      uom: v.uom,
      totalPurchase: v.demand,
      commercialTotal: v.commercial,
      productionTotal: v.production,
      moq: v.moq,
      // MOQ rounds the *commercial* portion only — production stays in-house, no purchase.
      purchaseByMoq:
        v.commercial > 0 && v.moq
          ? Math.ceil(v.commercial / v.moq) * v.moq
          : v.commercial,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { byLevel, aggregate, warnings };
}
