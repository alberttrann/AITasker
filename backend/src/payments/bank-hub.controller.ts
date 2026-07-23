import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Body, ConflictException, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
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
      throw new ConflictException(
        'Bank already linked! Use PUT /bank-hub/link to update the linked account instead.',
      );
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

  @ApiBearerAuth('JWT')
  @Put('link')
  async updateBankLink(
    @CurrentUser() user: AuthUser,
    @Body() updateBankLinkDto: InitiateBankLinkDto,
  ) {
    const queryUser = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        sepayBankAccountXid: true,
      },
    });

    if (!queryUser.sepayBankAccountXid) {
      throw new ConflictException(
        'No bank account is currently linked. Use POST /bank-hub/initiate-link instead.',
      );
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        sepayBankAccountXid: updateBankLinkDto.bank_account_xid,
        bankAccountHolderName: updateBankLinkDto.holder_name,
        bankLinkedAt: new Date(),
      },
    });

    return { success: true };
  }

  @ApiBearerAuth('JWT')
  @Get('link')
  async getBankLink(@CurrentUser() user: AuthUser) {
    const queryUser = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        sepayBankAccountXid: true,
        bankAccountHolderName: true,
        bankLinkedAt: true,
      },
    });

    return {
      isLinked: !!queryUser.sepayBankAccountXid,
      bankAccountXid: queryUser.sepayBankAccountXid,
      holderName: queryUser.bankAccountHolderName,
      linkedAt: queryUser.bankLinkedAt,
    };
  }
}
