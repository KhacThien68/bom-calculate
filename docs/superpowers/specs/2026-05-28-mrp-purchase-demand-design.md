# MRP — Tính nhu cầu mua hàng — Design Spec

**Date:** 2026-05-28
**Status:** Draft for review
**Author:** ThienNK (with Claude)
**Reference:** `C:\Users\thiennk\Downloads\DVC_Test MRP.xlsx`

## 1. Mục tiêu

Thêm một màn hình **"Tính nhu cầu mua hàng"** cho phép user nhập danh sách đơn hàng (thành phẩm hoặc nguyên vật liệu), hệ thống tự động nổ BOM nhiều cấp, tính nhu cầu net (Đơn hàng − Tồn hiện tại + Tồn định mức), cho phép user chia tỷ lệ Thương mại / Sản xuất ở từng cấp, và tổng hợp ra danh sách số lượng cần mua (có làm tròn theo MOQ). Logic mô phỏng đúng file Excel tham chiếu.

Để phục vụ tính năng này, hệ thống cần tách **Material master** thành bảng riêng, link với `boms` và `bom_items` qua `code` (không FK chéo). Stock và MOQ chỉ lưu ở Material master.

## 2. Phạm vi

**Trong scope:**
- Tạo bảng `materials` (master vật tư) + module CRUD + Excel upload (preview/commit pattern như BOM hiện tại).
- Migration: chuyển `actualStock`/`standardStock` từ `bom_items` sang `materials`, xoá 2 cột này khỏi `bom_items`.
- Sửa BOM upload để auto-upsert các code chưa có vào `materials` (stock=0, moq=null).
- Sửa BomDetail UI: hiển thị stock dạng read-only (join từ `materials`).
- Module `mrp`: stateless calculation engine + REST endpoint.
- Page `/mrp`: combobox search, bảng đơn hàng, accordion kết quả theo cấp, bảng tổng hợp mua, nút export Excel.
- Export `.xlsx` 2 sheet (chi tiết theo cấp + tổng hợp mua).

**Ngoài scope (phase sau):**
- Persist MRP plan vào DB.
- "Cấp tính MRP override" (cột `I2` trên sheet BoM của Excel — cho phép ép cấp khác cấp tự nhiên).
- Multi-tenant / phân quyền theo nhóm vật tư.
- Tích hợp PO/Sales Order thật.

## 3. Bối cảnh hiện tại

- `Bom` (unique `materialCode`) là entity cho thành phẩm.
- `BomItem` là cây cha-con qua `parentId`, có `componentCode`, `quantity` (định mức/1 cha), `level`, `sortOrder`, `actualStock`, `standardStock`.
- Stock đang ở `BomItem` → cùng 1 mã có thể có giá trị stock khác nhau ở các BOM khác nhau → không phản ánh đúng kho thực.
- Chưa có khái niệm MOQ, Material master, hay MRP calculation.

## 4. Đối chiếu Excel ↔ hệ thống

| Excel | Hệ thống mới |
|---|---|
| `Khai báo!KHO` (master vật tư) | `materials` table |
| `Khai báo!BOM` (cấu trúc BOM) | `boms` + `bom_items` (đã có) |
| `Khai báo!PO` (đơn hàng) | Input transient ở màn hình MRP (không lưu DB) |
| `Khai báo!KHO.Tồn` | `materials.actual_stock` |
| `Khai báo!KHO.I2` | `materials.standard_stock` (tồn định mức) |
| `Khai báo!KHO.MOQ` | `materials.moq` (nullable) |
| `BoM!I` (cấp tính MRP) | **Ngoài scope phase này** — dùng `bom_items.level` tự nhiên |
| Sheet `DVC_Nguyen ly (V2)` cột B0–AU | `MrpService.calculate()` + `MrpPage` |
| Cột `R` Nhu cầu = O+Q−P | `demand = max(incoming + stockBuffer − actualStock, 0)` |
| Cột `T` Sản xuất = R−S | `productionQty = demand − commercialQty` |
| Cột `X` Tồn ĐM phải bù = IF(S>0, 0, std) | `stockBuffer = priorCommercial(code) > 0 ? 0 : standardStock` |
| Cột `Y/AG/AO` Nhu cầu BoM (SUMPRODUCT) | `incoming = Σ parent.productionQty × childCoef` |
| Cột `AT` Tổng hợp sản lượng mua | `aggregate[code].totalPurchase = Σ commercialQty mọi cấp` |
| Cột `AU` Mua theo MOQ | `purchaseByMoq = moq ? ceil(total/moq)*moq : total` |

