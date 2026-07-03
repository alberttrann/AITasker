import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Body, ConflictException, Controller, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';
import { InitiateBankLinkDto } from './dto/initiate-bank-link.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Bank Hub')
@Controller('bank-hub')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class BankHubController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiBearerAuth('JWT')
  @Post('initiate-link')
  async initiateBankLink(
    @CurrentUser() user: AuthUser,
    @Body() initiateBankLinkDto: InitiateBankLinkDto,
  ) {
    const queryUser = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        sepayBankAccountXid: true,
      },
    });

    const bankAccountXid = queryUser.sepayBankAccountXid;

    if (bankAccountXid) {
      throw new ConflictException('Bank already linked!');
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        sepayBankAccountXid: initiateBankLinkDto.bank_account_xid,
        bankAccountHolderName: initiateBankLinkDto.holder_name,
        bankLinkedAt: new Date(),
      },
    });

    return { success: true };
  }
}
