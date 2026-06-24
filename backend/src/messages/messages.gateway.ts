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
        client.disconnect(); // Ngắt kết nối ngay nếu không gửi kèm token xác thực
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

  // Trigger kích hoạt khi thiết bị ngắt kết nối
  handleDisconnect(client: Socket) {
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('engagementId') engagementId: string,
  ) {
    if (engagementId) {
      client.join(engagementId); 
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

    const savedMessage = await this.messagesService.createMessage(user.sub, dto);

    this.server.to(dto.engagement_id).emit('newMessage', savedMessage);
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    return (client.handshake.query?.token as string) || null;
  }
}