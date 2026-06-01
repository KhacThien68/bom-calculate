export type MaterialDiffStatus = 'new' | 'changed' | 'unchanged' | 'removed';

export interface MaterialDiffRow {
  status: MaterialDiffStatus;
  code: string;
  name: string;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
  oldValues?: {
    name: string;
    uom: string;
    actualStock: number;
    standardStock: number;
    moq: number | null;
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
  }>;
  expiresAt: number;
}
