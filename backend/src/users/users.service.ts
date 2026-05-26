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
