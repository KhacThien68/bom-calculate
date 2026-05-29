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

const STOCK_COL = {
  code: 'Code',
  actualInventory: 'Actual inventory',
  standardInventory: 'Standard inventory',
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

function parseStockSheet(wb: XLSX.WorkBook): Map<string, { actualStock: number; standardStock: number }> {
  const stockMap = new Map<string, { actualStock: number; standardStock: number }>();

  // Look for a sheet that contains stock data (not the first BOM sheet)
  for (let i = 0; i < wb.SheetNames.length; i++) {
    const ws = wb.Sheets[wb.SheetNames[i]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (rows.length === 0) continue;

    // Check if this sheet has the stock columns
    const firstRow = rows[0];
    if (!(STOCK_COL.code in firstRow) || !(STOCK_COL.actualInventory in firstRow)) continue;

    for (const r of rows) {
      const code = String(r[STOCK_COL.code] ?? '').trim();
      if (!code) continue;
      const actualStock = Number(r[STOCK_COL.actualInventory]) || 0;
      const standardStock = Number(r[STOCK_COL.standardInventory]) || 0;
      stockMap.set(code, { actualStock, standardStock });
    }
    break; // Found the stock sheet
  }

  return stockMap;
}

export async function parseBomExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Parse stock from separate sheet
  const stockMap = parseStockSheet(wb);

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

    // Look up stock from stock sheet by componentCode
    const stockData = stockMap.get(componentCode);
    const actualStock = stockData?.actualStock ?? 0;
    const standardStock = stockData?.standardStock ?? 0;

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
      actualStock,
      standardStock,
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

export async function parseMaterialExcel(file: File): Promise<MaterialRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
  return rows.map((r) => ({
    code: String(r['Mã'] ?? r['code'] ?? '').trim(),
    name: String(r['Tên'] ?? r['name'] ?? '').trim(),
    uom: String(r['ĐVT'] ?? r['uom'] ?? '').trim(),
    actualStock: Number(r['Tồn'] ?? r['actualStock'] ?? 0),
    standardStock: Number(r['Tồn ĐM'] ?? r['standardStock'] ?? 0),
    moq: r['MOQ'] != null && r['MOQ'] !== '' ? Number(r['MOQ']) : null,
  })).filter(r => r.code !== '');
}
