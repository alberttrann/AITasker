import { ActiveRole } from '@common/enums/active-role.enum';
import { SubscriptionTier } from '@common/enums/subscription-tier';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

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

    const isPro =
      user[tierKey] === SubscriptionTier.PRO && expiresAt !== null && expiresAt > dateNow;

    // throw a structured exception instead of returning false, so callers get a { code, message } body instead of a bare 403.
    if (!isPro) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message:
          user.activeRole === ActiveRole.CLIENT
            ? 'Client Pro subscription required for this action'
            : 'Expert Pro subscription required for this action',
      });
    }

    return true;
  }
}