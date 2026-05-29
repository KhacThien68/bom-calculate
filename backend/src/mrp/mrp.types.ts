export interface MrpRow {
  code: string;
  name: string;
  uom: string;
  incoming: number;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  stockBuffer: number;
  demand: number;
  commercialQty: number;
  productionQty: number;
  hasBom: boolean;
}

export interface MrpLevel {
  level: number;
  rows: MrpRow[];
}

export interface MrpAggregateRow {
  code: string;
  name: string;
  uom: string;
  totalPurchase: number; // AT — Σ commercialQty across all levels (auto for leaves, manual override for non-leaves)
  moq: number | null;
  purchaseByMoq: number; // AU — MOQ-rounded totalPurchase
}

export type MrpWarningType = 'cycle' | 'missing_material' | 'max_depth';

export interface MrpWarning {
  type: MrpWarningType;
  message: string;
  code?: string;
}

export interface MrpCalculateResponse {
  byLevel: MrpLevel[];
  aggregate: MrpAggregateRow[];
  warnings: MrpWarning[];
}

export interface MrpInput {
  orders: Array<{ code: string; qty: number; commercialQty?: number }>;
  commercialOverrides?: Array<{ code: string; level: number; commercialQty: number }>;
}

export interface MrpDeps {
  materialByCode: Map<string, { name: string; uom: string; actualStock: number; standardStock: number; moq: number | null }>;
  // For each parent code (top product OR sub-assembly), the list of direct children
  // with their RAW Qty_B (`rawQty`) and the parent's batch qty (`parentBatchQty`).
  // Coefficient per immediate parent = rawQty / parentBatchQty.
  directChildrenByCode: Map<string, Array<{
    componentCode: string;
    componentName: string;
    uom: string;
    rawQty: number;
    parentBatchQty: number;
  }>>;
}

export const MAX_DEPTH = 20;
