import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatConversationResponseDto, ChatMessageResponseDto } from './dto/chat-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { SuccessResponseDto } from '../common/dto/response.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    type: ChatConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createConversation(
    @CurrentUser() user: any,
    @Body() createConversationDto: CreateConversationDto,
  ): Promise<ChatConversationResponseDto> {
    return this.chatService.createConversation(user.id, createConversationDto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get user conversations with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  async getUserConversations(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResponseDto<ChatConversationResponseDto>> {
    return this.chatService.getUserConversations(user.id, page || 1, limit || 20);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
    type: ChatConversationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Conversation ID',
  })
  async getConversationById(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) conversationId: number,
  ): Promise<ChatConversationResponseDto> {
    return this.chatService.getConversationById(conversationId, user.id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message to a conversation' })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    type: ChatMessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Conversation ID',
  })
  async sendMessage(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() sendMessageDto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    return this.chatService.sendMessage(conversationId, user.id, sendMessageDto);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get conversation messages with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Conversation ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  async getConversationMessages(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResponseDto<ChatMessageResponseDto>> {
    return this.chatService.getConversationMessages(conversationId, user.id, page || 1, limit || 50);
  }

  @Put('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark conversation messages as read' })
  @ApiResponse({
    status: 200,
    description: 'Messages marked as read successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Conversation ID',
  })
  async markMessagesAsRead(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) conversationId: number,
  ): Promise<SuccessResponseDto> {
    const result = await this.chatService.markMessagesAsRead(conversationId, user.id);
    return new SuccessResponseDto(result.message);
  }

  @Post('trade-conversation')
  @ApiOperation({ summary: 'Create or get trade conversation with another user' })
  @ApiResponse({
    status: 201,
    description: 'Trade conversation created or retrieved successfully',
    type: ChatConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTradeConversation(
    @CurrentUser() user: any,
    @Body() body: { recipientId: number; tradeRequestId?: number },
  ): Promise<ChatConversationResponseDto> {
    return this.chatService.createTradeConversation(
      user.id,
      body.recipientId,
      body.tradeRequestId,
    );
  }
}
