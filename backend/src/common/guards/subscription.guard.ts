import { ActiveRole } from '@common/enums/active-role.enum';
import { SubscriptionTier } from '@common/enums/subscription-tier';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const tierKey =
      user.activeRole === ActiveRole.CLIENT ? 'subscriptionClientTier' : 'subscriptionExpertTier';

    const expiresKey =
      user.activeRole === ActiveRole.CLIENT ? 'subClientExpiresAt' : 'subExpertExpiresAt';

    const dateNow = new Date();
    const expiresAt = user[expiresKey] ? new Date(user[expiresKey]) : null;

    // Return isPro true if meet these conditions
    const isPro =
      user[tierKey] === SubscriptionTier.PRO && expiresAt !== null && expiresAt > dateNow;

    return isPro;
  }
}
