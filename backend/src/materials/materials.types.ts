export type MaterialDiffStatus = 'new' | 'changed' | 'unchanged' | 'removed';

export type PurchaseType = 'REQUIRED' | 'NO' | 'OPTIONAL';

export interface MaterialDiffRow {
  status: MaterialDiffStatus;
  code: string;
  name: string;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  purchaseType: PurchaseType;
  oldValues?: {
    name: string;
    uom: string;
    actualStock: number;
    standardStock: number;
    moq: number | null;
    purchaseType: PurchaseType;
  };
}

export interface MaterialDiffSummary {
  new: number;
  changed: number;
  unchanged: number;
  removed: number;
}

export interface MaterialDiffResponse {
  previewToken: string;
  summary: MaterialDiffSummary;
  items: MaterialDiffRow[];
}

export interface CachedMaterialPreview {
  mode: 'full' | 'append';
  items: Array<{
    code: string;
    name: string;
    uom: string;
    actualStock: number;
    standardStock: number;
    moq: number | null;
    purchaseType: PurchaseType;
  }>;
  expiresAt: number;
}
