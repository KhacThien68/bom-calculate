# BOM Calculate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app for uploading hierarchical BOM Excel files, comparing diffs against existing data, persisting to MySQL, and viewing as expandable tree tables — with admin-managed user accounts.

**Architecture:** npm-workspace monorepo. NestJS + Prisma + MySQL backend exposing JWT-cookie-protected REST APIs. React + Vite frontend with React Router, TanStack Query (server state), Zustand (client state), Tailwind + shadcn/ui. Excel parsing happens on FE (SheetJS), diff comparison on BE with in-memory preview token.

**Tech Stack:** TypeScript everywhere · NestJS 10 · Prisma 5 · MySQL 8 · JWT (httpOnly cookies) · bcrypt · React 18 · Vite 5 · React Router 6 · TanStack Query 5 · Zustand 4 · Tailwind 3 · shadcn/ui · SheetJS (xlsx) · react-hook-form + zod · axios.

**Convention used in this plan:**
- All paths are relative to repo root `bom-calculate/` unless noted.
- Spec lives at `docs/superpowers/specs/2026-05-25-bom-calculate-design.md` — re-read sections when in doubt.
- No tests will be written (per spec Section 12). Each task ends with manual verification + commit.
- Commit messages follow Conventional Commits (`feat:`, `chore:`, `fix:`).
- Working directory for shell commands is shown as `[cwd: <path>]`. Use PowerShell on Windows.

---

## Phase 0 — Repo bootstrap

### Task 0.1: Initialize git repo + root files

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `README.md`

- [ ] **Step 1: Init git**

Run `[cwd: c:/Users/thiennk/projects/own_prj/bom-calculate]`:
```powershell
git init
git branch -M main
```
Expected: `Initialized empty Git repository in ...`

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
build
.env
.env.*.local
.DS_Store
*.log
coverage
.vite
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "bom-calculate",
  "private": true,
  "version": "0.0.1",
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev:backend": "npm --workspace backend run start:dev",
    "dev:frontend": "npm --workspace frontend run dev"
  }
}
```

- [ ] **Step 4: Create minimal `README.md`**

```markdown
# bom-calculate

Hierarchical BOM upload & viewer. Monorepo: `backend/` (NestJS + Prisma + MySQL) and `frontend/` (React + Vite).

See `docs/superpowers/specs/2026-05-25-bom-calculate-design.md` for design and `docs/superpowers/plans/2026-05-25-bom-calculate.md` for implementation steps.

