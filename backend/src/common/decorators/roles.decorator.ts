import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Attach one or more role strings to a route or controller.
 * Read by RolesGuard to decide whether the JWT's activeRole is allowed.
 *
 * AITasker roles (from JWT payload.activeRole):
 *   'CLIENT'  — CEO or TECH_TEAM (further split by clientSubtype)
 *   'EXPERT'  — verified AI expert
 *   'ADMIN'   — platform administrator
 *
 * Usage:
 *   @Roles('CLIENT')
 *   @Roles('EXPERT')
 *   @Roles('ADMIN')
 *   @Roles('CLIENT', 'EXPERT')  ← either role accepted
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);