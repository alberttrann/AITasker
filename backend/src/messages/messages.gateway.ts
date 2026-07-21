import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService }    from './messages.service';
import { InvitationsService } from '../invitations/invitations.service';
import { CreateMessageDto }   from './dto/create-message.dto';
import { InviteExpertDto }    from './dto/invite-expert.dto';
import { JwtService }         from '@nestjs/jwt';
import { UsePipes, ValidationPipe, Logger } from '@nestjs/common'; 
import { OnEvent }            from '@nestjs/event-emitter';
import { PrismaService }      from '../database/prisma.service';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name); 

  constructor(
    private readonly messagesService:    MessagesService,
    private readonly invitationsService: InvitationsService,
    private readonly jwtService:         JwtService,
    private readonly prisma:             PrismaService, 
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
      client.data.user = payload;

      // Join a room named after the user's ID for personal notifications
      client.join(payload.sub);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {}

  // Listen for internal server events and push them to the specific user's socket
  @OnEvent('socket.broadcast')
  async handleSocketBroadcast(payload: {
    userId: string; event: string; payload: Record<string, any>;
  }) {
    if (!this.server) return;
    
    // Always emit real-time regardless of persistence
    this.server.to(payload.userId).emit(payload.event, payload.payload);

    // Persist notification:generic events to DB for REST retrieval
    if (payload.event === 'notification:generic' && payload.payload?.title) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: payload.userId,
            type:   payload.payload.type  ?? 'system',
            title:  payload.payload.title,
            body:   payload.payload.body  ?? null,
            link:   payload.payload.link  ?? null,
          },
        });
      } catch (err) {
        this.logger.error('Failed to persist notification', err);
        // Never throw — WebSocket delivery is more important than DB persistence
      }
    }
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
    if (!!engagementId === !!projectId) {
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
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: CreateMessageDto) {
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

      // Also emit directly to the recipient's personal room to trigger real-time unread count updates
      if (dto.engagement_id) {
        const engagement = await this.prisma.engagement.findUnique({
          where: { id: dto.engagement_id },
        });
        if (engagement) {
          const recipientId = engagement.clientId === user.sub ? engagement.expertId : engagement.clientId;
          this.server.to(recipientId).emit('newMessage', savedMessage);
        }
      } else if (dto.project_id) {
        const project = await this.prisma.project.findUnique({
          where: { id: dto.project_id },
        });
        if (project && project.clientId !== user.sub) {
          this.server.to(project.clientId).emit('newMessage', savedMessage);
        }
      }
    } catch (err: any) {
      client.emit('error', { message: err.message || 'Failed to send message.' });
    }
  }

  // New helper method to notify all parties in the engagement workspace including Tech Team
  async notifyWorkspaceParties(engagementId: string, senderId: string, savedMessage: any) {
    try {
      const engagement = await this.prisma.engagement.findUnique({
        where: { id: engagementId },
      });
      if (!engagement) return;

      const recipientIds = new Set<string>();
      if (engagement.clientId !== senderId) recipientIds.add(engagement.clientId);
      if (engagement.expertId !== senderId) recipientIds.add(engagement.expertId);

      if (engagement.projectId) {
        const techProfiles = await this.prisma.techTeamProfile.findMany({
          where: { linkedProjectId: engagement.projectId },
          select: { userId: true },
        });
        for (const profile of techProfiles) {
          if (profile.userId !== senderId) {
            recipientIds.add(profile.userId);
          }
        }
      }

      for (const recipientId of recipientIds) {
        this.server.to(recipientId).emit('newMessage', savedMessage);
      }
    } catch (err) {
      this.logger.error('Failed to notify workspace parties', err);
    }
  }

  @SubscribeMessage('sendMessageWorkspace')
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleSendMessageWorkspace(@ConnectedSocket() client: Socket, @MessageBody() dto: CreateMessageDto) {
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

      if (dto.engagement_id) {
        await this.notifyWorkspaceParties(dto.engagement_id, user.sub, savedMessage);
      } else if (dto.project_id) {
        const project = await this.prisma.project.findUnique({
          where: { id: dto.project_id },
        });
        if (project && project.clientId !== user.sub) {
          this.server.to(project.clientId).emit('newMessage', savedMessage);
        }
      }
    } catch (err: any) {
      client.emit('error', { message: err.message || 'Failed to send message.' });
    }
  }

  @SubscribeMessage('inviteExpert')
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleInviteExpert(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: InviteExpertDto,
  ) {
    const user = client.data.user;
    if (!user) {
      client.emit('error', { message: 'Unauthorized.' });
      return;
    }

    try {
      // 1. Verify the sender actually owns the project (prevent spoofing)
      await this.messagesService.assertPartyToProject(dto.projectId, {
        id: user.sub,
        activeRole: user.activeRole,
      });

      // 2. Persist the invitation so the expert can see it on their Invitations page.
      //    Uses upsert — re-inviting a declined expert resets status to PENDING.
      await this.invitationsService.upsertInvitation({
        projectId: dto.projectId,
        expertId:  dto.expertId,
        ceoId:     user.sub,
        message:   dto.content ?? null,
      });

      // 3. Push real-time notification to the expert's personal socket room
      this.server.to(dto.expertId).emit('notification:generic', {
        type:  'system',
        title: 'Project Invitation',
        body:  'A CEO has invited you to submit a bid for their project.',
        link:  `/expert/invitations`,   // now points to the new Invitations page
      });

      // 4. Create the initial chat message in the DB for the project chat thread
      const content = dto.content ?? `I'd like to invite you to submit a bid for this project.`;
      const savedMessage = await this.messagesService.createMessage(
        { id: user.sub, activeRole: user.activeRole },
        { project_id: dto.projectId, content },
      );

      // Broadcast to the project room so the CEO sees it in their chat history
      this.server.to(dto.projectId).emit('newMessage', savedMessage);
    } catch (err: any) {
      client.emit('error', { message: err.message || 'Failed to send invitation.' });
    }
  }

  private extractToken(client: Socket): string | null {
    // 1. Check standard Socket.io auth payload 
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }

    // 2. Fallback to headers
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }

    // 3. Fallback to query
    return (client.handshake.query?.token as string) || null;
  }
}