import { Module } from '@nestjs/common';
import { MessagesService }    from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway }    from './messages.gateway';
import { PrismaModule }       from '../database/prisma.module';
import { JwtModule }          from '@nestjs/jwt';
import { InvitationsModule }  from '../invitations/invitations.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    InvitationsModule,       
  ],
  controllers: [MessagesController],
  providers:   [MessagesService, MessagesGateway],
  exports:     [MessagesService],
})
export class MessagesModule {}