## 5. Data model

### 5.1 Bảng mới: `materials`

```prisma
model Material {
  id                Int      @id @default(autoincrement())
  code              String   @unique
  name              String
  uom               String
  actualStock       Decimal  @default(0) @map("actual_stock")   @db.Decimal(18, 6)
  standardStock     Decimal  @default(0) @map("standard_stock") @db.Decimal(18, 6)
  moq               Decimal? @map("moq") @db.Decimal(18, 6)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt      @map("updated_at")
  createdByUserId   Int      @map("created_by_user_id")
  updatedByUserId   Int      @map("updated_by_user_id")

  createdBy User @relation("MaterialCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy User @relation("MaterialUpdatedBy", fields: [updatedByUserId], references: [id])

  @@map("materials")
}
```

Không có FK từ `boms`/`bom_items` sang `materials`. Liên kết hoàn toàn bằng `code` (logical join). Lý do: cho phép upload BOM trước/sau Material master tuỳ ý; tránh constraint phức tạp khi sửa code.

### 5.2 Bảng `bom_items` — đơn giản hoá

Xoá 2 cột (đã chuyển sang `materials`):

```diff
- actualStock     Decimal  @default(0) @map("actual_stock")   @db.Decimal(18, 6)
- standardStock   Decimal  @default(0) @map("standard_stock") @db.Decimal(18, 6)
```

### 5.3 Migration plan

1. Migration 1: tạo bảng `materials` (chưa drop column).
2. Data migration script: với mỗi distinct `component_code` trong `bom_items`, upsert vào `materials` lấy `MAX(actual_stock)` và `MAX(standard_stock)` (an toàn — tránh underestimate stock); copy `component_name`, `uom`. Với mỗi `boms.material_code` chưa có → upsert với stock=0, name=`materialDescription`, uom='PC' default.
3. Migration 2: drop `bom_items.actual_stock`, `bom_items.standard_stock`.

## 6. Backend

### 6.1 Module structure mới

```
backend/src/
├── materials/
│   ├── materials.controller.ts
│   ├── materials.service.ts
│   ├── materials.module.ts
│   ├── material-upload.service.ts          // preview/commit pattern
│   └── dto/
│       ├── create-material.dto.ts
│       ├── update-material.dto.ts
│       ├── preview-materials.dto.ts
│       └── commit-materials.dto.ts
└── mrp/
    ├── mrp.controller.ts
    ├── mrp.service.ts                      // stateless calc
    ├── mrp-engine.ts                       // pure functions: cycle detect, level explosion
    ├── mrp.module.ts
    ├── mrp.types.ts
    └── dto/
        └── calculate-mrp.dto.ts
```

### 6.2 Sửa `BomService`

- `getTree(materialCode)`: thêm join với `materials` theo `component_code` để trả về `actualStock`/`standardStock` (read-only).
- `updateItem(...)`: bỏ `actualStock`/`standardStock` khỏi DTO.
- `commit(...)` (BOM): sau khi insert items, gọi `MaterialsService.upsertMissingByCodes(allCodes, userId)` để auto-tạo material rỗng cho code mới.

### 6.3 API endpoints

**Materials**
```
GET    /materials                      list (paginated)
GET    /materials/search?q=&limit=20   typeahead (search by code OR name, ILIKE)
GET    /materials/:id                  detail
POST   /materials                      create
PATCH  /materials/:id                  update
DELETE /materials/:id                  delete (guard: nếu code đang dùng trong BOM thì 409)
POST   /materials/preview              parse Excel + diff
POST   /materials/commit               commit token từ preview
```

