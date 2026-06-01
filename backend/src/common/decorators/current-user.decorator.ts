import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUser {
  sub: number;
  username: string;
  role: 'ADMIN' | 'USER';
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayloadUser =>
    ctx.switchToHttp().getRequest().user,
);
