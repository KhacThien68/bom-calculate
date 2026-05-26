# BOM Calculate — Design Spec

**Date:** 2026-05-25
**Status:** Draft for review

## 1. Mục tiêu

Xây dựng web app cho phép user đăng nhập, tải file Excel (template BOM), parse cấu trúc cây cha-con dựa vào cột level, so sánh diff với dữ liệu hiện có và lưu vào MySQL. Có giao diện xem BOM dạng bảng có thể expand/collapse hàng cha-con.

## 2. Tech stack

### Frontend
- **React 18** + **TypeScript**
- **Vite** (build tool / dev server)
- **React Router v6** (routing + protected route)
- **Tailwind CSS** + **shadcn/ui** (UI)
- **SheetJS (xlsx)** (parse Excel client-side)
- **react-hook-form** + **zod** (form + validation)
- **TanStack Query** (server state, cache, refetch)
- **Zustand** (client state — wizard, UI state)
- **axios** (HTTP client với interceptor refresh token)

### Backend
- **NestJS** + **TypeScript**
- **Prisma** (ORM)
- **MySQL 8.x**
- **JWT** (access + refresh) qua **@nestjs/jwt** + **passport-jwt**
- **bcrypt** (hash password)
- **cookie-parser** (đọc httpOnly cookie)
- **class-validator** + **class-transformer** (DTO validation)

### Repo
- Monorepo bằng **npm workspaces** (không cần Turborepo cho scope này)

## 3. Repo structure

```
bom-calculate/
├── backend/
│   ├── src/
│   │   ├── auth/              # login, refresh, logout, change-password, JwtStrategy, guards
│   │   ├── users/             # user controller/service (list/create/reset-password)
│   │   ├── bom/               # BOM controller, service, DTO, diff logic
│   │   ├── prisma/            # PrismaService
│   │   ├── common/            # filters, decorators (@Roles), interceptors, RolesGuard
│   │   ├── app.module.ts
│   │   └── main.ts            # cookie-parser, CORS credentials
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts            # bootstrap admin mặc định (admin / Aa123456)
│   │   └── migrations/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/             # LoginPage, BomListPage, BomDetailPage, UploadPage,
│   │   │                      # UsersPage, UserCreatePage, ChangePasswordPage
│   │   ├── components/        # ProtectedRoute, AdminRoute, BomTreeTable, DiffTable, FileDropzone, ...
│   │   ├── lib/
│   │   │   ├── api.ts         # axios instance + interceptors
│   │   │   ├── excel.ts       # SheetJS parsing + hierarchy builder
│   │   │   └── queryClient.ts
│   │   ├── hooks/             # useAuth, useBom, ...
│   │   ├── stores/            # Zustand stores (uploadWizard, bomTreeUi, ...)
│   │   ├── schemas/           # zod schemas
│   │   ├── types/             # TypeScript types
│   │   ├── App.tsx            # router config
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── components.json        # shadcn config
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-25-bom-calculate-design.md
├── package.json               # workspaces root
├── .gitignore
└── README.md
```

## 4. Database schema (Prisma)

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

model User {
  id            Int      @id @default(autoincrement())
  username      String   @unique
  passwordHash  String   @map("password_hash")
  name          String?
  role          Role     @default(USER)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  bomsCreated   Bom[]    @relation("BomCreatedBy")
  bomsUpdated   Bom[]    @relation("BomUpdatedBy")

  @@map("users")
}

