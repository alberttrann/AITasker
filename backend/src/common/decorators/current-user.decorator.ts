import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Pulls the validated user object from the request, populated by JwtAuthGuard.
 *
 * Usage in a controller method:
 *   async myRoute(@CurrentUser() user: JwtPayload) { ... }
 *
 * The user object shape comes from JwtStrategy.validate():
 *   { id, email, activeRole, clientSubtype }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);