**MRP**
```
POST   /mrp/calculate                  stateless, không lưu DB
```

### 6.4 MRP API contract

**Request:**

```ts
interface MrpCalculateRequest {
  orders: Array<{
    code: string;             // material code (top-level)
    qty: number;              // đơn hàng
    commercialQty?: number;   // commercial cấp 0 (default 0)
  }>;
  commercialOverrides?: Array<{
    code: string;
    level: number;            // 1..MAX_DEPTH
    commercialQty: number;
  }>;
}
```

**Response:**

```ts
interface MrpCalculateResponse {
  byLevel: Array<{
    level: number;            // 0, 1, 2, ...
    rows: Array<MrpRow>;
  }>;
  aggregate: Array<{
    code: string;
    name: string;
    uom: string;
    totalPurchase: number;
    moq: number | null;
    purchaseByMoq: number;
  }>;
  warnings: Array<{ type: 'cycle' | 'missing_material' | 'max_depth'; message: string; code?: string }>;
}

interface MrpRow {
  code: string;
  name: string;
  uom: string;
  incoming: number;           // Nhu cầu BoM (từ cha)
  actualStock: number;
  standardStock: number;
  moq: number | null;
  stockBuffer: number;        // Tồn ĐM phải bù
  demand: number;             // Nhu cầu
  commercialQty: number;
  productionQty: number;      // Sản xuất (Chuyển BoM)
  hasBom: boolean;
}
```

### 6.5 Algorithm (pseudo-code dùng `forEach`/`map`/`reduce`)

```ts
const MAX_DEPTH = 20;

function calculate(req): MrpCalculateResponse {
  const byLevel = [];
  const warnings = [];
  const priorCommercialByCode = new Map<string, number>();   // sum commercial của các cấp trước cho từng code

  // Level 0 từ orders — Excel cell R7 = O7+Q7-P7 (KHÔNG có IF check commercial)
  const level0 = req.orders.map(o => {
    const m = loadMaterial(o.code);                          // fallback {actualStock:0, standardStock:0, moq:null}
    const commercialQty = o.commercialQty ?? 0;
    const stockBuffer = m.standardStock;                     // luôn cộng buffer ở cấp 0
    const demand = Math.max(o.qty + stockBuffer - m.actualStock, 0);
    const productionQty = Math.max(demand - commercialQty, 0);
    priorCommercialByCode.set(o.code, (priorCommercialByCode.get(o.code) ?? 0) + commercialQty);
    return { ...m, code: o.code, incoming: o.qty, stockBuffer, demand, commercialQty, productionQty, hasBom: bomExists(o.code) };
  });
  byLevel.push({ level: 0, rows: level0 });

  // Levels 1..MAX_DEPTH
  let currentLevel = 0;
  while (true) {
    const parents = byLevel[currentLevel].rows.filter(r => r.productionQty > 0 && r.hasBom);
    if (parents.length === 0) break;
    if (currentLevel + 1 > MAX_DEPTH) {
      warnings.push({ type: 'max_depth', message: `Stopped at depth ${MAX_DEPTH}` });
      break;
    }

    // Aggregate incoming theo code.
    // getDirectChildren(parentCode): tìm Bom có materialCode = parentCode, lấy BomItem có level = 1
    // (con trực tiếp của top trong BOM đó). Trả về [{ componentCode, quantity }, ...].
    // Nếu parentCode không có Bom tương ứng → return [] (parent là leaf material, không nổ tiếp).
    const incomingByCode = new Map<string, number>();
    parents.forEach(parent => {
      const directChildren = getDirectChildren(parent.code);
      directChildren.forEach(child => {
        const prev = incomingByCode.get(child.componentCode) ?? 0;
        incomingByCode.set(child.componentCode, prev + parent.productionQty * Number(child.quantity));
      });
    });

    // Tính từng row cấp dưới — Excel X8 = IF(S8>0, 0, std). Chỉ check commercial của các cấp TRƯỚC,
    // KHÔNG check commercial của cấp hiện tại (vì commercial cấp này set AFTER stockBuffer).
    const rows = Array.from(incomingByCode.entries()).map(([code, incoming]) => {
      const m = loadMaterial(code);
      const override = req.commercialOverrides?.find(o => o.code === code && o.level === currentLevel + 1);
      const commercialQty = override?.commercialQty ?? 0;
      const stockBuffer = (priorCommercialByCode.get(code) ?? 0) > 0 ? 0 : m.standardStock;
      const demand = Math.max(incoming + stockBuffer - m.actualStock, 0);
      const productionQty = Math.max(demand - commercialQty, 0);
      priorCommercialByCode.set(code, (priorCommercialByCode.get(code) ?? 0) + commercialQty);
      return { ...m, code, incoming, stockBuffer, demand, commercialQty, productionQty, hasBom: bomExists(code) };
    });
    byLevel.push({ level: currentLevel + 1, rows });
    currentLevel++;
  }

  // Aggregate
  const aggMap = new Map<string, { name: string; uom: string; total: number; moq: number | null }>();
  byLevel.forEach(lvl => {
    lvl.rows.forEach(r => {
      const cur = aggMap.get(r.code) ?? { name: r.name, uom: r.uom, total: 0, moq: r.moq };
      cur.total += r.commercialQty;
      aggMap.set(r.code, cur);
    });
  });
  const aggregate = Array.from(aggMap.entries()).map(([code, v]) => ({
    code,
    name: v.name,
    uom: v.uom,
    totalPurchase: v.total,
    moq: v.moq,
    purchaseByMoq: v.moq ? Math.ceil(v.total / v.moq) * v.moq : v.total,
  }));

  return { byLevel, aggregate, warnings };
}
```

