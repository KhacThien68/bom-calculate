import * as XLSX from 'xlsx';
import type { PreviewItem, MrpCalculateResponse } from '@/types';

const COL = {
  materialCode: 'Material code',
  materialDescription: 'Material description',
  componentCode: 'Code Comp (B)',
  componentName: 'Component(B)',
  quantity: 'Quantity(B)',
  uom: 'UoM',
  level: 'Material description (A)',
} as const;

export interface ParsedBom {
  materialCode: string;
  materialDescription: string;
  items: PreviewItem[];
}

export interface ParseError {
  row: number;
  materialCode?: string;
  message: string;
}

export interface ParseResult {
  boms: ParsedBom[];
  errors: ParseError[];
}

export async function parseBomExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Parse BOM from first sheet (or the sheet with BOM columns)
  let bomSheet: XLSX.WorkSheet | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (rows.length > 0 && COL.materialCode in rows[0]) {
      bomSheet = ws;
      break;
    }
  }

  if (!bomSheet) {
    return { boms: [], errors: [{ row: 0, message: 'Không tìm thấy sheet BOM hợp lệ' }] };
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(bomSheet, { defval: '' });
  const errors: ParseError[] = [];

  if (rows.length === 0) {
    return { boms: [], errors: [{ row: 0, message: 'File rỗng' }] };
  }

  const boms: ParsedBom[] = [];
  const seenCodes = new Set<string>();

  let current: ParsedBom | null = null;
  let parentStack: PreviewItem[] = [];
  let sortCounter = 0;

  rows.forEach((r, idx) => {
    const rowNumber = idx + 2;
    const materialCode = String(r[COL.materialCode] ?? '').trim();
    const materialDescription = String(r[COL.materialDescription] ?? '').trim();

    if (!materialCode) {
      errors.push({ row: rowNumber, message: 'Material code rỗng' });
      return;
    }

    if (!current || current.materialCode !== materialCode) {
      if (seenCodes.has(materialCode)) {
        errors.push({
          row: rowNumber,
          materialCode,
          message: `Material code ${materialCode} bị tách thành nhiều khối không liên tiếp`,
        });
        return;
      }
      current = { materialCode, materialDescription, items: [] };
      boms.push(current);
      seenCodes.add(materialCode);
      parentStack = [];
      sortCounter = 0;
    }

    const level = Number(r[COL.level]);
    const componentCode = String(r[COL.componentCode] ?? '').trim();
    const componentName = String(r[COL.componentName] ?? '').trim();
    const rawQuantity = r[COL.quantity];
    const quantity = Number(rawQuantity);
    const uom = String(r[COL.uom] ?? '').trim();

    if (!Number.isInteger(level) || level < 1) {
      errors.push({ row: rowNumber, materialCode, message: `Level không hợp lệ (${r[COL.level]})` });
      return;
    }
    if (current.items.length === 0 && level !== 1) {
      errors.push({ row: rowNumber, materialCode, message: 'Dòng đầu của BOM phải level=1' });
    }
    if (level > parentStack.length + 1) {
      errors.push({
        row: rowNumber,
        materialCode,
        message: `Level ${level} nhảy cóc (parent level ${level - 1} chưa có)`,
      });
      return;
    }
    if (!componentCode) errors.push({ row: rowNumber, materialCode, message: 'componentCode rỗng' });
    if (!componentName) errors.push({ row: rowNumber, materialCode, message: 'componentName rỗng' });
    if (!uom) errors.push({ row: rowNumber, materialCode, message: 'uom rỗng' });
    if (!Number.isFinite(quantity)) {
      errors.push({ row: rowNumber, materialCode, message: `quantity không hợp lệ (${rawQuantity})` });
    }

    const item: PreviewItem = {
      level,
      componentCode,
      componentName,
      quantity,
      uom,
      sortOrder: sortCounter++,
      parentSortOrder: level === 1 ? null : parentStack[level - 2]?.sortOrder ?? null,
    };
    parentStack[level - 1] = item;
    parentStack.length = level;
    current.items.push(item);
  });

  return { boms, errors };
}

export interface MaterialRow {
  code: string;
  name: string;
  uom: string;
  actualStock: number;
  standardStock: number;
  moq: number | null;
}

function toFiniteNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string' && v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickCell(row: Record<string, unknown>, candidates: string[]): unknown {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const lookup = new Map<string, unknown>();
  Object.entries(row).forEach(([k, v]) => lookup.set(norm(k), v));
  for (const c of candidates) {
    const v = lookup.get(norm(c));
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) return v;
  }
  return undefined;
}

export async function parseMaterialExcel(file: File): Promise<MaterialRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows.map((r) => ({
    code: String(pickCell(r, ['Mã', 'Mã vật tư', 'Code', 'code']) ?? '').trim(),
    name: String(pickCell(r, ['Tên', 'Tên vật tư', 'Material/Component description', 'name', 'description']) ?? '').trim(),
    uom: String(pickCell(r, ['ĐVT', 'DVT', 'UoM', 'UOM', 'uom']) ?? '').trim(),
    actualStock: toFiniteNumber(pickCell(r, ['Tồn', 'Ton', 'Actual inventory', 'actualStock'])),
    standardStock: toFiniteNumber(pickCell(r, ['Tồn ĐM', 'Ton DM', 'Standard inventory', 'standardStock', 'I2'])),
    moq: toOptionalNumber(pickCell(r, ['MOQ', 'moq'])),
  })).filter(r => r.code !== '');
}

export async function exportMrpExcel(result: MrpCalculateResponse): Promise<void> {
  const detail = result.byLevel.flatMap(lvl =>
    lvl.rows.map(r => ({
      Cấp: lvl.level,
      Mã: r.code,
      Tên: r.name,
      ĐVT: r.uom,
      'Nhu cầu BoM': r.incoming,
      Tồn: r.actualStock,
      'Tồn ĐM phải bù': r.stockBuffer,
      'Nhu cầu': r.demand,
      'Thương mại': r.commercialQty,
      'Sản xuất': r.productionQty,
      'Có BoM?': r.hasBom ? 'Yes' : 'No',
    })),
  );
  const wsDetail = XLSX.utils.json_to_sheet(detail);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết theo cấp');

  const agg = result.aggregate.map((r, idx) => ({
    STT: idx + 1,
    'Mã vật tư': r.code,
    'Tên vật tư': r.name,
    'ĐVT': r.uom,
    'Tổng mua': r.totalPurchase,
    MOQ: r.moq ?? '',
    'Mua theo MOQ': r.purchaseByMoq,
  }));
  const wsAgg = XLSX.utils.json_to_sheet(agg);
  XLSX.utils.book_append_sheet(wb, wsAgg, 'Tổng hợp mua');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
  XLSX.writeFile(wb, `MRP_${stamp}.xlsx`);
}