## Quick start
See spec Section 11.
```

- [ ] **Step 5: Commit**

```powershell
git add .gitignore package.json README.md
git commit -m "chore: init monorepo workspace"
```

---

## Phase 1 — Backend skeleton (NestJS + Prisma + MySQL)

### Task 1.1: Scaffold NestJS backend

**Files:**
- Create: `backend/*` (full Nest scaffold)

- [ ] **Step 1: Generate Nest app into `backend/`**

Run `[cwd: bom-calculate]`:
```powershell
npx -y @nestjs/cli@10 new backend --package-manager npm --skip-git --strict
```
When prompted, accept defaults. Expected: `backend/` folder created with `src/`, `package.json`, `tsconfig.json`, etc.

- [ ] **Step 2: Remove generated `backend/.git` if any**

```powershell
if (Test-Path backend/.git) { Remove-Item -Recurse -Force backend/.git }
```

- [ ] **Step 3: Verify dev server starts**

```powershell
npm --workspace backend run start
```
Expected: logs `Nest application successfully started` on port 3000. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```powershell
git add backend
git commit -m "chore(backend): scaffold NestJS app"
```

### Task 1.2: Install backend runtime dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install Prisma + DB driver + auth libs**

```powershell
npm --workspace backend install @prisma/client @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt cookie-parser class-validator class-transformer uuid
```

- [ ] **Step 2: Install dev dependencies**

```powershell
npm --workspace backend install -D prisma @types/passport-jwt @types/bcrypt @types/cookie-parser @types/uuid ts-node
```

- [ ] **Step 3: Commit**

```powershell
git add backend/package.json package-lock.json
git commit -m "chore(backend): add prisma, jwt, bcrypt, validation deps"
```

### Task 1.3: Create `.env.example` and `.env`

**Files:**
- Create: `backend/.env.example`
- Create: `backend/.env` (NOT committed — .gitignore covers it)

- [ ] **Step 1: Write `backend/.env.example`**

```
DATABASE_URL="mysql://root:root@localhost:3306/bom_calculate"
JWT_ACCESS_SECRET="change-me-access"
JWT_REFRESH_SECRET="change-me-refresh"
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
FRONTEND_URL=http://localhost:5173
PORT=3000
COOKIE_SECURE=false
```

- [ ] **Step 2: Copy to actual `.env`**

```powershell
Copy-Item backend/.env.example backend/.env
```
Then edit `backend/.env` to match your local MySQL credentials.

- [ ] **Step 3: Commit example**

```powershell
git add backend/.env.example
git commit -m "chore(backend): add .env.example"
```

### Task 1.4: Initialize Prisma + write schema

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Run prisma init**

```powershell
npm --workspace backend exec -- prisma init --datasource-provider mysql
```
This creates `backend/prisma/schema.prisma` and a stub `backend/.env` (skip if exists).

- [ ] **Step 2: Replace `backend/prisma/schema.prisma` with full schema**

```prisma
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
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String   @map("password_hash")
  name         String?
  role         Role     @default(USER)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  bomsCreated Bom[] @relation("BomCreatedBy")
  bomsUpdated Bom[] @relation("BomUpdatedBy")

  @@map("users")
}

model Bom {
  id                  Int      @id @default(autoincrement())
  materialCode        String   @unique @map("material_code")
  materialDescription String   @map("material_description")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  createdByUserId     Int      @map("created_by_user_id")
  updatedByUserId     Int      @map("updated_by_user_id")

  createdBy User      @relation("BomCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy User      @relation("BomUpdatedBy", fields: [updatedByUserId], references: [id])
  items     BomItem[]

  @@map("boms")
}

model BomItem {
  id            Int      @id @default(autoincrement())
  bomId         Int      @map("bom_id")
  parentId      Int?     @map("parent_id")
  componentCode String   @map("component_code")
  componentName String   @map("component_name")
  quantity      Decimal  @db.Decimal(18, 6)
  uom           String
  level         Int
  sortOrder     Int      @map("sort_order")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  bom      Bom       @relation(fields: [bomId], references: [id], onDelete: Cascade)
  parent   BomItem?  @relation("BomItemTree", fields: [parentId], references: [id], onDelete: Cascade)
  children BomItem[] @relation("BomItemTree")

  @@index([bomId])
  @@index([parentId])
  @@index([bomId, componentCode])
  @@map("bom_items")
}
```

- [ ] **Step 3: Run migration**

Make sure MySQL is running and a database (or user with create-db perm) matches `DATABASE_URL`. Then:
```powershell
npm --workspace backend exec -- prisma migrate dev --name init
```
Expected: `Your database is now in sync with your schema.` Creates `backend/prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 4: Commit**

```powershell
git add backend/prisma
git commit -m "feat(backend): initial prisma schema (User, Bom, BomItem)"
```

### Task 1.5: Create Prisma seed (bootstrap admin)

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (add `prisma.seed` field)

- [ ] **Step 1: Write `backend/prisma/seed.ts`**

```ts
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Aa123456', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      name: 'Administrator',
      role: Role.ADMIN,
    },
  });
  console.log('Admin user ready:', { id: admin.id, username: admin.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Register seed command in `backend/package.json`**

Add at the top level of the JSON (sibling to `"scripts"`):
```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
```

- [ ] **Step 3: Run the seed**

```powershell
npm --workspace backend exec -- prisma db seed
```
Expected: `Admin user ready: { id: 1, username: 'admin' }`.

- [ ] **Step 4: Commit**

```powershell
git add backend/prisma/seed.ts backend/package.json package-lock.json
git commit -m "feat(backend): prisma seed for bootstrap admin"
```

### Task 1.6: Create PrismaModule + PrismaService

**Files:**
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`

- [ ] **Step 1: Write `backend/src/prisma/prisma.service.ts`**

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Write `backend/src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Register PrismaModule in `backend/src/app.module.ts`**

Replace contents with:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Install `@nestjs/config`**

```powershell
npm --workspace backend install @nestjs/config
```

- [ ] **Step 5: Commit**

```powershell
git add backend/src/prisma backend/src/app.module.ts backend/package.json package-lock.json
git commit -m "feat(backend): PrismaModule + PrismaService"
```

### Task 1.7: Configure `main.ts` (cookie-parser, CORS, ValidationPipe)

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Replace `backend/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Backend listening on http://localhost:${port}/api`);
}
bootstrap();
```

> Note: we add `/api` prefix so FE calls `/api/auth/login`, `/api/bom`, etc. Update spec mental model: paths in Section 5 become `/api/...`.

- [ ] **Step 2: Run and verify**

```powershell
npm --workspace backend run start:dev
```
Expected: `Backend listening on http://localhost:3000/api`. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```powershell
git add backend/src/main.ts
git commit -m "feat(backend): cookie-parser, CORS credentials, global /api prefix"
```

---

## Phase 2 — Backend Auth module

### Task 2.1: Common decorators + RolesGuard

**Files:**
- Create: `backend/src/common/decorators/roles.decorator.ts`
- Create: `backend/src/common/decorators/current-user.decorator.ts`
- Create: `backend/src/common/guards/roles.guard.ts`
- Create: `backend/src/common/guards/jwt-auth.guard.ts`

- [ ] **Step 1: Write `backend/src/common/decorators/roles.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: Write `backend/src/common/decorators/current-user.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUser {
  sub: number;
  username: string;
  role: 'ADMIN' | 'USER';
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayloadUser => ctx.switchToHttp().getRequest().user,
);
```

- [ ] **Step 3: Write `backend/src/common/guards/jwt-auth.guard.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 4: Write `backend/src/common/guards/roles.guard.ts`**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
```

- [ ] **Step 5: Commit**

```powershell
git add backend/src/common
git commit -m "feat(backend): JwtAuthGuard, RolesGuard, @Roles, @CurrentUser"
```

### Task 2.2: JwtStrategy with cookie extractor

**Files:**
- Create: `backend/src/auth/jwt.strategy.ts`
- Create: `backend/src/auth/jwt-refresh.strategy.ts`

- [ ] **Step 1: Write `backend/src/auth/jwt.strategy.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }
  async validate(payload: { sub: number; username: string; role: 'ADMIN' | 'USER' }) {
    return payload;
  }
}
```

- [ ] **Step 2: Write `backend/src/auth/jwt-refresh.strategy.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

const refreshCookieExtractor = (req: Request): string | null => {
  return req?.cookies?.refresh_token ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([refreshCookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET!,
    });
  }
  async validate(payload: { sub: number; username: string; role: 'ADMIN' | 'USER' }) {
    return payload;
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git add backend/src/auth
git commit -m "feat(backend): jwt access + refresh passport strategies"
```

### Task 2.3: AuthService (login, refresh, change password)

**Files:**
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/dto/login.dto.ts`
- Create: `backend/src/auth/dto/change-password.dto.ts`

- [ ] **Step 1: Write `backend/src/auth/dto/login.dto.ts`**

```ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

- [ ] **Step 2: Write `backend/src/auth/dto/change-password.dto.ts`**

```ts
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'newPassword must contain both letters and numbers',
  })
  newPassword!: string;
}
```

- [ ] **Step 3: Write `backend/src/auth/auth.service.ts`**

```ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  signTokens(user: { id: number; username: string; role: 'ADMIN' | 'USER' }): AuthTokens {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      accessToken: this.jwt.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET!,
        expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900),
      }),
      refreshToken: this.jwt.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET!,
        expiresIn: Number(process.env.JWT_REFRESH_TTL ?? 604800),
      }),
    };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
```

- [ ] **Step 4: Commit**

```powershell
git add backend/src/auth
git commit -m "feat(backend): AuthService (login, sign tokens, change password)"
```

### Task 2.4: AuthController (login, refresh, logout, me, change-password)

**Files:**
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.module.ts`

- [ ] **Step 1: Write `backend/src/auth/auth.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

const accessCookieOpts = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  path: '/',
  maxAge: Number(process.env.JWT_ACCESS_TTL ?? 900) * 1000,
});

const refreshCookieOpts = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: Number(process.env.JWT_REFRESH_TTL ?? 604800) * 1000,
});

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(dto.username, dto.password);
    const { accessToken, refreshToken } = this.auth.signTokens(user);
    res.cookie('access_token', accessToken, accessCookieOpts());
    res.cookie('refresh_token', refreshToken, refreshCookieOpts());
    return { user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(@CurrentUser() payload: JwtPayloadUser, @Res({ passthrough: true }) res: Response) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/api/auth' });
      return { ok: false };
    }
    const { accessToken } = this.auth.signTokens(user);
    res.cookie('access_token', accessToken, accessCookieOpts());
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() payload: JwtPayloadUser) {
    const u = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!u) return null;
    return { id: u.id, username: u.username, name: u.name, role: u.role };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() payload: JwtPayloadUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(payload.sub, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Write `backend/src/auth/auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 3: Register AuthModule in `backend/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Smoke test**

Start backend (`npm --workspace backend run start:dev`), then in another terminal:
```powershell
curl -i -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Aa123456\"}"
```
Expected: status `200`, two `Set-Cookie` headers (`access_token`, `refresh_token`), JSON body with `user`. Stop server.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/auth backend/src/app.module.ts
git commit -m "feat(backend): auth endpoints (login, refresh, logout, me, change-password)"
```

---

## Phase 3 — Backend Users module (admin only)

### Task 3.1: UsersService

**Files:**
- Create: `backend/src/users/users.service.ts`
- Create: `backend/src/users/dto/create-user.dto.ts`

- [ ] **Step 1: Write `backend/src/users/dto/create-user.dto.ts`**

```ts
import { IsString, MinLength, Matches, IsIn, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain both letters and numbers',
  })
  password!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'USER'])
  role?: Role;
}
```

- [ ] **Step 2: Write `backend/src/users/users.service.ts`**

```ts
import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_RESET_PASSWORD = 'Aa123456';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(input: { username: string; name: string; password: string; role?: Role }) {
    const exists = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw new ConflictException('Username already exists');
    const passwordHash = await bcrypt.hash(input.password, 10);
    const u = await this.prisma.user.create({
      data: {
        username: input.username,
        name: input.name,
        passwordHash,
        role: input.role ?? Role.USER,
      },
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    return u;
  }

  async resetPassword(targetUserId: number, requesterUserId: number) {
    if (targetUserId === requesterUserId) {
      throw new BadRequestException('Admin cannot reset their own password here. Use change-password.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);
    await this.prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });
    return { ok: true, defaultPassword: DEFAULT_RESET_PASSWORD };
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git add backend/src/users
git commit -m "feat(backend): UsersService (list, create, resetPassword)"
```

### Task 3.2: UsersController + UsersModule

**Files:**
- Create: `backend/src/users/users.controller.ts`
- Create: `backend/src/users/users.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write `backend/src/users/users.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() me: JwtPayloadUser,
  ) {
    return this.users.resetPassword(id, me.sub);
  }
}
```

- [ ] **Step 2: Write `backend/src/users/users.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 3: Register in `backend/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Smoke test (login first, then list users)**

Start backend. Use curl with cookie jar:
```powershell
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Aa123456\"}"
curl -b cookies.txt http://localhost:3000/api/users
```
Expected: JSON array with admin user. Stop server. Delete `cookies.txt`.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/users backend/src/app.module.ts
git commit -m "feat(backend): UsersController (admin-only list/create/reset-password)"
```

---

## Phase 4 — Backend BOM module

### Task 4.1: BOM module skeleton, DTOs, types

**Files:**
- Create: `backend/src/bom/dto/preview-bom.dto.ts`
- Create: `backend/src/bom/dto/commit-bom.dto.ts`
- Create: `backend/src/bom/bom.types.ts`

- [ ] **Step 1: Write `backend/src/bom/bom.types.ts`**

```ts
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
  mode: UploadMode;
  items: PreviewItemInput[];
  diff: DiffResponse;
  expiresAt: number;
}
```

- [ ] **Step 2: Write `backend/src/bom/dto/preview-bom.dto.ts`**

```ts
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewItemDto {
  @IsInt()
  @Min(1)
  level!: number;

  @IsString()
  @MinLength(1)
  componentCode!: string;

  @IsString()
  @MinLength(1)
  componentName!: string;

  @IsNumber()
  quantity!: number;

  @IsString()
  @MinLength(1)
  uom!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsInt()
  parentSortOrder!: number | null;
}

export class PreviewBomDto {
  @IsString()
  @MinLength(1)
  materialCode!: string;

  @IsString()
  @MinLength(1)
  materialDescription!: string;

  @IsIn(['full', 'append'])
  mode!: 'full' | 'append';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewItemDto)
  items!: PreviewItemDto[];
}
```

- [ ] **Step 3: Write `backend/src/bom/dto/commit-bom.dto.ts`**

```ts
import { IsString, IsUUID } from 'class-validator';

export class CommitBomDto {
  @IsString()
  @IsUUID()
  previewToken!: string;
}
```

- [ ] **Step 4: Commit**

```powershell
git add backend/src/bom
git commit -m "feat(backend): BOM DTOs and shared types"
```

### Task 4.2: PreviewCache service (in-memory TTL store)

**Files:**
- Create: `backend/src/bom/preview-cache.service.ts`

- [ ] **Step 1: Write `backend/src/bom/preview-cache.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { CachedPreview } from './bom.types';

const TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PreviewCacheService {
  private store = new Map<string, CachedPreview>();

  set(token: string, payload: Omit<CachedPreview, 'expiresAt'>) {
    this.store.set(token, { ...payload, expiresAt: Date.now() + TTL_MS });
  }

  get(token: string): CachedPreview | null {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(token);
      return null;
    }
    return entry;
  }

  delete(token: string) {
    this.store.delete(token);
  }

  sweep() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add backend/src/bom/preview-cache.service.ts
git commit -m "feat(backend): in-memory preview token cache"
```

### Task 4.3: BomService — list, getTree

**Files:**
- Create: `backend/src/bom/bom.service.ts`

- [ ] **Step 1: Write initial `backend/src/bom/bom.service.ts` (list + getTree only; diff/commit added next)**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BomService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const boms = await this.prisma.bom.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        materialCode: true,
        materialDescription: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
    return boms.map((b) => ({
      id: b.id,
      materialCode: b.materialCode,
      materialDescription: b.materialDescription,
      updatedAt: b.updatedAt,
      itemCount: b._count.items,
    }));
  }

  async getTree(materialCode: string) {
    const bom = await this.prisma.bom.findUnique({
      where: { materialCode },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!bom) throw new NotFoundException('BOM not found');
    return {
      id: bom.id,
      materialCode: bom.materialCode,
      materialDescription: bom.materialDescription,
      updatedAt: bom.updatedAt,
      items: bom.items.map((it) => ({
        id: it.id,
        parentId: it.parentId,
        componentCode: it.componentCode,
        componentName: it.componentName,
        quantity: Number(it.quantity),
        uom: it.uom,
        level: it.level,
        sortOrder: it.sortOrder,
      })),
    };
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add backend/src/bom/bom.service.ts
git commit -m "feat(backend): BomService list + getTree"
```

### Task 4.4: BomService — diff (preview) logic

**Files:**
- Modify: `backend/src/bom/bom.service.ts`

- [ ] **Step 1: Append diff method to `BomService`. Replace the class with:**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewCacheService } from './preview-cache.service';
import {
  DiffResponse,
  DiffResultItem,
  PreviewItemInput,
  UploadMode,
} from './bom.types';

@Injectable()
export class BomService {
  constructor(
    private prisma: PrismaService,
    private cache: PreviewCacheService,
  ) {}

  async list() {
    const boms = await this.prisma.bom.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        materialCode: true,
        materialDescription: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
    return boms.map((b) => ({
      id: b.id,
      materialCode: b.materialCode,
      materialDescription: b.materialDescription,
      updatedAt: b.updatedAt,
      itemCount: b._count.items,
    }));
  }

  async getTree(materialCode: string) {
    const bom = await this.prisma.bom.findUnique({
      where: { materialCode },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!bom) throw new NotFoundException('BOM not found');
    return {
      id: bom.id,
      materialCode: bom.materialCode,
      materialDescription: bom.materialDescription,
      updatedAt: bom.updatedAt,
      items: bom.items.map((it) => ({
        id: it.id,
        parentId: it.parentId,
        componentCode: it.componentCode,
        componentName: it.componentName,
        quantity: Number(it.quantity),
        uom: it.uom,
        level: it.level,
        sortOrder: it.sortOrder,
      })),
    };
  }

  /**
   * Resolve parent path (array of componentCode from root to parent) for each input item,
   * using parentSortOrder pointers.
   */
  private buildIncomingPaths(items: PreviewItemInput[]): Map<number, string[]> {
    const bySortOrder = new Map<number, PreviewItemInput>();
    for (const it of items) bySortOrder.set(it.sortOrder, it);
    const pathBySort = new Map<number, string[]>();
    const compute = (it: PreviewItemInput): string[] => {
      if (pathBySort.has(it.sortOrder)) return pathBySort.get(it.sortOrder)!;
      let path: string[];
      if (it.parentSortOrder == null) {
        path = [];
      } else {
        const parent = bySortOrder.get(it.parentSortOrder);
        if (!parent) {
          throw new Error(`Invalid parentSortOrder ${it.parentSortOrder} on item ${it.componentCode}`);
        }
        path = [...compute(parent), parent.componentCode];
      }
      pathBySort.set(it.sortOrder, path);
      return path;
    };
    for (const it of items) compute(it);
    return pathBySort;
  }

  /**
   * Build the path key (joined string) used to identify a node in the tree.
   */
  private pathKey(path: string[], componentCode: string): string {
    return [...path, componentCode].join('\x1f');
  }

  async preview(opts: {
    materialCode: string;
    materialDescription: string;
    mode: UploadMode;
    items: PreviewItemInput[];
  }): Promise<DiffResponse> {
    const existing = await this.prisma.bom.findUnique({
      where: { materialCode: opts.materialCode },
      include: { items: true },
    });

    const oldByKey = new Map<
      string,
      { componentName: string; quantity: number; uom: string; path: string[] }
    >();
    if (existing) {
      const byId = new Map(existing.items.map((it) => [it.id, it]));
      const pathById = new Map<number, string[]>();
      const computeOld = (id: number): string[] => {
        if (pathById.has(id)) return pathById.get(id)!;
        const it = byId.get(id)!;
        const path = it.parentId == null ? [] : [...computeOld(it.parentId), byId.get(it.parentId)!.componentCode];
        pathById.set(id, path);
        return path;
      };
      for (const it of existing.items) {
        const path = computeOld(it.id);
        oldByKey.set(this.pathKey(path, it.componentCode), {
          componentName: it.componentName,
          quantity: Number(it.quantity),
          uom: it.uom,
          path,
        });
      }
    }

    const incomingPaths = this.buildIncomingPaths(opts.items);
    const newByKey = new Map<string, PreviewItemInput & { parentPath: string[] }>();
    for (const it of opts.items) {
      const parentPath = incomingPaths.get(it.sortOrder)!;
      newByKey.set(this.pathKey(parentPath, it.componentCode), { ...it, parentPath });
    }

    const diffItems: DiffResultItem[] = [];
    const summary = { new: 0, changed: 0, unchanged: 0, removed: 0 };

    for (const [key, n] of newByKey) {
      const old = oldByKey.get(key);
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
      } else if (
        old.componentName === n.componentName &&
        old.quantity === n.quantity &&
        old.uom === n.uom
      ) {
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
    }

    if (opts.mode === 'full') {
      for (const [key, o] of oldByKey) {
        if (!newByKey.has(key)) {
          const codes = key.split('');
          const componentCode = codes[codes.length - 1];
          diffItems.push({
            status: 'removed',
            level: o.path.length + 1,
            componentCode,
            componentName: o.componentName,
            quantity: o.quantity,
            uom: o.uom,
            parentPath: o.path,
          });
          summary.removed++;
        }
      }
    }

    const previewToken = uuidv4();
    const diff: DiffResponse = {
      previewToken,
      bomExists: !!existing,
      summary,
      items: diffItems,
    };
    this.cache.set(previewToken, {
      materialCode: opts.materialCode,
      materialDescription: opts.materialDescription,
      mode: opts.mode,
      items: opts.items,
      diff,
    });
    return diff;
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add backend/src/bom/bom.service.ts
git commit -m "feat(backend): BOM diff/preview with in-memory token"
```

### Task 4.5: BomService — commit (transaction)

**Files:**
- Modify: `backend/src/bom/bom.service.ts`

- [ ] **Step 1: Add `commit(token, userId)` method to the BomService class (insert above the closing brace `}`):**

```ts
  async commit(token: string, userId: number) {
    const cached = this.cache.get(token);
    if (!cached) {
      throw new NotFoundException('Preview token expired or invalid');
    }
    const { materialCode, materialDescription, mode, items } = cached;

    const result = await this.prisma.$transaction(async (tx) => {
      let bom = await tx.bom.findUnique({
        where: { materialCode },
        include: { items: true },
      });

      if (!bom) {
        bom = await tx.bom.create({
          data: {
            materialCode,
            materialDescription,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
          include: { items: true },
        });
      } else {
        await tx.bom.update({
          where: { id: bom.id },
          data: { materialDescription, updatedByUserId: userId },
        });
      }

      const existingById = new Map(bom.items.map((it) => [it.id, it]));
      const existingPathToId = new Map<string, number>();
      const computePath = (id: number): string[] => {
        const it = existingById.get(id);
        if (!it) return [];
        return it.parentId == null
          ? []
          : [...computePath(it.parentId), existingById.get(it.parentId)!.componentCode];
      };
      for (const it of bom.items) {
        const key = [...computePath(it.id), it.componentCode].join('\x1f');
        existingPathToId.set(key, it.id);
      }

      const incomingBySort = new Map(items.map((it) => [it.sortOrder, it]));
      const incomingPath = new Map<number, string[]>();
      const compute = (sort: number): string[] => {
        if (incomingPath.has(sort)) return incomingPath.get(sort)!;
        const it = incomingBySort.get(sort)!;
        const p = it.parentSortOrder == null
          ? []
          : [...compute(it.parentSortOrder), incomingBySort.get(it.parentSortOrder)!.componentCode];
        incomingPath.set(sort, p);
        return p;
      };
      for (const it of items) compute(it.sortOrder);

      const incomingPathKeys = new Set<string>();
      for (const it of items) {
        const p = incomingPath.get(it.sortOrder)!;
        incomingPathKeys.add([...p, it.componentCode].join('\x1f'));
      }

      if (mode === 'full') {
        const toRemoveIds: number[] = [];
        for (const [pathKey, id] of existingPathToId) {
          if (!incomingPathKeys.has(pathKey)) toRemoveIds.push(id);
        }
        if (toRemoveIds.length > 0) {
          await tx.bomItem.deleteMany({ where: { id: { in: toRemoveIds } } });
        }
      }

      const sortedItems = [...items].sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
      const newIdBySort = new Map<number, number>();

      for (const it of sortedItems) {
        const path = incomingPath.get(it.sortOrder)!;
        const key = [...path, it.componentCode].join('\x1f');
        const existingId = existingPathToId.get(key);
        const parentId =
          it.parentSortOrder == null
            ? null
            : newIdBySort.get(it.parentSortOrder) ?? (() => {
                const parentItem = incomingBySort.get(it.parentSortOrder!)!;
                const parentPath = incomingPath.get(parentItem.sortOrder)!;
                const parentKey = [...parentPath, parentItem.componentCode].join('\x1f');
                return existingPathToId.get(parentKey) ?? null;
              })();

        if (existingId) {
          await tx.bomItem.update({
            where: { id: existingId },
            data: {
              componentName: it.componentName,
              quantity: it.quantity,
              uom: it.uom,
              level: it.level,
              sortOrder: it.sortOrder,
              parentId,
            },
          });
          newIdBySort.set(it.sortOrder, existingId);
        } else {
          const created = await tx.bomItem.create({
            data: {
              bomId: bom!.id,
              parentId,
              componentCode: it.componentCode,
              componentName: it.componentName,
              quantity: it.quantity,
              uom: it.uom,
              level: it.level,
              sortOrder: it.sortOrder,
            },
          });
          newIdBySort.set(it.sortOrder, created.id);
          existingPathToId.set(key, created.id);
        }
      }

      return { materialCode };
    });

    this.cache.delete(token);
    return result;
  }
```

- [ ] **Step 2: Commit**

```powershell
git add backend/src/bom/bom.service.ts
git commit -m "feat(backend): BOM commit transaction (full/append modes)"
```

### Task 4.6: BomController + BomModule

**Files:**
- Create: `backend/src/bom/bom.controller.ts`
- Create: `backend/src/bom/bom.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write `backend/src/bom/bom.controller.ts`**

```ts
import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { BomService } from './bom.service';
import { PreviewBomDto } from './dto/preview-bom.dto';
import { CommitBomDto } from './dto/commit-bom.dto';

@Controller('bom')
@UseGuards(JwtAuthGuard)
export class BomController {
  constructor(private bom: BomService) {}

  @Get()
  list() {
    return this.bom.list();
  }

  @Get(':materialCode')
  getOne(@Param('materialCode') materialCode: string) {
    return this.bom.getTree(materialCode);
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewBomDto) {
    return this.bom.preview(dto);
  }

  @Post('commit')
  @HttpCode(200)
  commit(@Body() dto: CommitBomDto, @CurrentUser() user: JwtPayloadUser) {
    return this.bom.commit(dto.previewToken, user.sub);
  }
}
```

- [ ] **Step 2: Write `backend/src/bom/bom.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';
import { PreviewCacheService } from './preview-cache.service';

@Module({
  controllers: [BomController],
  providers: [BomService, PreviewCacheService],
})
export class BomModule {}
```

- [ ] **Step 3: Register in `backend/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BomModule } from './bom/bom.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BomModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Smoke test**

Start backend. Login (as Task 3.2 step 4), then:
```powershell
curl -b cookies.txt http://localhost:3000/api/bom
```
Expected: `[]` (empty list).

```powershell
$body = '{\"materialCode\":\"X1\",\"materialDescription\":\"Test\",\"mode\":\"full\",\"items\":[{\"level\":1,\"componentCode\":\"A\",\"componentName\":\"Alpha\",\"quantity\":10,\"uom\":\"PC\",\"sortOrder\":0,\"parentSortOrder\":null}]}'
curl -b cookies.txt -X POST http://localhost:3000/api/bom/preview -H "Content-Type: application/json" -d $body
```
Expected: JSON with `previewToken`, `summary: {new:1, ...}`. Stop server.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/bom backend/src/app.module.ts
git commit -m "feat(backend): BOM controller (list, getTree, preview, commit)"
```

---

## Phase 5 — Frontend skeleton (Vite + Tailwind + shadcn)

### Task 5.1: Scaffold Vite React-TS frontend

**Files:**
- Create: `frontend/*`

- [ ] **Step 1: Scaffold with Vite**

Run `[cwd: bom-calculate]`:
```powershell
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install base deps**

```powershell
npm --workspace frontend install
```

- [ ] **Step 3: Verify dev server**

```powershell
npm --workspace frontend run dev
```
Expected: Vite serves on http://localhost:5173. Stop.

- [ ] **Step 4: Commit**

```powershell
git add frontend
git commit -m "chore(frontend): scaffold Vite + React + TypeScript"
```

### Task 5.2: Install FE runtime deps

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install**

```powershell
npm --workspace frontend install react-router-dom @tanstack/react-query zustand axios react-hook-form @hookform/resolvers zod xlsx sonner clsx tailwind-merge class-variance-authority lucide-react
```

- [ ] **Step 2: Install Tailwind devDeps**

```powershell
npm --workspace frontend install -D tailwindcss postcss autoprefixer @types/node
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/package.json package-lock.json
git commit -m "chore(frontend): add router, query, zustand, axios, forms, xlsx, tailwind deps"
```

### Task 5.3: Configure Tailwind + shadcn theming

**Files:**
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/src/index.css`
- Modify: `frontend/tsconfig.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/components.json`

- [ ] **Step 1: Init Tailwind**

```powershell
npm --workspace frontend exec -- tailwindcss init -p
```
(Creates `tailwind.config.js` and `postcss.config.js`.)

- [ ] **Step 2: Replace `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Replace `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 4: Add `@/` alias in `frontend/tsconfig.json`**

Inside `compilerOptions`, add (or extend):
```json
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
```
Ensure the same alias is also in `tsconfig.app.json` if present (mirror the `compilerOptions` block).

- [ ] **Step 5: Add path alias in `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
});
```

- [ ] **Step 6: Create `frontend/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Create `frontend/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 8: Verify dev server compiles**

```powershell
npm --workspace frontend run dev
```
Expected: page loads with default React boilerplate styled with Tailwind base. Stop.

- [ ] **Step 9: Commit**

```powershell
git add frontend
git commit -m "chore(frontend): tailwind + shadcn theme setup"
```

### Task 5.4: Install shadcn/ui base components

**Files:**
- Create: `frontend/src/components/ui/*.tsx`

- [ ] **Step 1: Use shadcn CLI to add components**

```powershell
npm --workspace frontend exec -- shadcn@latest init -y -d
npm --workspace frontend exec -- shadcn@latest add button input label card table dropdown-menu dialog alert-dialog form select badge sonner -y
```
Expected: components scaffolded under `frontend/src/components/ui/`.

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/components/ui frontend/components.json frontend/src/lib
git commit -m "chore(frontend): add shadcn/ui base components"
```

### Task 5.5: Configure axios client + .env

**Files:**
- Create: `frontend/.env.example`
- Create: `frontend/.env`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/queryClient.ts`

- [ ] **Step 1: Write `frontend/.env.example`**

```
VITE_API_BASE_URL=http://localhost:3000/api
```

- [ ] **Step 2: Copy to `.env`**

```powershell
Copy-Item frontend/.env.example frontend/.env
```

- [ ] **Step 3: Write `frontend/src/lib/api.ts`**

```ts
import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let queue: Array<() => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve) => {
          queue.push(() => resolve(api(original)));
        });
      }
      isRefreshing = true;
      try {
        await api.post('/auth/refresh');
        queue.forEach((cb) => cb());
        queue = [];
        return api(original);
      } catch (e) {
        queue = [];
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
```

- [ ] **Step 4: Write `frontend/src/lib/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 0, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/.env.example frontend/src/lib
git commit -m "feat(frontend): axios instance with refresh interceptor + query client"
```

### Task 5.6: Router skeleton + AppLayout

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/hooks/useMe.ts`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/components/AdminRoute.tsx`
- Create: `frontend/src/components/AppLayout.tsx`
- Create: `frontend/src/pages/LoginPage.tsx` (placeholder)
- Create: `frontend/src/pages/BomListPage.tsx` (placeholder)
- Create: `frontend/src/pages/BomDetailPage.tsx` (placeholder)
- Create: `frontend/src/pages/UploadPage.tsx` (placeholder)
- Create: `frontend/src/pages/UsersPage.tsx` (placeholder)
- Create: `frontend/src/pages/UserCreatePage.tsx` (placeholder)
- Create: `frontend/src/pages/ChangePasswordPage.tsx` (placeholder)
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write `frontend/src/types/index.ts`**

```ts
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
  parentPath: string[];
  oldValues?: { componentName: string; quantity: number; uom: string };
}

export interface DiffResponse {
  previewToken: string;
  bomExists: boolean;
  summary: { new: number; changed: number; unchanged: number; removed: number };
  items: DiffItem[];
}
```

- [ ] **Step 2: Write `frontend/src/hooks/useMe.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Me } from '@/types';

export function useMe() {
  return useQuery({
    queryKey: ['me'] as const,
    queryFn: async (): Promise<Me | null> => {
      try {
        const { data } = await api.get<Me>('/auth/me');
        return data;
      } catch {
        return null;
      }
    },
  });
}
```

- [ ] **Step 3: Write `frontend/src/components/ProtectedRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';

export function ProtectedRoute() {
  const { data, isLoading } = useMe();
  if (isLoading) return <div className="p-8">Loading…</div>;
  if (!data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

- [ ] **Step 4: Write `frontend/src/components/AdminRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';

export function AdminRoute() {
  const { data } = useMe();
  if (data?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}
```

- [ ] **Step 5: Write `frontend/src/components/AppLayout.tsx`**

```tsx
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/hooks/useMe';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });

  const navItem =
    'px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground';
  const active = 'bg-accent text-accent-foreground';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Link to="/" className="font-semibold">BOM Calculate</Link>
            <nav className="ml-4 flex items-center gap-1">
              <NavLink to="/" end className={({ isActive }) => cn(navItem, isActive && active)}>Danh sách BOM</NavLink>
              <NavLink to="/upload" className={({ isActive }) => cn(navItem, isActive && active)}>Upload</NavLink>
              {me?.role === 'ADMIN' && (
                <NavLink to="/users" className={({ isActive }) => cn(navItem, isActive && active)}>Quản lý user</NavLink>
              )}
            </nav>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">{me?.name ?? me?.username}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/account/change-password')}>
                Đổi mật khẩu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout.mutate()}>
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="container flex-1 py-6"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 6: Create placeholder pages**

For each path below, create a one-line stub:

`frontend/src/pages/LoginPage.tsx`:
```tsx
export default function LoginPage() { return <div>Login</div>; }
```

Repeat with the matching name for: `BomListPage.tsx`, `BomDetailPage.tsx`, `UploadPage.tsx`, `UsersPage.tsx`, `UserCreatePage.tsx`, `ChangePasswordPage.tsx` (each returns `<div>{Name}</div>`).

- [ ] **Step 7: Replace `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { AppLayout } from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import BomListPage from '@/pages/BomListPage';
import BomDetailPage from '@/pages/BomDetailPage';
import UploadPage from '@/pages/UploadPage';
import UsersPage from '@/pages/UsersPage';
import UserCreatePage from '@/pages/UserCreatePage';
import ChangePasswordPage from '@/pages/ChangePasswordPage';

export default function App() {
  return (
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Replace `frontend/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import { queryClient } from '@/lib/queryClient';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster richColors />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 9: Run dev**

```powershell
npm --workspace frontend run dev
```
Expected: navigating to http://localhost:5173 redirects to `/login` (because `/auth/me` returns 401 with no cookie). Stop.

- [ ] **Step 10: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): router, protected/admin routes, AppLayout, placeholder pages"
```

---

## Phase 6 — Frontend Auth pages

### Task 6.1: LoginPage

**Files:**
- Create: `frontend/src/schemas/auth.schema.ts`
- Modify: `frontend/src/pages/LoginPage.tsx`

- [ ] **Step 1: Write `frontend/src/schemas/auth.schema.ts`**

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Bắt buộc'),
  password: z.string().min(1, 'Bắt buộc'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Bắt buộc'),
    newPassword: z
      .string()
      .min(6, 'Tối thiểu 6 ký tự')
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Phải có cả chữ và số'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
```