### 6.6 Cycle detection

`getDirectChildren()` cache theo `parent.code`. Trước khi expand, push `parent.code` vào visited set của path; nếu child code đã có trong path → emit `warnings: cycle`, không expand child đó.

## 7. Frontend

### 7.1 Routes mới (`App.tsx`)

```
/materials                  list + search
/materials/new              create form
/materials/:id              edit form
/materials/upload           wizard upload Excel
/mrp                        MRP calculator
```

Thêm vào sidebar `AppLayout`: **Vật tư**, **Tính nhu cầu mua**.

### 7.2 Pages & components mới

**Materials**
- `MaterialsPage.tsx` — bảng list (Mã | Tên | ĐVT | Tồn | Tồn ĐM | MOQ | Actions), search input.
- `MaterialFormPage.tsx` — form create/edit (react-hook-form + zod).
- `MaterialUploadPage.tsx` — wizard 3 bước reuse pattern `UploadStepSelect` / `UploadStepPreview` hiện có.
- `lib/excel.ts` thêm parser cho material file (cột Mã, Tên, ĐVT, Tồn, Tồn ĐM, MOQ).

**MRP**
- `MrpPage.tsx` — main page.
- `MaterialSearchCombobox.tsx` — typeahead gọi `/materials/search?q=`, debounce 300ms, hiển thị max 20 result. Chỉ search trong `materials` (auto-upsert đảm bảo code trong BOM luôn có ở materials).
- `MrpOrderTable.tsx` — bảng cấp 0 (đơn hàng): inline edit `qty` và `commercialQty`, nút xoá row.
- `MrpLevelAccordion.tsx` — accordion render từng cấp 1..N theo chiều dọc (mở mặc định). Mỗi cấp 1 table read-only ngoại trừ cột `commercialQty`.
- `MrpAggregateTable.tsx` — bảng tổng hợp mua dưới cùng.
- `MrpExportButton.tsx` — nút export Excel client-side.

### 7.3 State (Zustand store: `mrp.store.ts`)

