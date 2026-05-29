import { MAX_DEPTH, MrpDeps, MrpCalculateResponse, MrpInput, MrpLevel, MrpRow, MrpWarning } from './mrp.types';

const DEFAULT_MATERIAL = { name: '', uom: 'PC', actualStock: 0, standardStock: 0, moq: null };

export function calculateMrp(input: MrpInput, deps: MrpDeps): MrpCalculateResponse {
  const warnings: MrpWarning[] = [];
  const priorCommercialByCode = new Map<string, number>();
  const seenMissing = new Set<string>();

  const lookup = (code: string) => {
    const m = deps.materialByCode.get(code);
    if (!m) {
      if (!seenMissing.has(code)) {
        warnings.push({ type: 'missing_material', code, message: `Material "${code}" not found in master` });
        seenMissing.add(code);
      }
      return { ...DEFAULT_MATERIAL, name: code };
    }
    return m;
  };

  const hasBom = (code: string) => (deps.directChildrenByCode.get(code)?.length ?? 0) > 0;

  // Level 0
  const level0Rows: MrpRow[] = input.orders
    .filter(o => o.qty > 0)
    .map(o => {
      const m = lookup(o.code);
      const commercialQty = o.commercialQty ?? 0;
      const stockBuffer = m.standardStock;
      const demand = Math.max(o.qty + stockBuffer - m.actualStock, 0);
      const productionQty = Math.max(demand - commercialQty, 0);
      priorCommercialByCode.set(o.code, (priorCommercialByCode.get(o.code) ?? 0) + commercialQty);
      return {
        code: o.code, name: m.name || o.code, uom: m.uom,
        incoming: o.qty, actualStock: m.actualStock, standardStock: m.standardStock, moq: m.moq,
        stockBuffer, demand, commercialQty, productionQty, hasBom: hasBom(o.code),
      };
    });

  const byLevel: MrpLevel[] = [{ level: 0, rows: level0Rows }];

  // Track codes that have been expanded as BOM parents (used for cycle detection)
  const expandedAsParent = new Set<string>();

  let currentLevel = 0;
  while (true) {
    const parents = byLevel[currentLevel].rows.filter(r => r.productionQty > 0 && r.hasBom);
    if (parents.length === 0) break;
    if (currentLevel + 1 > MAX_DEPTH) {
      warnings.push({ type: 'max_depth', message: `Stopped at depth ${MAX_DEPTH}` });
      break;
    }

    const incomingByCode = new Map<string, { incoming: number; firstChildName: string; firstChildUom: string }>();
    parents.forEach(parent => {
      expandedAsParent.add(parent.code);
      const children = deps.directChildrenByCode.get(parent.code) ?? [];
      children.forEach(child => {
        // Cycle: child has already been expanded as a parent at a prior level
        if (expandedAsParent.has(child.componentCode)) {
          warnings.push({ type: 'cycle', code: child.componentCode, message: `Cycle detected: ${parent.code} → ${child.componentCode}` });
          return;
        }
        const cur = incomingByCode.get(child.componentCode) ?? { incoming: 0, firstChildName: child.componentName, firstChildUom: child.uom };
        cur.incoming += parent.productionQty * child.quantity;
        incomingByCode.set(child.componentCode, cur);
      });
    });

    if (incomingByCode.size === 0) break;

    const rows: MrpRow[] = Array.from(incomingByCode.entries()).map(([code, info]) => {
      const m = deps.materialByCode.get(code) ?? { ...DEFAULT_MATERIAL, name: info.firstChildName, uom: info.firstChildUom };
      if (!deps.materialByCode.get(code) && !seenMissing.has(code)) {
        warnings.push({ type: 'missing_material', code, message: `Material "${code}" not found in master` });
        seenMissing.add(code);
      }
      const override = input.commercialOverrides?.find(o => o.code === code && o.level === currentLevel + 1);
      const commercialQty = override?.commercialQty ?? 0;
      const priorCommercial = priorCommercialByCode.get(code) ?? 0;
      const stockBuffer = priorCommercial > 0 ? 0 : m.standardStock;
      const demand = Math.max(info.incoming + stockBuffer - m.actualStock, 0);
      const productionQty = Math.max(demand - commercialQty, 0);
      priorCommercialByCode.set(code, priorCommercial + commercialQty);
      return {
        code, name: m.name || info.firstChildName || code, uom: m.uom,
        incoming: info.incoming, actualStock: m.actualStock, standardStock: m.standardStock, moq: m.moq,
        stockBuffer, demand, commercialQty, productionQty, hasBom: hasBom(code),
      };
    });

    byLevel.push({ level: currentLevel + 1, rows });
    currentLevel++;
  }

  // Aggregate (gross requirements):
  //   For each code that appears as a child anywhere in the BOM explosion (level >= 1),
  //   sum the propagated `incoming` qty across all levels, then:
  //     demand        = totalQty + standardStock           (Nhu cầu S+I2)
  //     shortage      = max(demand - actualStock, 0)        (Cần mua trước MOQ)
  //     purchaseByMoq = MOQ-rounded shortage                (Cần Mua Thêm)
  //   Level 0 rows (the orders themselves) are skipped — the user already knows
  //   what they ordered; the aggregate exists to surface downstream requirements.
  const grossByCode = new Map<string, {
    name: string; uom: string; totalQty: number;
    actualStock: number; standardStock: number; moq: number | null;
  }>();
  byLevel.forEach(lvl => {
    if (lvl.level === 0) return;
    lvl.rows.forEach(r => {
      const cur = grossByCode.get(r.code) ?? {
        name: r.name, uom: r.uom, totalQty: 0,
        actualStock: r.actualStock, standardStock: r.standardStock, moq: r.moq,
      };
      cur.totalQty += r.incoming;
      grossByCode.set(r.code, cur);
    });
  });
  const aggregate = Array.from(grossByCode.entries())
    .map(([code, v]) => {
      const demand = v.totalQty + v.standardStock;
      const shortage = Math.max(demand - v.actualStock, 0);
      const purchaseByMoq = v.moq ? Math.ceil(shortage / v.moq) * v.moq : shortage;
      return {
        code, name: v.name, uom: v.uom,
        demand,
        stock: v.actualStock,
        shortage,
        moq: v.moq,
        purchaseByMoq,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return { byLevel, aggregate, warnings };
}
