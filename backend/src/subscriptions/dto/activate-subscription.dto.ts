import { ActiveRole } from '@common/enums/active-role.enum';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ActivateSubscriptionDto {
  @IsNotEmpty()
  @IsEnum(ActiveRole)
  activeRole: ActiveRole;
}