```ts
interface MrpStore {
  orders: Array<{ code: string; name: string; uom: string; qty: number; commercialQty: number }>;
  commercialOverrides: Record<string, number>;   // key = `${code}|${level}`
  result: MrpCalculateResponse | null;
  isCalculating: boolean;

  addOrder: (m: { code: string; name: string; uom: string }) => void;
  updateOrder: (index: number, patch: Partial<...>) => void;
  removeOrder: (index: number) => void;
  setCommercialOverride: (code: string, level: number, qty: number) => void;
  clear: () => void;
}
```

Layer trên store: hook `useMrpAutoCalculate()` watch `orders` + `commercialOverrides`, debounce 300ms, gọi React Query mutation `calculateMrp`. Result write vào store.

### 7.4 Export Excel

Reuse `lib/excel.ts` (SheetJS đã có). File `MRP_<yyyyMMddHHmm>.xlsx` chứa 2 sheet:

- **Chi tiết theo cấp**: cột `Cấp | Mã | Tên | ĐVT | Nhu cầu BoM | Tồn | Tồn ĐM phải bù | Nhu cầu | Thương mại | Sản xuất | Có BoM?`
- **Tổng hợp mua**: cột `Mã | Tên | ĐVT | Tổng mua | MOQ | Mua theo MOQ`

## 8. Edge cases

| Case | Cách xử lý |
|---|---|
| Code search ra không có trong `materials` | Combobox không suggest. Nếu user paste code lạ → endpoint trả 404 → toast lỗi. |
| Material không có MOQ | `purchaseByMoq = totalPurchase`. |
| `qty = 0` hoặc âm | Frontend validate ≥ 0; backend skip row nếu qty ≤ 0. |
| `commercialQty > demand` | Allow (user có thể dư mua); `productionQty = max(demand - commercial, 0)` → có thể = 0, không âm. |
| Cùng code dùng ở nhiều cấp | Vẫn tạo row riêng từng cấp; aggregate cộng dồn ở cuối. |
| Circular BOM | Cycle detect → emit warning, không expand. |
| BOM > 20 cấp | Emit warning `max_depth`, dừng. |
| User edit `commercialQty` ở cấp k làm `productionQty` cấp k giảm | Re-calc tự động (debounce 300ms) → cấp k+1..N được rebuild lại từ đầu. |

## 9. Coding style

- JS/TS dùng `forEach`/`map`/`reduce`/`filter`/`find` thay vì `for ... of`/`for ... in`. (Theo feedback đã lưu.)
- Client state phức tạp dùng Zustand, không useState lồng nhau. (Theo feedback đã lưu.)
- Decimal money/qty: dùng `Decimal(18,6)` trên DB; FE convert sang `number` để tính toán.

## 10. Open items (deliberately out of scope)

- "Cấp tính MRP override" — Excel cho phép ép cấp khác cấp tự nhiên qua cột `BoM!I`. Phase 2.
- Persist MRP plan — Excel không lưu, hệ thống cũng vậy ở phase này. Có thể thêm về sau bằng bảng `mrp_plans` + `mrp_plan_lines`.
- Audit log cho thay đổi Material (ai sửa stock).
- Phân quyền theo nhóm material.

## 11. Acceptance criteria

1. User có thể CRUD material và upload Excel material master với preview/commit.
2. Migration thành công trên DB hiện có: mọi `bom_items.componentCode` & `boms.materialCode` có record `materials` tương ứng; 2 cột stock trên `bom_items` đã bị drop.
3. Page BomDetail vẫn show stock đúng (join với `materials`).
4. Page `/mrp` reproduce được kết quả của file Excel tham chiếu (`DVC_Test MRP.xlsx`) với cùng input — sai số ≤ 0.001 cho mọi ô.
5. Export Excel mở được trong Excel, có đúng 2 sheet với cột như §7.4.
6. Cycle detection: nếu tạo BOM A→B→A test, MRP trả về `warnings.cycle` và không crash.
