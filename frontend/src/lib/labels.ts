import type { PurchaseType } from '@/types';

export const PURCHASE_TYPE_LABEL: Record<PurchaseType, string> = {
  REQUIRED: 'Bắt buộc',
  NO: 'Không',
  OPTIONAL: 'Có thể mua',
};

export const PURCHASE_TYPE_OPTIONS: Array<{
  value: PurchaseType;
  label: string;
}> = [
  { value: 'OPTIONAL', label: PURCHASE_TYPE_LABEL.OPTIONAL },
  { value: 'REQUIRED', label: PURCHASE_TYPE_LABEL.REQUIRED },
  { value: 'NO', label: PURCHASE_TYPE_LABEL.NO },
];

// Excel cell value → PurchaseType. Falls back to OPTIONAL if unrecognized.
export function parsePurchaseTypeCell(v: unknown): PurchaseType {
  if (v === null || v === undefined) return 'OPTIONAL';
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === 'optional' || s === 'có thể mua' || s === 'co the mua')
    return 'OPTIONAL';
  if (s === 'required' || s === 'r' || s === 'bắt buộc' || s === 'bat buoc')
    return 'REQUIRED';
  if (s === 'no' || s === 'n' || s === 'không' || s === 'khong') return 'NO';
  return 'OPTIONAL';
}
