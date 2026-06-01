// Shared helpers for identifying BOM items by their tree path.
// We use ASCII Unit Separator (\x1f) so that path keys are unambiguous even
// when component codes happen to contain other punctuation.
export const PATH_SEP = '\x1f';

export function pathKey(path: string[], componentCode: string): string {
  return [...path, componentCode].join(PATH_SEP);
}

export function splitPathKey(key: string): string[] {
  return key.split(PATH_SEP);
}

interface InputItem {
  sortOrder: number;
  componentCode: string;
  parentSortOrder: number | null;
}

/**
 * Build a map of sortOrder → parentPath for incoming items that reference
 * their parent via parentSortOrder.
 */
export function buildInputPaths<T extends InputItem>(
  items: T[],
): Map<number, string[]> {
  const bySort = new Map(items.map((it) => [it.sortOrder, it]));
  const pathBySort = new Map<number, string[]>();
  const compute = (it: T): string[] => {
    const cached = pathBySort.get(it.sortOrder);
    if (cached) return cached;
    let path: string[];
    if (it.parentSortOrder == null) {
      path = [];
    } else {
      const parent = bySort.get(it.parentSortOrder);
      if (!parent) {
        throw new Error(
          `Invalid parentSortOrder ${it.parentSortOrder} on item ${it.componentCode}`,
        );
      }
      path = [...compute(parent), parent.componentCode];
    }
    pathBySort.set(it.sortOrder, path);
    return path;
  };
  for (const it of items) compute(it);
  return pathBySort;
}

interface DbItem {
  id: number;
  componentCode: string;
  parentId: number | null;
}

/**
 * Build a map of id → parentPath for persisted BomItems that reference their
 * parent via parentId.
 */
export function buildDbPaths<T extends DbItem>(
  items: T[],
): Map<number, string[]> {
  const byId = new Map(items.map((it) => [it.id, it]));
  const pathById = new Map<number, string[]>();
  const compute = (id: number): string[] => {
    const cached = pathById.get(id);
    if (cached) return cached;
    const it = byId.get(id)!;
    const path =
      it.parentId == null
        ? []
        : [...compute(it.parentId), byId.get(it.parentId)!.componentCode];
    pathById.set(id, path);
    return path;
  };
  for (const it of items) compute(it.id);
  return pathById;
}