- [ ] **Step 2: Replace `frontend/src/pages/LoginPage.tsx`**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/useMe';
import { loginSchema, type LoginInput } from '@/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post('/auth/login', input);
      return data.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(['me'], user);
      navigate('/', { replace: true });
    },
    onError: () => {
      toast.error('Đăng nhập thất bại');
    },
  });

  if (isLoading) return null;
  if (me) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Đăng nhập</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => login.mutate(v))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input id="username" autoFocus {...register('username')} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Start backend + frontend. Open http://localhost:5173/login. Login with `admin / Aa123456`. Expected: redirect to `/` showing BomListPage placeholder + header.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): login page + auth schemas"
```

### Task 6.2: ChangePasswordPage

**Files:**
- Modify: `frontend/src/pages/ChangePasswordPage.tsx`

- [ ] **Step 1: Replace `frontend/src/pages/ChangePasswordPage.tsx`**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ChangePasswordPage() {
  const {
    register, handleSubmit, reset, setError, formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const mut = useMutation({
    mutationFn: async (v: ChangePasswordInput) => {
      await api.post('/auth/change-password', {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
    },
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
      reset();
    },
    onError: (err: any) => {
      if (err?.response?.status === 400) {
        setError('currentPassword', { message: 'Mật khẩu hiện tại không đúng' });
      } else {
        toast.error('Đổi mật khẩu thất bại');
      }
    },
  });

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>Đổi mật khẩu</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input id="currentPassword" type="password" {...register('currentPassword')} />
            {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input id="newPassword" type="password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
            <Input id="confirmNewPassword" type="password" {...register('confirmNewPassword')} />
            {errors.confirmNewPassword && <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>}
          </div>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Smoke test**

Login → click avatar → "Đổi mật khẩu". Try wrong current password → expect inline error. Try matching new+confirm but mismatched current → expect inline error. Stop.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/pages/ChangePasswordPage.tsx
git commit -m "feat(frontend): change password page"
```

