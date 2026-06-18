import { UserRoleItem } from '@common/enums/user-role-item.enum';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class AddRoleDto {
  @IsNotEmpty()
  @IsEnum(UserRoleItem)
  newRole: UserRoleItem;
}
