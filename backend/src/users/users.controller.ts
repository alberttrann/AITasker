import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Get, Param, Post, Put, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';
import { AddRoleDto } from './dto/add-role.dto';
import { UserService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UpdateTaxCodeDto } from './dto/update-tax-code.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBearerAuth('JWT')
  @Post('me/add-role')
  addRole(@CurrentUser() user: AuthUser, @Body() addRoleDto: AddRoleDto) {
    return this.userService.addRole(user.id, addRoleDto);
  }

  @ApiBearerAuth('JWT')
  @Get('me')
  getUserProfile(@CurrentUser() user: AuthUser) {
    return this.userService.getUserProfile(user.id);
  }

  // Get the profile of the current user active role
  @ApiBearerAuth('JWT')
  @Put('me')
  updateUserProfile(@CurrentUser() user: AuthUser, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUserProfile(user.id, updateUserDto);
  }

  // Get the public profile of expert
  @ApiBearerAuth('JWT')
  @Get(':userId/public-profile')
  getPublicProfile(@Param('userId') userId: string) {
    return this.userService.getPublicProfile(userId);
  }

  @ApiBearerAuth('JWT')
  @Put('me/tax-code')
  @Roles('CLIENT')
  updateTaxCode(@CurrentUser() user: AuthUser, @Body() updateTaxCodeDto: UpdateTaxCodeDto) {
    return this.userService.updateTaxCode(user.id, updateTaxCodeDto.taxCode);
  }

  @ApiBearerAuth('JWT')
  @Get('experts')
  @Roles('CLIENT', 'ADMIN')
  @ApiOperation({ summary: 'Browse expert users — for CEO searching for talent' })
  @ApiQuery({ name: 'stackTag', required: false })
  @ApiQuery({ name: 'archetype', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  browseExperts(
    @Query('stackTag') stackTag?: string,
    @Query('archetype') archetype?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.userService.browseExperts({ stackTag, archetype, limit });
  }
}