---

## Phase 7 — Frontend User management

### Task 7.1: UsersPage (list + reset password)

**Files:**
- Create: `frontend/src/hooks/useUsers.ts`
- Modify: `frontend/src/pages/UsersPage.tsx`

- [ ] **Step 1: Write `frontend/src/hooks/useUsers.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserListRow {
  id: number;
  username: string;
  name: string | null;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  updatedAt: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'] as const,
    queryFn: async () => (await api.get<UserListRow[]>('/users')).data,
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<{ ok: true; defaultPassword: string }>(`/users/${id}/reset-password`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

- [ ] **Step 2: Replace `frontend/src/pages/UsersPage.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useUsers, useResetPassword } from '@/hooks/useUsers';
import { useMe } from '@/hooks/useMe';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function UsersPage() {
  const { data: me } = useMe();
  const { data: users = [], isLoading } = useUsers();
  const reset = useResetPassword();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quản lý user</h1>
        <Button asChild><Link to="/users/new">Tạo user mới</Link></Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Tạo lúc</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>Đang tải…</TableCell></TableRow>
          ) : users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.id}</TableCell>
              <TableCell className="font-mono">{u.username}</TableCell>
              <TableCell>{u.name}</TableCell>
              <TableCell>
                <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role}</Badge>
              </TableCell>
              <TableCell>{new Date(u.createdAt).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={u.id === me?.id}
                    >Reset password</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset password cho {u.username}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Mật khẩu sẽ được đặt về <strong>Aa123456</strong>. Bạn cần thông báo cho user qua kênh khác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Huỷ</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => reset.mutate(u.id, {
                          onSuccess: () => toast.success(`Đã reset mật khẩu ${u.username} về Aa123456`),
                          onError: () => toast.error('Reset thất bại'),
                        })}
                      >Xác nhận</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Login admin → "/users" → see admin row → "Reset password" disabled on own row. Stop.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): users list page + reset password"
