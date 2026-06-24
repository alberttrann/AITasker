import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// Import các decorator hỗ trợ sinh tài liệu của Swagger
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Messages') 
@ApiBearerAuth()   
@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('engagements/:id/messages')
  @ApiOperation({ summary: 'Retrieve chat history with cursor-based pagination' }) 
  @ApiParam({ name: 'id', description: 'The ID of the active engagement' }) 
  @ApiQuery({ name: 'limit', required: false, description: 'Number of messages to retrieve per page (default is 50)' })
  @ApiQuery({ name: 'cursorId', required: false, description: 'The ID of the last message from the previous page' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved chat history.' })
  @ApiResponse({ status: 401, description: 'Unauthorized connection.' })
  @ApiResponse({ status: 404, description: 'Engagement not found.' })
  async getChatHistory(
    @Param('id') engagementId: string,
    @Query('limit') limit: string,
    @Query('cursorId') cursorId?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.getChatHistory(engagementId);
  }

  @Post('messages/:id/read')
  @ApiOperation({ summary: 'Mark a specific message as read' })
  @ApiParam({ name: 'id', description: 'The ID of the message to mark as read' })
  @ApiResponse({ status: 201, description: 'Successfully marked message as read.' })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  async markAsRead(@Param('id') messageId: string, @Req() req: any) {
    const userId = req.user.sub;
    return this.messagesService.markAsRead(messageId, userId);
  }

  @Get('engagements/:id/messages/unread-count')
  @ApiOperation({ summary: 'Get total count of unread messages for current user' })
  @ApiParam({ name: 'id', description: 'The ID of the engagement' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully.' })
  async getUnreadCount(@Param('id') engagementId: string, @Req() req: any) {
    const userId = req.user.sub;
    const count = await this.messagesService.unreadCount(engagementId, userId);
    return { unread_count: count };
  }
}