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

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { engagementId?: string; projectId?: string },
  ) {
    const user = client.data.user;
    if (!user) {
      client.emit('error', { message: 'Invalid join request.' });
      return;
    }

    const { engagementId, projectId } = body;
    if ((!!engagementId) === (!!projectId)) {
      client.emit('error', { message: 'Provide exactly one of engagementId or projectId.' });
      return;
    }

    try {
      if (engagementId) {
        await this.messagesService.assertPartyToEngagement(engagementId, user.sub);
        client.join(engagementId);
      } else {
        await this.messagesService.assertPartyToProject(projectId!, {
          id: user.sub,
          activeRole: user.activeRole,
        });
        client.join(projectId!);
      }
    } catch {
      client.emit('error', { message: 'You are not authorized to join this chat.' });
    }
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
      const savedMessage = await this.messagesService.createMessage(
        { id: user.sub, activeRole: user.activeRole },
        dto,
      );
      const room = dto.engagement_id || dto.project_id;
      this.server.to(room!).emit('newMessage', savedMessage);
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