// backend/src/messages/messages.gateway.ts
// FIX: joinRoom previously let ANY connected client join ANY engagement's
// Socket.IO room with no verification at all. Added the same party check
// MessagesService now exposes — used here too, so a user can't subscribe
// to (and silently receive) another engagement's chat just by knowing/
// guessing its ID. sendMessage gets this protection "for free" since
// createMessage() already enforces it internally now.
//
// NOTE, not fixed here (flagging, not solving): client.data.user is set
// from the raw decoded JWT payload at connection time and never
// re-validated against the DB for the lifetime of the socket — unlike the
// REST API's JwtStrategy, which re-queries fresh on every request. A
// deactivated/banned user's existing WebSocket connection would persist
// until they disconnect or the server restarts. Also, CORS is wide open
// (origin: '*') — fine for development, worth tightening before any real
// deployment.
import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody,
  OnGatewayConnection, OnGatewayDisconnect, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';
import { UsePipes, ValidationPipe } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      client.data.user = payload;
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
  }

  // FIX: now verifies the connecting user is actually a party to the
  // engagement before letting them join its room.
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('engagementId') engagementId: string,
  ) {
    const user = client.data.user;
    if (!user || !engagementId) {
      client.emit('error', { message: 'Invalid join request.' });
      return;
    }

    try {
      await this.messagesService.assertPartyToEngagement(engagementId, user.sub);
    } catch {
      client.emit('error', { message: 'You are not authorized to join this engagement chat.' });
      return;
    }

    client.join(engagementId);
  }

  @SubscribeMessage('sendMessage')
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateMessageDto,
  ) {
    const user = client.data.user;
    if (!user) {
      client.emit('error', { message: 'Unauthorized socket connection.' });
      return;
    }

    try {
      // createMessage() already enforces the party check internally now —
      // protected "for free" by the messages.service.ts fix.
      const savedMessage = await this.messagesService.createMessage(user.sub, dto);
      this.server.to(dto.engagement_id).emit('newMessage', savedMessage);
    } catch (err: any) {
      client.emit('error', { message: err.message || 'Failed to send message.' });
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    return (client.handshake.query?.token as string) || null;
  }
}