```

### Task 7.2: UserCreatePage

**Files:**
- Create: `frontend/src/schemas/user.schema.ts`
- Modify: `frontend/src/pages/UserCreatePage.tsx`

- [ ] **Step 1: Write `frontend/src/schemas/user.schema.ts`**

```ts
import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(1, 'Bắt buộc'),
  password: z
    .string()
    .min(6, 'Tối thiểu 6 ký tự')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Phải có cả chữ và số'),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

- [ ] **Step 2: Replace `frontend/src/pages/UserCreatePage.tsx`**

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { createUserSchema, type CreateUserInput } from '@/schemas/user.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function UserCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register, handleSubmit, control, formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: '', name: '', password: '', role: 'USER' },
  });

  const mut = useMutation({
    mutationFn: async (v: CreateUserInput) => (await api.post('/users', v)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Tạo user thành công');
      navigate('/users');
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) toast.error('Username đã tồn tại');
      else toast.error('Tạo user thất bại');
    },
  });

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>Tạo user mới</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...register('username')} />
            {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Tên</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? 'Đang tạo…' : 'Tạo'}</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/users')}>Huỷ</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Smoke test**

Create a user `bob / Bob123` (role USER) → expect redirect to `/users` with bob listed. Stop.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): create user page"
```

---

## Phase 8 — Frontend BOM list & detail

### Task 8.1: BomListPage

**Files:**
- Create: `frontend/src/hooks/useBom.ts`
- Modify: `frontend/src/pages/BomListPage.tsx`

- [ ] **Step 1: Write `frontend/src/hooks/useBom.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BomDetail, BomListItem } from '@/types';

