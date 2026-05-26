import * as XLSX from 'xlsx';
import type { PreviewItem } from '@/types';

const COL = {
  materialCode: 'Material code',
  materialDescription: 'Material description',
  componentCode: 'Code Comp (B)',
  componentName: 'Component(B)',
  quantity: 'Quantity(B)',
  uom: 'UoM',
  level: 'Material description (A)',
} as const;

export interface ParsedExcel {
  materialCode: string;
  materialDescription: string;
  items: PreviewItem[];
}

export interface ParseError {
  row: number;
  message: string;
}

export async function parseBomExcel(file: File): Promise<{ data?: ParsedExcel; errors: ParseError[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const errors: ParseError[] = [];
  if (rows.length === 0) {
    return { errors: [{ row: 0, message: 'File rỗng' }] };
  }

  const materialCode = String(rows[0][COL.materialCode] ?? '').trim();
  const materialDescription = String(rows[0][COL.materialDescription] ?? '').trim();
  if (!materialCode) errors.push({ row: 2, message: 'Material code rỗng ở dòng đầu' });

  const items: PreviewItem[] = [];
  const parentStack: PreviewItem[] = [];

  rows.forEach((r, idx) => {
    const rowNumber = idx + 2; // header at row 1
    const rowMaterialCode = String(r[COL.materialCode] ?? '').trim();
    if (rowMaterialCode !== materialCode) {
      errors.push({ row: rowNumber, message: `Material code không khớp (expect ${materialCode})` });
    }

    const level = Number(r[COL.level]);
    const componentCode = String(r[COL.componentCode] ?? '').trim();
    const componentName = String(r[COL.componentName] ?? '').trim();
    const quantity = Number(r[COL.quantity]);
    const uom = String(r[COL.uom] ?? '').trim();

    if (!Number.isInteger(level) || level < 1) {
      errors.push({ row: rowNumber, message: `Level không hợp lệ (${r[COL.level]})` });
      return;
    }
    if (idx === 0 && level !== 1) errors.push({ row: rowNumber, message: 'Dòng đầu phải level=1' });
    if (level > parentStack.length + 1) {
      errors.push({ row: rowNumber, message: `Level ${level} nhảy cóc (parent level ${level - 1} chưa có)` });
      return;
    }
    if (!componentCode) errors.push({ row: rowNumber, message: 'componentCode rỗng' });
    if (!componentName) errors.push({ row: rowNumber, message: 'componentName rỗng' });
    if (!uom) errors.push({ row: rowNumber, message: 'uom rỗng' });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ row: rowNumber, message: `quantity không hợp lệ (${r[COL.quantity]})` });
    }

    const item: PreviewItem = {
      level,
      componentCode,
      componentName,
      quantity,
      uom,
      sortOrder: idx,
      parentSortOrder: level === 1 ? null : parentStack[level - 2]?.sortOrder ?? null,
    };
    parentStack[level - 1] = item;
    parentStack.length = level;
    items.push(item);
  });

  if (errors.length > 0) return { errors };
  return { data: { materialCode, materialDescription, items }, errors: [] };
}
