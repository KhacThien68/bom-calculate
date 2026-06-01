import {
  DiffResultItem,
  DiffSummary,
  PreviewItemInput,
  UploadMode,
} from './bom.types';
import { buildInputPaths, pathKey, splitPathKey } from './bom-path.util';

export interface OldEntry {
  componentName: string;
  quantity: number;
  uom: string;
  path: string[];
}

const EPS = 1e-6;
const numEq = (a: number, b: number) => Math.abs(a - b) < EPS;

function isUnchanged(old: OldEntry, n: PreviewItemInput): boolean {
  return (
    old.componentName === n.componentName &&
    numEq(old.quantity, n.quantity) &&
    old.uom === n.uom
  );
}

export function computeDiff(opts: {
  items: PreviewItemInput[];
  oldByKey: Map<string, OldEntry>;
  mode: UploadMode;
}): { items: DiffResultItem[]; summary: DiffSummary } {
  const incomingPaths = buildInputPaths(opts.items);
  const newByKey = new Map<
    string,
    PreviewItemInput & { parentPath: string[] }
  >();
  opts.items.forEach((it) => {
    const parentPath = incomingPaths.get(it.sortOrder)!;
    newByKey.set(pathKey(parentPath, it.componentCode), { ...it, parentPath });
  });

  const diffItems: DiffResultItem[] = [];
  const summary: DiffSummary = { new: 0, changed: 0, unchanged: 0, removed: 0 };

  newByKey.forEach((n, key) => {
    const old = opts.oldByKey.get(key);
    if (!old) {
      diffItems.push({
        status: 'new',
        level: n.level,
        componentCode: n.componentCode,
        componentName: n.componentName,
        quantity: n.quantity,
        uom: n.uom,
        parentPath: n.parentPath,
      });
      summary.new++;
    } else if (isUnchanged(old, n)) {
      diffItems.push({
        status: 'unchanged',
        level: n.level,
        componentCode: n.componentCode,
        componentName: n.componentName,
        quantity: n.quantity,
        uom: n.uom,
        parentPath: n.parentPath,
      });
      summary.unchanged++;
    } else {
      diffItems.push({
        status: 'changed',
        level: n.level,
        componentCode: n.componentCode,
        componentName: n.componentName,
        quantity: n.quantity,
        uom: n.uom,
        parentPath: n.parentPath,
        oldValues: {
          componentName: old.componentName,
          quantity: old.quantity,
          uom: old.uom,
        },
      });
      summary.changed++;
    }
  });

  if (opts.mode === 'full') {
    opts.oldByKey.forEach((o, key) => {
      if (!newByKey.has(key)) {
        const codes = splitPathKey(key);
        diffItems.push({
          status: 'removed',
          level: o.path.length + 1,
          componentCode: codes[codes.length - 1],
          componentName: o.componentName,
          quantity: o.quantity,
          uom: o.uom,
          parentPath: o.path,
        });
        summary.removed++;
      }
    });
  }

  return { items: diffItems, summary };
}
