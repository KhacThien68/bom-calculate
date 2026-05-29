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
