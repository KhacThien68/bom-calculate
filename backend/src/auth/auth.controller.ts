import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayloadUser,
} from '../common/decorators/current-user.decorator';
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
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateUser(dto.username, dto.password);
    const { accessToken, refreshToken } = this.auth.signTokens(user);
    res.cookie('access_token', accessToken, accessCookieOpts());
    res.cookie('refresh_token', refreshToken, refreshCookieOpts());
    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(
    @CurrentUser() payload: JwtPayloadUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
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
  async changePassword(
    @CurrentUser() payload: JwtPayloadUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }
}
