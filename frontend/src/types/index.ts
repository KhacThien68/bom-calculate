export type Role = 'ADMIN' | 'USER';

export interface Me {
  id: number;
  username: string;
  name: string | null;
  role: Role;
}

export interface BomListItem {
  id: number;
  materialCode: string;
  materialDescription: string;
  updatedAt: string;
  itemCount: number;
}

export interface BomItem {
  id: number;
  parentId: number | null;
  componentCode: string;
  componentName: string;
  quantity: number;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  level: number;
  sortOrder: number;
}

export interface BomDetail {
  id: number;
  materialCode: string;
  materialDescription: string;
  updatedAt: string;
  items: BomItem[];
}

export interface PreviewItem {
  level: number;
  componentCode: string;
  componentName: string;
  quantity: number;
  uom: string;
  actualStock: number;
  standardStock: number;
  sortOrder: number;
  parentSortOrder: number | null;
}

export type DiffStatus = 'new' | 'changed' | 'unchanged' | 'removed';

export interface DiffItem {
  status: DiffStatus;
  level: number;
  componentCode: string;
  componentName: string;
  quantity: number;
  uom: string;
  actualStock: number;
  standardStock: number;
  parentPath: string[];
  oldValues?: { componentName: string; quantity: number; uom: string; actualStock: number; standardStock: number };
}

export interface DiffResponse {
  previewToken: string;
  bomExists: boolean;
  summary: { new: number; changed: number; unchanged: number; removed: number };
  items: DiffItem[];
}

export interface Material {
  id: number;
  code: string;
  name: string;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  updatedAt: string;
}

export interface MaterialListResponse {
  total: number;
  items: Material[];
}

export interface MaterialDiffRow {
  status: 'new' | 'changed' | 'unchanged' | 'removed';
  code: string;
  name: string;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  oldValues?: { name: string; uom: string; actualStock: number; standardStock: number; moq: number | null };
}

export interface MaterialDiffResponse {
  previewToken: string;
  summary: { new: number; changed: number; unchanged: number; removed: number };
  items: MaterialDiffRow[];
}

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
  totalPurchase: number;
  moq: number | null;
  purchaseByMoq: number;
}

export interface MrpWarning {
  type: 'cycle' | 'missing_material' | 'max_depth';
  code?: string;
  message: string;
}

export interface MrpCalculateResponse {
  byLevel: MrpLevel[];
  aggregate: MrpAggregateRow[];
  warnings: MrpWarning[];
}

export interface MrpCalculateRequest {
  orders: Array<{ code: string; qty: number; commercialQty?: number }>;
  commercialOverrides?: Array<{ code: string; level: number; commercialQty: number }>;
}