model Bom {
  id                  Int       @id @default(autoincrement())
  materialCode        String    @unique @map("material_code")
  materialDescription String    @map("material_description")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  createdByUserId     Int       @map("created_by_user_id")
  updatedByUserId     Int       @map("updated_by_user_id")

  createdBy  User      @relation("BomCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy  User      @relation("BomUpdatedBy", fields: [updatedByUserId], references: [id])
  items      BomItem[]

  @@map("boms")
}

model BomItem {
  id             Int      @id @default(autoincrement())
  bomId          Int      @map("bom_id")
  parentId       Int?     @map("parent_id")
  componentCode  String   @map("component_code")
  componentName  String   @map("component_name")
  quantity       Decimal  @db.Decimal(18, 6)
  uom            String
  level          Int
  sortOrder      Int      @map("sort_order")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  bom      Bom       @relation(fields: [bomId], references: [id], onDelete: Cascade)
  parent   BomItem?  @relation("BomItemTree", fields: [parentId], references: [id], onDelete: Cascade)
  children BomItem[] @relation("BomItemTree")

  @@index([bomId])
  @@index([parentId])
  @@index([bomId, componentCode])
  @@map("bom_items")
}
```

**Ghi chú:**
- `BomItem.parentId` self-reference, nullable cho root items.
- `sortOrder` để giữ đúng thứ tự dòng theo file Excel khi hiển thị tree.
- `quantity` dùng `Decimal(18,6)` để chính xác (file có giá trị như `81352`, `83.33`, `0.293`...).
- **Lưu nguyên giá trị từ Excel, không convert đơn vị lúc upload.** `quantity` và `uom` được lưu nguyên xi như trong file (vd: `81352 KG`, `1000 PC`, `60 M`). Việc chuyển đổi đơn vị hiển thị (KG ↔ g, M ↔ cm, ...) sẽ do FE đảm nhận dựa vào trang Setting ở phase sau.
- Unique key trong cây: `(bomId, parentId, componentCode)` — sẽ enforce ở application level để tránh phức tạp với NULL parent_id trong MySQL.

## 5. API endpoints

Tất cả endpoint trả JSON. Lỗi format: `{ statusCode, message, error }`.

### Auth (`/auth`)
| Method | Path | Body | Mô tả |
|--------|------|------|-------|
| POST | `/auth/login` | `{ username, password }` | Set `access_token` (15ph) + `refresh_token` (7 ngày) cookie httpOnly. Trả `{ user: { id, username, name, role } }` |
| POST | `/auth/refresh` | — (đọc cookie) | Cấp lại access_token. 401 nếu refresh hết hạn |
| POST | `/auth/logout` | — | Clear cả 2 cookie |
| GET | `/auth/me` | — | Trả thông tin user hiện tại (`{ id, username, name, role }`) — dùng cho ProtectedRoute + AdminRoute |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | User đổi pass của chính mình. Verify `currentPassword` bằng bcrypt. 400 nếu sai |

### Users (`/users`) — yêu cầu auth + role ADMIN
| Method | Path | Body / Query | Mô tả |
|--------|------|--------------|-------|
| GET | `/users` | — | List tất cả user `[{ id, username, name, role, createdAt, updatedAt }]` (không trả `passwordHash`) |
| POST | `/users` | `{ username, name, password, role }` | Tạo user mới. 409 nếu `username` trùng. Hash bằng bcrypt |
| POST | `/users/:id/reset-password` | — | Set password của user `:id` về mặc định `Aa123456` (hash bằng bcrypt). Admin không thể reset chính mình (400) |

### BOM (`/bom`) — yêu cầu auth
| Method | Path | Body / Query | Mô tả |
|--------|------|--------------|-------|
| GET | `/bom` | — | List BOM (id, material_code, material_description, updated_at, item_count) |
| GET | `/bom/:materialCode` | — | Trả full tree của 1 BOM |
| POST | `/bom/preview` | `{ materialCode, materialDescription, mode: 'full' \| 'append', items: PreviewItem[] }` | So sánh với BOM hiện có, trả diff. **Không ghi DB**. Trả thêm `previewToken` (UUID, TTL 5ph, lưu in-memory) |
| POST | `/bom/commit` | `{ previewToken }` | Áp diff đã preview vào DB trong transaction. 410 nếu token hết hạn |

**PreviewItem shape (từ FE):**
```ts
{
  level: number;          // 1, 2, 3...
  componentCode: string;
  componentName: string;
  quantity: number;
  uom: string;
  sortOrder: number;      // index trong file Excel
  parentSortOrder: number | null;  // sortOrder của parent (đã compute ở FE)
}
```

**Diff response shape:**
```ts
{
  previewToken: string;
  bomExists: boolean;
  summary: {
    new: number;
    changed: number;
    unchanged: number;
    removed: number;       // chỉ khác 0 khi mode='full'
  };
  items: Array<{
    status: 'new' | 'changed' | 'unchanged' | 'removed';
    level: number;
    componentCode: string;
    componentName: string;
    quantity: number;
    uom: string;
    parentPath: string[];  // chuỗi component_code từ root → parent
    // chỉ có khi status='changed':
    oldValues?: { componentName, quantity, uom };
  }>;
}
```

### Bootstrap admin (Prisma seed, chạy 1 lần khi setup DB)
```bash
npx prisma db seed
```
Script `backend/prisma/seed.ts` tạo user mặc định nếu chưa có:
- `username = admin`, `password = Aa123456` (hash bcrypt), `role = ADMIN`, `name = Administrator`
- Idempotent: dùng `upsert` theo `username` để chạy nhiều lần vẫn an toàn

Admin nên đổi password ngay sau khi login lần đầu qua trang Change Password.

### Mật khẩu mặc định khi reset
Mọi `POST /users/:id/reset-password` đều set password về **`Aa123456`** (constant ở BE). Admin có trách nhiệm thông báo cho user qua kênh ngoài (chat/email).

## 6. FE pages & routing

```tsx
// App.tsx (rút gọn)
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<BomListPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="bom/:materialCode" element={<BomDetailPage />} />
        <Route path="account/change-password" element={<ChangePasswordPage />} />
        <Route element={<AdminRoute />}>
          <Route path="users" element={<UsersPage />} />
          <Route path="users/new" element={<UserCreatePage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
</BrowserRouter>
```

**ProtectedRoute** dùng TanStack Query gọi `GET /auth/me`:
- Loading → spinner
- Success → `<Outlet />`
- 401 → `<Navigate to="/login" />`

**AdminRoute** (lồng bên trong ProtectedRoute): đọc `me.role` từ cache `['me']`:
- `role === 'ADMIN'` → `<Outlet />`
- ngược lại → `<Navigate to="/" replace />` (hoặc trang 403)

**AppLayout**: header có tên user + dropdown (Đổi mật khẩu / Đăng xuất), nav links: `Danh sách BOM` · `Upload` · (chỉ admin) `Quản lý user`. Link "Quản lý user" ẩn nếu `role !== 'ADMIN'`.

### LoginPage
Form `{ username, password }` validate bằng zod, submit qua TanStack Query mutation. Thành công → redirect `/`.

### BomListPage
- Bảng shadcn với cột: Material Code, Description, Updated At, Item count, Actions
- Click 1 dòng → navigate `/bom/:materialCode`
- Nút "Upload BOM mới" → `/upload`

### BomDetailPage
- Gọi `GET /bom/:materialCode` → nhận flat array có `parentId`/`sortOrder`/`level`
- Build tree ở FE, render bằng shadcn Table với cột đầu có nút expand/collapse (icon chevron)
- Indent theo `level`
- Cột: Code, Component, Quantity, UoM

### UploadPage
3 bước (wizard):

**Step 1 — Chọn mode & file:**
- Radio: `Upload toàn bộ` / `Thêm mới`
- Input `materialCode` + `materialDescription` (auto-fill nếu append từ BOM có sẵn)
- Dropzone nhận `.xlsx`

**Step 2 — Preview diff:**
- FE parse file bằng SheetJS → build hierarchy → POST `/bom/preview`
- Hiển thị bảng diff với badge màu: 🟢 new · 🟡 changed · ⚪ unchanged · 🔴 removed
- Mỗi dòng `changed` có thể expand xem old vs new values
- Summary card: tổng số mỗi loại

**Step 3 — Confirm:**
- Nút **Confirm** → POST `/bom/commit` với `previewToken`
- Nút **Cancel** → quay về step 1
- Thành công → toast + redirect `/bom/:materialCode`

### UsersPage (admin only) — `/users`
- Bảng shadcn cột: ID, Username, Name, Role (badge), Created At, Actions
- Action `Reset password`: mở `AlertDialog` xác nhận → POST `/users/:id/reset-password` → toast "Đã reset về Aa123456"
  - Disable button nếu `user.id === me.id` (admin không reset chính mình)
- Nút trên cùng: `Tạo user mới` → navigate `/users/new`

### UserCreatePage (admin only) — `/users/new`
- Form react-hook-form + zod:
  - `username` (required, unique sẽ check ở BE → toast lỗi nếu 409)
  - `name` (required)
  - `password` (required, min 6 ký tự, validate có cả chữ + số)
  - `role` (select: `USER` / `ADMIN`, default `USER`)
- Submit → POST `/users` → success: toast + navigate `/users`

### ChangePasswordPage (mọi user) — `/account/change-password`
- Form react-hook-form + zod:
  - `currentPassword` (required)
  - `newPassword` (required, min 6 ký tự, có cả chữ + số)
  - `confirmNewPassword` (phải khớp `newPassword` — zod `refine`)
- Submit → POST `/auth/change-password` → success: toast + reset form
- Nếu BE trả 400 (sai current) → set error vào field `currentPassword`

## 6.1. Client state management

Combo chuẩn: **TanStack Query cho server state · Zustand cho client state · react-hook-form cho form state**. Mỗi loại state đặt đúng chỗ — không duplicate dữ liệu server vào Zustand.

| Loại state | Ví dụ | Cách quản lý |
|------------|-------|---------------|
| Server state | user info, BOM list, BOM detail, preview response | **TanStack Query** |
| Form state | login form, các input của upload wizard | **react-hook-form** + zod resolver |
| Client state (wizard) | step hiện tại, mode, file, parsed items, previewToken, diff | **Zustand** store `useUploadWizardStore` |
| Client state (UI) | Set itemId đang expand trong tree per-BOM | **Zustand** store `useBomTreeUiStore` |
| Toast | thông báo success/error | **shadcn `sonner`** — gọi `toast()` |

### TanStack Query — query keys convention
```ts
['me']                          // GET /auth/me
['boms']                        // GET /bom
['bom', materialCode]           // GET /bom/:materialCode
['users']                       // GET /users (admin only)
```

### Mutation → invalidation
| Mutation | Invalidate |
|----------|------------|
| `login` | `setQueryData(['me'], user)` |
| `logout` | `queryClient.clear()` + `useUploadWizardStore.getState().reset()` + `useBomTreeUiStore.getState().clear()` |
| `commit` (upload) | `invalidateQueries(['boms'])` + `invalidateQueries(['bom', materialCode])` + `useUploadWizardStore.getState().reset()` |
| `createUser` | `invalidateQueries(['users'])` |
| `resetPassword` | `invalidateQueries(['users'])` (refresh `updatedAt` của user) |
| `changePassword` | — (không invalidate; chỉ toast) |

### Zustand stores

**`frontend/src/stores/uploadWizard.store.ts`** — wizard state cho UploadPage (giữ kể cả khi user vô tình nav ra rồi quay lại):

```ts
type WizardStep = 'select' | 'preview' | 'done';

interface UploadWizardState {
  step: WizardStep;
  mode: 'full' | 'append';
  materialCode: string;
  materialDescription: string;
  file: File | null;
  items: PreviewItem[];        // sau khi FE parse Excel
  previewToken: string | null;
  diff: DiffResponse | null;

  setMode: (mode: 'full' | 'append') => void;
  setMaterial: (code: string, desc: string) => void;
  setFile: (file: File | null) => void;
  setParsedItems: (items: PreviewItem[]) => void;
  setPreview: (token: string, diff: DiffResponse) => void;
  goToStep: (step: WizardStep) => void;
  reset: () => void;
}

export const useUploadWizardStore = create<UploadWizardState>((set) => ({
  step: 'select',
  mode: 'full',
  materialCode: '',
  materialDescription: '',
  file: null,
  items: [],
  previewToken: null,
  diff: null,
  setMode: (mode) => set({ mode }),
  setMaterial: (materialCode, materialDescription) => set({ materialCode, materialDescription }),
  setFile: (file) => set({ file }),
  setParsedItems: (items) => set({ items }),
  setPreview: (previewToken, diff) => set({ previewToken, diff, step: 'preview' }),
  goToStep: (step) => set({ step }),
  reset: () => set({
    step: 'select', mode: 'full', materialCode: '', materialDescription: '',
    file: null, items: [], previewToken: null, diff: null,
  }),
}));
```

**`frontend/src/stores/bomTreeUi.store.ts`** — trạng thái expand/collapse của tree, key theo `materialCode`:

```ts
interface BomTreeUiState {
  expandedByBom: Record<string, Set<number>>;
  toggle: (materialCode: string, itemId: number) => void;
  isExpanded: (materialCode: string, itemId: number) => boolean;
  expandAll: (materialCode: string, ids: number[]) => void;
  collapseAll: (materialCode: string) => void;
  clear: () => void;
}

export const useBomTreeUiStore = create<BomTreeUiState>((set, get) => ({
  expandedByBom: {},
  toggle: (materialCode, itemId) => set((s) => {
    const current = new Set(s.expandedByBom[materialCode] ?? []);
    current.has(itemId) ? current.delete(itemId) : current.add(itemId);
    return { expandedByBom: { ...s.expandedByBom, [materialCode]: current } };
  }),
  isExpanded: (materialCode, itemId) =>
    get().expandedByBom[materialCode]?.has(itemId) ?? false,
  expandAll: (materialCode, ids) => set((s) => ({
    expandedByBom: { ...s.expandedByBom, [materialCode]: new Set(ids) },
  })),
  collapseAll: (materialCode) => set((s) => ({
    expandedByBom: { ...s.expandedByBom, [materialCode]: new Set() },
  })),
  clear: () => set({ expandedByBom: {} }),
}));
```

### Quy tắc dùng store

- **Không lưu server data vào Zustand**. User info nằm trong TanStack Query cache `['me']`; component cần thì gọi `useQuery({ queryKey: ['me'] })`. Không có `useAuthStore.user`.
- **Selector pattern** để tránh re-render thừa: `const step = useUploadWizardStore(s => s.step)` thay vì destructure cả object.
- **Reset store** ở: logout (clear toàn bộ), commit thành công (reset wizard).
- Không persist vào localStorage ở phase này (dữ liệu wizard không cần survive reload).

## 7. Excel parsing logic (FE)

File: `frontend/src/lib/excel.ts`

**Input columns (theo header file mẫu):**
| Column | Field |
|--------|-------|
| Material code | `materialCode` (BOM-level, tất cả dòng đều giống nhau) |
| Material description | `materialDescription` (BOM-level) |
| Code Comp (B) | `componentCode` (item-level) |
| Component(B) | `componentName` |
| Quantity(B) | `quantity` |
| UoM | `uom` |
| Material description (A) | `level` (số 1, 2, 3...) |

**Algorithm build hierarchy:**
```ts
function buildHierarchy(rows: RawRow[]): PreviewItem[] {
  const parentStack: PreviewItem[] = []; // index = level-1
  const items: PreviewItem[] = [];

  rows.forEach((row, idx) => {
    const level = Number(row.level);
    const item: PreviewItem = {
      level,
      componentCode: String(row.componentCode).trim(),
      componentName: String(row.componentName).trim(),
      quantity: Number(row.quantity),
      uom: String(row.uom).trim(),
      sortOrder: idx,
      parentSortOrder: level === 1 ? null : parentStack[level - 2]?.sortOrder ?? null,
    };
    parentStack[level - 1] = item;
    parentStack.length = level; // truncate deeper levels khi quay về cấp cao hơn
    items.push(item);
  });

  return items;
}
```

**Validation (zod) trước khi gửi BE:**
- Tất cả `materialCode` của các dòng phải giống nhau và khớp với input
- `level` là số nguyên ≥ 1
- Dòng đầu tiên phải có `level=1`
- Không được có level "nhảy cóc" (level=3 mà chưa có level=2 trước đó)
- `quantity` > 0
- `componentCode`, `componentName`, `uom` không rỗng

Nếu lỗi → hiển thị danh sách lỗi kèm số dòng, không gửi BE.

## 8. Diff logic (BE)

File: `backend/src/bom/bom.service.ts`

**Định danh item trong cây:** path từ root → `componentCode_1 / componentCode_2 / ... / componentCode_n`. Hai item ở "vị trí cây" giống nhau khi `parentPath + componentCode` trùng nhau.

**Algorithm:**
1. Load BOM hiện có (nếu có) → build map `pathKey → BomItem`
2. Build map tương tự cho items mới (sau khi resolve `parentSortOrder` → `parentPath`)
3. Duyệt items mới:
   - Không có trong map cũ → `new`
   - Có và `(componentName, quantity, uom)` giống → `unchanged`
   - Có và khác → `changed`, kèm `oldValues`
4. Nếu `mode='full'`: duyệt map cũ, item nào không có trong map mới → `removed`
5. Lưu toàn bộ diff (cả intent items) vào in-memory cache (Map<token, Diff>) với TTL 5ph
6. Trả response + `previewToken`

**Commit:** đọc cache theo token, mở Prisma `$transaction`:
- Nếu BOM chưa tồn tại: tạo Bom + insert toàn bộ items theo thứ tự (cha trước con) để có `parentId`
- Nếu tồn tại + mode='full': xóa items `removed`, insert items `new`, update items `changed`
- Nếu tồn tại + mode='append': insert `new`, update `changed`
- Update `bom.updatedAt`, `bom.updatedByUserId`
- Xóa token khỏi cache

## 9. Auth flow

### Login
1. FE: POST `/auth/login` với `{ username, password }` (axios `withCredentials: true`)
2. BE: verify bcrypt → ký 2 JWT → set cookie:
   ```
   Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900
   Set-Cookie: refresh_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=604800
   ```
3. BE trả body `{ user: {...} }`
4. FE: `queryClient.setQueryData(['me'], user)` → redirect `/`

### Request có auth
- Axios `withCredentials: true` → browser tự gửi cookie
- Guard `JwtAuthGuard` (passport-jwt với `cookieExtractor`) verify `access_token` → gắn `req.user = { sub, username, role }` (đọc từ JWT payload)

### Role-based authorization
- JWT payload bao gồm `role` để guard kiểm tra nhanh không cần query DB
- `@Roles('ADMIN')` decorator + `RolesGuard` kiểm tra `req.user.role` khớp role yêu cầu
- Áp dụng cho toàn bộ `/users/*` endpoints
- BE trả **403** nếu authenticated nhưng thiếu role → FE giữ user ở trang hiện tại + toast "Không có quyền"

**Lưu ý reset password / change role:** access token còn hạn (15ph) vẫn giữ role cũ. Phase này chấp nhận, không force logout. Token mới có role/info mới sau khi refresh.

### Refresh
- Axios response interceptor: nếu 401 và chưa retry → call `POST /auth/refresh` → nếu thành công retry request gốc, nếu thất bại redirect `/login`

### Logout
- POST `/auth/logout` → BE set cookie với `Max-Age=0` → FE `queryClient.clear()` + navigate `/login`

### CORS
```ts
// backend/src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,  // ví dụ http://localhost:5173
  credentials: true,
});
app.use(cookieParser());
```

## 10. Env variables

**Backend `.env`:**
```
DATABASE_URL="mysql://user:pass@localhost:3306/bom_calculate"
JWT_ACCESS_SECRET="<random>"
JWT_REFRESH_SECRET="<random>"
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
FRONTEND_URL=http://localhost:5173
PORT=3000
COOKIE_SECURE=false   # true ở production (HTTPS)
```

**Frontend `.env`:**
```
VITE_API_BASE_URL=http://localhost:3000
```

## 11. Setup & run

```bash
# Lần đầu
cd bom-calculate
npm install                                # cài root + cả 2 workspace

# DB (giả định MySQL đã chạy local)
cd backend
cp .env.example .env                       # sửa DATABASE_URL
npx prisma migrate dev --name init
npx prisma db seed                         # tạo admin mặc định: admin / Aa123456

# Dev (2 terminal)
cd backend && npm run start:dev            # http://localhost:3000
cd frontend && npm run dev                 # http://localhost:5173
```

Sau khi setup: login bằng `admin / Aa123456` → vào `/account/change-password` đổi mật khẩu ngay.

## 12. Scope rõ ràng (KHÔNG làm)

- ❌ Đăng ký công khai (user chỉ được admin tạo qua UI; admin đầu tiên qua `prisma db seed`)
- ❌ Quên mật khẩu / email reset link (admin reset thủ công về `Aa123456`)
- ❌ Xóa user / disable user (chỉ tạo + reset password ở phase này)
- ❌ Đổi role của user đã tạo (chỉ set role lúc tạo)
- ❌ Audit log chi tiết (chỉ có `created_by`, `updated_by` trên Bom)
- ❌ Lưu file Excel gốc
- ❌ Multi-tenant (mọi user thấy mọi BOM)
- ❌ Unit / e2e tests
- ❌ Docker / CI / deployment script
- ❌ Export Excel ngược lại
- ❌ Tính toán nghiệp vụ ngoài việc dựng cây cha-con (vd: roll-up cost)
- ❌ Force logout / revoke token sau khi đổi role hoặc reset password (token cũ vẫn dùng tới hết 15ph access TTL)
- ❌ Trang Setting cấu hình đơn vị hiển thị (convert KG ↔ g, M ↔ cm...). DB lưu raw quantity + uom; phase sau FE sẽ có Settings và convert hiển thị runtime

Các phần này có thể bổ sung ở phase sau.

## 13. Open risks / lưu ý cho phase implement
 
- **Decimal precision**: SheetJS đọc số ra `number` (float JS), có thể mất chính xác với số rất lớn/nhỏ. Cần test với data thực; nếu cần thiết đọc ra string rồi parse bằng `Decimal` lib.
- **previewToken in-memory** không scale ngang được. Trong phase này chạy 1 instance là OK; nếu cần scale → chuyển sang Redis.
- **Hierarchy bằng path** giả định không có 2 component cùng code trong cùng 1 parent. Nếu file thực tế có trường hợp này thì cần phân biệt thêm bằng `sortOrder`.
- **Cookie SameSite=Lax** đủ cho FE/BE cùng site. Nếu deploy khác domain (ví dụ FE ở Vercel, BE ở server khác) thì cần `SameSite=None; Secure` + HTTPS.
- **Mật khẩu mặc định `Aa123456` là constant cố định**. Nguy cơ: nếu admin reset cho user mà user không kịp đổi → ai biết constant cũng login được. Phase này chấp nhận do app nội bộ. Mitigation tương lai: yêu cầu đổi pass ngay lần login đầu sau reset (cờ `mustChangePassword` trên User).
- **Bootstrap admin qua `prisma db seed`** có mật khẩu mặc định công khai trong code. Production cần override bằng env var hoặc xóa seed sau lần chạy đầu.
