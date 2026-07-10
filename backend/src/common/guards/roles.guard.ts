import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Reads the roles metadata set by @Roles() and checks the JWT user's
 * activeRole against the allowed list.
 *
 * Must always be paired with JwtAuthGuard (which populates req.user):
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *
 * If no @Roles() decorator is present the guard passes through (open route).
 *
 * JWT user shape (from JwtStrategy.validate()):
 *   { id: string, email: string, activeRole: string, clientSubtype?: string }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @Roles() attached → route is role-agnostic, allow through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = ctx.switchToHttp().getRequest();

    // user is populated by JwtAuthGuard; fail fast if missing
    if (!user?.activeRole) {
      return false;
    }

    return requiredRoles.includes(user.activeRole);
  }
}
