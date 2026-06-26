import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaModule } from '../database/prisma.module'; 
import { JwtModule } from '@nestjs/jwt'; 

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}), 
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway], 
  exports: [MessagesService], 
})
export class MessagesModule {}