export function useBomList() {
  return useQuery({
    queryKey: ['boms'] as const,
    queryFn: async () => (await api.get<BomListItem[]>('/bom')).data,
  });
}

export function useBomDetail(materialCode: string | undefined) {
  return useQuery({
    queryKey: ['bom', materialCode] as const,
    enabled: !!materialCode,
    queryFn: async () => (await api.get<BomDetail>(`/bom/${materialCode}`)).data,
  });
}
```

- [ ] **Step 2: Replace `frontend/src/pages/BomListPage.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { useBomList } from '@/hooks/useBom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BomListPage() {
  const { data = [], isLoading } = useBomList();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Danh sách BOM</h1>
        <Button asChild><Link to="/upload">Upload BOM mới</Link></Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Số item</TableHead>
            <TableHead>Cập nhật</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={4}>Đang tải…</TableCell></TableRow>
          ) : data.length === 0 ? (
            <TableRow><TableCell colSpan={4}>Chưa có BOM nào</TableCell></TableRow>
          ) : data.map((b) => (
            <TableRow key={b.id} className="cursor-pointer">
              <TableCell className="font-mono">
                <Link to={`/bom/${b.materialCode}`} className="hover:underline">{b.materialCode}</Link>
              </TableCell>
              <TableCell>{b.materialDescription}</TableCell>
              <TableCell>{b.itemCount}</TableCell>
              <TableCell>{new Date(b.updatedAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): BOM list page"
```

### Task 8.2: bomTreeUi Zustand store

**Files:**
- Create: `frontend/src/stores/bomTreeUi.store.ts`

- [ ] **Step 1: Write `frontend/src/stores/bomTreeUi.store.ts`**

```ts
import { create } from 'zustand';

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
  toggle: (materialCode, itemId) =>
    set((s) => {
      const current = new Set(s.expandedByBom[materialCode] ?? []);
      if (current.has(itemId)) current.delete(itemId);
      else current.add(itemId);
      return { expandedByBom: { ...s.expandedByBom, [materialCode]: current } };
    }),
  isExpanded: (materialCode, itemId) =>
    get().expandedByBom[materialCode]?.has(itemId) ?? false,
  expandAll: (materialCode, ids) =>
    set((s) => ({
      expandedByBom: { ...s.expandedByBom, [materialCode]: new Set(ids) },
    })),
  collapseAll: (materialCode) =>
    set((s) => ({ expandedByBom: { ...s.expandedByBom, [materialCode]: new Set() } })),
  clear: () => set({ expandedByBom: {} }),
}));
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/stores
git commit -m "feat(frontend): bomTreeUi zustand store"
```

### Task 8.3: BomDetailPage with expandable tree table

**Files:**
- Create: `frontend/src/components/BomTreeTable.tsx`
- Modify: `frontend/src/pages/BomDetailPage.tsx`

- [ ] **Step 1: Write `frontend/src/components/BomTreeTable.tsx`**

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useBomTreeUiStore } from '@/stores/bomTreeUi.store';
import type { BomItem } from '@/types';

interface Props {
  materialCode: string;
  items: BomItem[];
}

interface TreeNode extends BomItem {
  children: TreeNode[];
}

function buildTree(items: BomItem[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  items.forEach((it) => byId.set(it.id, { ...it, children: [] }));
  const roots: TreeNode[] = [];
  for (const it of items) {
    const node = byId.get(it.id)!;
    if (it.parentId == null) roots.push(node);
    else byId.get(it.parentId)?.children.push(node);
  }
  const sortChildren = (n: TreeNode) => {
    n.children.sort((a, b) => a.sortOrder - b.sortOrder);
    n.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  roots.forEach(sortChildren);
  return roots;
}

export function BomTreeTable({ materialCode, items }: Props) {
  const roots = buildTree(items);
  const isExpanded = useBomTreeUiStore((s) => s.isExpanded);
  const toggle = useBomTreeUiStore((s) => s.toggle);
  const expandAll = useBomTreeUiStore((s) => s.expandAll);
  const collapseAll = useBomTreeUiStore((s) => s.collapseAll);

  const renderRow = (node: TreeNode): React.ReactNode[] => {
    const hasChildren = node.children.length > 0;
    const open = isExpanded(materialCode, node.id);
    const rows: React.ReactNode[] = [
      <TableRow key={node.id}>
        <TableCell style={{ paddingLeft: 8 + (node.level - 1) * 24 }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggle(materialCode, node.id)}>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="w-6 inline-block" />
            )}
            <span className="font-mono">{node.componentCode}</span>
          </div>
        </TableCell>
        <TableCell>{node.componentName}</TableCell>
        <TableCell className="text-right">{node.quantity}</TableCell>
        <TableCell>{node.uom}</TableCell>
        <TableCell className="text-right">{node.level}</TableCell>
      </TableRow>,
    ];
    if (open) for (const child of node.children) rows.push(...renderRow(child));
    return rows;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => expandAll(materialCode, items.map((i) => i.id))}>
          Mở tất cả
        </Button>
        <Button size="sm" variant="outline" onClick={() => collapseAll(materialCode)}>
          Đóng tất cả
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>UoM</TableHead>
            <TableHead className="text-right">Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{roots.flatMap(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Replace `frontend/src/pages/BomDetailPage.tsx`**

```tsx
import { useParams } from 'react-router-dom';
import { useBomDetail } from '@/hooks/useBom';
import { BomTreeTable } from '@/components/BomTreeTable';

