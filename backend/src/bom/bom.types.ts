export type ItemStatus = 'new' | 'changed' | 'unchanged' | 'removed';
export type UploadMode = 'full' | 'append';

export interface PreviewItemInput {
  level: number;
  componentCode: string;
  componentName: string;
  quantity: number;
  uom: string;
  sortOrder: number;
  parentSortOrder: number | null;
}

export interface DiffResultItem {
  status: ItemStatus;
  level: number;
  componentCode: string;
  componentName: string;
  quantity: number;
  uom: string;
  parentPath: string[];
  oldValues?: { componentName: string; quantity: number; uom: string };
}

export interface DiffSummary {
  new: number;
  changed: number;
  unchanged: number;
  removed: number;
}

export interface DiffResponse {
  previewToken: string;
  bomExists: boolean;
  summary: DiffSummary;
  items: DiffResultItem[];
}

export interface CachedPreview {
  materialCode: string;
  materialDescription: string;
  topBatchQty: number;
  mode: UploadMode;
  items: PreviewItemInput[];
  diff: DiffResponse;
  expiresAt: number;
}
