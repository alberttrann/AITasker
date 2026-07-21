import { ActiveRole } from '@common/enums/active-role.enum';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export class ActivateSubscriptionDto {
  @IsNotEmpty()
  @IsEnum(ActiveRole)
  activeRole: ActiveRole;

  @IsNotEmpty({
    message: 'packageId is required — send the id from GET /config/subscription-packages.',
  })
  @IsUUID('4', { message: 'packageId must be a valid UUID.' })
  packageId: string;
}