export default function BomDetailPage() {
  const { materialCode } = useParams<{ materialCode: string }>();
  const { data, isLoading } = useBomDetail(materialCode);

  if (isLoading) return <div>Đang tải…</div>;
  if (!data) return <div>Không tìm thấy BOM</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold font-mono">{data.materialCode}</h1>
        <p className="text-muted-foreground">{data.materialDescription}</p>
      </div>
      <BomTreeTable materialCode={data.materialCode} items={data.items} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): BOM detail page with expandable tree table"
```

---

## Phase 9 — Frontend Upload wizard

### Task 9.1: Excel parsing utility

**Files:**
- Create: `frontend/src/lib/excel.ts`
- Create: `frontend/src/schemas/upload.schema.ts`

- [ ] **Step 1: Write `frontend/src/lib/excel.ts`**

```ts
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
```

- [ ] **Step 2: Write `frontend/src/schemas/upload.schema.ts`**

```ts
import { z } from 'zod';

export const selectStepSchema = z.object({
  mode: z.enum(['full', 'append']),
  materialCode: z.string().min(1, 'Bắt buộc'),
  materialDescription: z.string().min(1, 'Bắt buộc'),
});
export type SelectStepInput = z.infer<typeof selectStepSchema>;
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): excel parsing util + upload zod schemas"
```

### Task 9.2: uploadWizard Zustand store

**Files:**
- Create: `frontend/src/stores/uploadWizard.store.ts`

- [ ] **Step 1: Write `frontend/src/stores/uploadWizard.store.ts`**

```ts
import { create } from 'zustand';
import type { DiffResponse, PreviewItem } from '@/types';

export type WizardStep = 'select' | 'preview' | 'done';

interface UploadWizardState {
  step: WizardStep;
  mode: 'full' | 'append';
  materialCode: string;
  materialDescription: string;
  file: File | null;
  items: PreviewItem[];
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

const initial = {
  step: 'select' as WizardStep,
  mode: 'full' as const,
  materialCode: '',
  materialDescription: '',
  file: null as File | null,
  items: [] as PreviewItem[],
  previewToken: null as string | null,
  diff: null as DiffResponse | null,
};

export const useUploadWizardStore = create<UploadWizardState>((set) => ({
  ...initial,
  setMode: (mode) => set({ mode }),
  setMaterial: (materialCode, materialDescription) => set({ materialCode, materialDescription }),
  setFile: (file) => set({ file }),
  setParsedItems: (items) => set({ items }),
  setPreview: (previewToken, diff) => set({ previewToken, diff, step: 'preview' }),
  goToStep: (step) => set({ step }),
  reset: () => set({ ...initial }),
}));
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/stores
git commit -m "feat(frontend): uploadWizard zustand store"
```

### Task 9.3: UploadPage — Step 1 (select mode + file)

**Files:**
- Create: `frontend/src/components/UploadStepSelect.tsx`

- [ ] **Step 1: Write `frontend/src/components/UploadStepSelect.tsx`**

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseBomExcel } from '@/lib/excel';
import { selectStepSchema, type SelectStepInput } from '@/schemas/upload.schema';
import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiffResponse } from '@/types';

export function UploadStepSelect() {
  const store = useUploadWizardStore();
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const {
    register, handleSubmit, setValue, watch, formState: { errors },
  } = useForm<SelectStepInput>({
    resolver: zodResolver(selectStepSchema),
    defaultValues: {
      mode: store.mode,
      materialCode: store.materialCode,
      materialDescription: store.materialDescription,
    },
  });

  const previewMut = useMutation({
    mutationFn: async (input: SelectStepInput) => {
      if (!store.file) throw new Error('NO_FILE');
      const parsed = await parseBomExcel(store.file);
      if (parsed.errors.length > 0 || !parsed.data) {
        setFileErrors(parsed.errors.map((e) => `Dòng ${e.row}: ${e.message}`));
        throw new Error('PARSE_ERROR');
      }
      if (parsed.data.materialCode !== input.materialCode) {
        setFileErrors([`Material code trong file (${parsed.data.materialCode}) khác với input (${input.materialCode})`]);
        throw new Error('CODE_MISMATCH');
      }
      store.setParsedItems(parsed.data.items);
      const { data } = await api.post<DiffResponse>('/bom/preview', {
        materialCode: input.materialCode,
        materialDescription: input.materialDescription,
        mode: input.mode,
        items: parsed.data.items,
      });
      return data;
    },
    onSuccess: (diff) => {
      store.setPreview(diff.previewToken, diff);
    },
    onError: (e: any) => {
      if (e?.message === 'NO_FILE') toast.error('Chưa chọn file');
      else if (e?.message === 'PARSE_ERROR' || e?.message === 'CODE_MISMATCH') return;
      else toast.error('Preview thất bại');
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Bước 1: Chọn chế độ & file</CardTitle></CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => {
            store.setMode(v.mode);
            store.setMaterial(v.materialCode, v.materialDescription);
            previewMut.mutate(v);
          })}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Chế độ</Label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2">
                <input type="radio" value="full" {...register('mode')} /> Upload toàn bộ
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="append" {...register('mode')} /> Thêm mới
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="materialCode">Material code</Label>
            <Input id="materialCode" {...register('materialCode')} />
            {errors.materialCode && <p className="text-sm text-destructive">{errors.materialCode.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="materialDescription">Material description</Label>
            <Input id="materialDescription" {...register('materialDescription')} />
            {errors.materialDescription && <p className="text-sm text-destructive">{errors.materialDescription.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="file">File Excel (.xlsx)</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                store.setFile(f);
                setFileErrors([]);
                if (f) {
                  parseBomExcel(f).then((res) => {
                    if (res.data) {
                      if (!watch('materialCode')) setValue('materialCode', res.data.materialCode);
                      if (!watch('materialDescription')) setValue('materialDescription', res.data.materialDescription);
                    }
                  });
                }
              }}
            />
            {store.file && <p className="text-sm text-muted-foreground">Đã chọn: {store.file.name}</p>}
          </div>
          {fileErrors.length > 0 && (
            <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-1">
              {fileErrors.map((m, i) => (
                <p key={i} className="text-sm text-destructive">{m}</p>
              ))}
            </div>
          )}
          <Button type="submit" disabled={previewMut.isPending}>
            {previewMut.isPending ? 'Đang preview…' : 'Preview'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/components
git commit -m "feat(frontend): upload wizard step 1 (select mode + file + preview)"
```

### Task 9.4: UploadPage — Step 2 (diff preview)

**Files:**
- Create: `frontend/src/components/UploadStepPreview.tsx`

- [ ] **Step 1: Write `frontend/src/components/UploadStepPreview.tsx`**

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DiffItem } from '@/types';

const statusVariant: Record<DiffItem['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'default',
  changed: 'secondary',
  unchanged: 'outline',
  removed: 'destructive',
};

const statusLabel: Record<DiffItem['status'], string> = {
  new: 'Mới',
  changed: 'Thay đổi',
  unchanged: 'Giữ nguyên',
  removed: 'Bị xoá',
};

export function UploadStepPreview() {
  const store = useUploadWizardStore();
  const diff = store.diff!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<DiffItem['status'] | 'all'>('all');

  const commitMut = useMutation({
    mutationFn: async () => {
      await api.post('/bom/commit', { previewToken: store.previewToken });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom', store.materialCode] });
      toast.success('Lưu BOM thành công');
      const code = store.materialCode;
      store.reset();
      navigate(`/bom/${code}`);
    },
    onError: (e: any) => {
      if (e?.response?.status === 404) toast.error('Preview đã hết hạn, vui lòng preview lại');
      else toast.error('Commit thất bại');
    },
  });

  const filtered = filter === 'all' ? diff.items : diff.items.filter((i) => i.status === filter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Bước 2: Xem diff</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'new', 'changed', 'unchanged', 'removed'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? 'default' : 'outline'}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? `Tất cả (${diff.items.length})` :
                  `${statusLabel[s]} (${diff.summary[s]})`}
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đường dẫn → Code</TableHead>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead>Old (nếu changed)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant={statusVariant[it.status]}>{statusLabel[it.status]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">
                    {[...it.parentPath, it.componentCode].join(' / ')}
                  </TableCell>
                  <TableCell>{it.componentName}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell>{it.uom}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {it.oldValues ? `${it.oldValues.componentName} · ${it.oldValues.quantity} ${it.oldValues.uom}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
          {commitMut.isPending ? 'Đang lưu…' : 'Confirm & Lưu'}
        </Button>
        <Button variant="outline" onClick={() => store.goToStep('select')}>Quay lại</Button>
        <Button variant="ghost" onClick={() => store.reset()}>Huỷ</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/components
git commit -m "feat(frontend): upload wizard step 2 (diff preview + commit)"
```

### Task 9.5: UploadPage — wire the steps together

**Files:**
- Modify: `frontend/src/pages/UploadPage.tsx`

- [ ] **Step 1: Replace `frontend/src/pages/UploadPage.tsx`**

```tsx
import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { UploadStepSelect } from '@/components/UploadStepSelect';
import { UploadStepPreview } from '@/components/UploadStepPreview';

export default function UploadPage() {
  const step = useUploadWizardStore((s) => s.step);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Upload BOM</h1>
      {step === 'select' && <UploadStepSelect />}
      {step === 'preview' && <UploadStepPreview />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/pages/UploadPage.tsx
git commit -m "feat(frontend): wire upload wizard steps"
```

---

## Phase 10 — End-to-end smoke test

### Task 10.1: Manual full-flow verification

**Files:** none (verification only)

- [ ] **Step 1: Reset DB to known state**

```powershell
npm --workspace backend exec -- prisma migrate reset --force
npm --workspace backend exec -- prisma db seed
```
Expected: admin user re-created.

- [ ] **Step 2: Start both servers (in 2 terminals)**

Terminal A:
```powershell
npm run dev:backend
```
Terminal B:
```powershell
npm run dev:frontend
```

- [ ] **Step 3: Verify login & layout**

Open http://localhost:5173. Login with `admin / Aa123456`. Confirm header shows "admin" and links: Danh sách BOM, Upload, Quản lý user.

- [ ] **Step 4: Verify user mgmt**

Navigate `/users` → see admin row. Click "Tạo user mới" → create `bob / Bob123456` (USER). Back at `/users`: see bob row. Reset bob's password → toast confirms. Reset on admin row is disabled.

- [ ] **Step 5: Verify change password**

Logout. Login as `bob / Aa123456` (default after reset). Confirm "Quản lý user" link hidden. Open dropdown → "Đổi mật khẩu" → change to `Bob999999`. Logout and re-login with the new password.

- [ ] **Step 6: Verify BOM upload (full mode)**

Re-login as admin. Prepare a small Excel matching the spec template (header row: Material code, Material description, Code Comp (B), Component(B), Quantity(B), UoM, Material description (A); a few rows including level 1, 2, 3). Go to `/upload`, mode=`Upload toàn bộ`, fill material code/desc, choose file, click Preview. Confirm diff shows correct counts (new=N), click Confirm. Expected: redirect to `/bom/<code>` with the tree visible.

- [ ] **Step 7: Verify BOM upload (append mode + diff)**

Modify the Excel: change one quantity, add one new row under existing parent. Go to `/upload`, mode=`Thêm mới`, same material code, choose modified file, Preview. Confirm `changed=1`, `new=1`. Confirm. Inspect `/bom/<code>` → updated values present.

- [ ] **Step 8: Verify expand/collapse persistence**

On `/bom/<code>`, expand a few rows. Navigate to `/` then back to `/bom/<code>`. Expected: same rows still expanded (Zustand store persisted in-memory).

- [ ] **Step 9: Commit the verification record**

```powershell
git commit --allow-empty -m "chore: full E2E smoke test passed (auth, users, BOM upload full+append)"
```

---

## Phase 11 — Self-review checklist (run after Phase 10)

This phase produces no commits. Use it to confirm everything in the spec is covered:

- [ ] Spec Section 4 (DB): Prisma models match `User`, `Bom`, `BomItem` + `Role` enum (Task 1.4)
- [ ] Spec Section 5 (API): All Auth, Users, BOM endpoints exist (Tasks 2.4, 3.2, 4.6)
- [ ] Spec Section 6 (FE pages): Login, ChangePassword, Users, UserCreate, BomList, BomDetail, Upload, ProtectedRoute, AdminRoute, AppLayout (Tasks 5.6, 6.1, 6.2, 7.1, 7.2, 8.1, 8.3, 9.5)
- [ ] Spec Section 6.1 (Client state): TanStack Query for server, Zustand stores `uploadWizard` + `bomTreeUi`, react-hook-form for forms, no auth in Zustand (Tasks 5.5, 8.2, 9.2)
- [ ] Spec Section 7 (Excel parsing): hierarchy via `parentStack`, validations: matching materialCode, level >=1, first row level=1, no level skipping, quantity > 0, non-empty fields (Task 9.1)
- [ ] Spec Section 8 (Diff logic): path key from componentCode chain, statuses new/changed/unchanged/removed, removed only when mode=full, preview token UUID with 5-min TTL (Tasks 4.2, 4.4)
- [ ] Spec Section 9 (Auth): cookies httpOnly with SameSite=Lax, refresh interceptor on 401, CORS credentials, JwtPayload includes role, RolesGuard on /users (Tasks 1.7, 2.1, 2.2, 2.4, 5.5)
- [ ] Spec Section 11 (Setup): documented commands work end-to-end (Task 10.1)
- [ ] Spec Section 12 (NOT in scope): no public register UI ✓, no email reset ✓, no user delete ✓, no role edit ✓, no tests ✓, no Docker ✓, no Settings page ✓
