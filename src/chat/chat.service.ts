import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatConversationResponseDto,
  ChatMessageResponseDto,
} from './dto/chat-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private convertConversationToResponseDto(
    conversation: any,
  ): ChatConversationResponseDto {
    const dto = new ChatConversationResponseDto();
    Object.assign(dto, {
      ...conversation,
      participants:
        conversation.participants?.map((p: any) => ({
          id: p.user.id,
          username: p.user.username,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          avatar: p.user.profile?.avatar,
        })) || [],
    });
    return dto;
  }

  private convertMessageToResponseDto(message: any): ChatMessageResponseDto {
    const dto = new ChatMessageResponseDto();
    Object.assign(dto, {
      ...message,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        avatar: message.sender.profile?.avatar,
      },
    });
    return dto;
  }

  async createConversation(
    userId: number,
    createConversationDto: CreateConversationDto,
  ): Promise<ChatConversationResponseDto> {
    const {
      participantIds,
      title,
      description,
      isPrivate,
      contentType,
      objectId,
    } = createConversationDto;

    // Validate that user is not trying to create a conversation with themselves
    if (participantIds.includes(userId)) {
      throw new BadRequestException(
        'You cannot create a conversation with yourself',
      );
    }

    // Validate that all participants exist
    const participants = await this.prisma.user.findMany({
      where: { id: { in: participantIds } },
    });

    if (participants.length !== participantIds.length) {
      throw new BadRequestException('One or more participants do not exist');
    }

    // Check if a direct conversation already exists between these users
    if (participantIds.length === 1 && !title) {
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          conversationType: 'DIRECT',
          isPrivate: true,
          participants: {
            every: {
              userId: { in: [userId, ...participantIds] },
            },
          },
        },
        include: {
          participants: true,
        },
      });

      if (existingConversation) {
        return this.convertConversationToResponseDto(existingConversation);
      }
    }

    // Create the conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        conversationType: participantIds.length === 1 ? 'DIRECT' : 'GROUP',
        title,
        description,
        isPrivate: isPrivate ?? true,
        contentType,
        objectId,
        createdById: userId,
        participants: {
          create: [
            // Add the creator
            {
              userId,
              role: 'OWNER' as const,
            },
            // Add other participants
            ...participantIds.map((participantId) => ({
              userId: participantId,
              role: 'MEMBER' as const,
            })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    // Send notifications to participants
    for (const participantId of participantIds) {
      try {
        await this.notificationService.sendNotificationToUser(
          participantId,
          'chat_group_created',
          'New Conversation',
          `You have been added to a new conversation${title ? `: ${title}` : ''}`,
          {
            senderId: userId,
            contentType: 'conversation',
            objectId: String(conversation.id),
            metadata: {
              conversationId: conversation.id,
              conversationTitle: title,
            },
            actionUrl: `/chat/${conversation.id}`,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to send conversation notification to user ${participantId}:`,
          error,
        );
      }
    }

    return this.convertConversationToResponseDto(conversation);
  }

  async getUserConversations(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponseDto<ChatConversationResponseDto>> {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          isActive: true,
          participants: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
        include: {
          participants: {
            where: { isActive: true },
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({
        where: {
          isActive: true,
          participants: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
      }),
    ]);

    const conversationDtos = conversations.map((conv) =>
      this.convertConversationToResponseDto(conv),
    );
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(conversationDtos, meta);
  }

  async getConversationById(
    conversationId: number,
    userId: number,
  ): Promise<ChatConversationResponseDto> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        isActive: true,
        participants: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
      include: {
        participants: {
          where: { isActive: true },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found or you are not authorized to view it',
      );
    }

    return this.convertConversationToResponseDto(conversation);
  }

  async sendMessage(
    conversationId: number,
    userId: number,
    sendMessageDto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    const { content, replyToId } = sendMessageDto;

    // Verify user is a participant in the conversation
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Verify reply message exists if provided
    if (replyToId) {
      const replyMessage = await this.prisma.chatMessage.findFirst({
        where: {
          id: replyToId,
          conversationId,
          isDeleted: false,
        },
      });

      if (!replyMessage) {
        throw new BadRequestException('Reply message not found');
      }
    }

    // Create the message
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        messageType: 'TEXT',
        content,
        replyToId,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Update conversation's last message timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Update participants' last read timestamp (except sender)
    await this.prisma.chatParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: userId },
        isActive: true,
      },
      data: { lastReadAt: new Date() },
    });

    // Send notifications to other participants
    const otherParticipants = await this.prisma.chatParticipant.findMany({
      where: {
        conversationId,
        userId: { not: userId },
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    for (const participant of otherParticipants) {
      try {
        await this.notificationService.sendNotificationToUser(
          participant.userId,
          'chat_message',
          'New Message',
          `${message.sender.firstName} ${message.sender.lastName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          {
            senderId: userId,
            contentType: 'conversation',
            objectId: String(conversationId),
            metadata: {
              conversationId,
              messageId: message.id,
            },
            actionUrl: `/chat/${conversationId}`,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to send message notification to user ${participant.userId}:`,
          error,
        );
      }
    }

    return this.convertMessageToResponseDto(message);
  }

  async getConversationMessages(
    conversationId: number,
    userId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResponseDto<ChatMessageResponseDto>> {
    const skip = (page - 1) * limit;

    // Verify user is a participant in the conversation
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: {
          conversationId,
          isDeleted: false,
        },
        include: {
          sender: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chatMessage.count({
        where: {
          conversationId,
          isDeleted: false,
        },
      }),
    ]);

    const messageDtos = messages.map((msg) =>
      this.convertMessageToResponseDto(msg),
    );
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(messageDtos, meta);
  }

  async markMessagesAsRead(
    conversationId: number,
    userId: number,
  ): Promise<{ message: string }> {
    await this.prisma.chatParticipant.updateMany({
      where: {
        conversationId,
        userId,
        isActive: true,
      },
      data: { lastReadAt: new Date() },
    });

    return { message: 'Messages marked as read' };
  }

  async createTradeConversation(
    userId: number,
    recipientId: number,
    tradeRequestId?: number,
  ): Promise<ChatConversationResponseDto> {
    // Check if conversation already exists
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        conversationType: 'DIRECT',
        isPrivate: true,
        contentType: 'trade_request',
        objectId: tradeRequestId ? String(tradeRequestId) : null,
        participants: {
          every: {
            userId: { in: [userId, recipientId] },
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    if (existingConversation) {
      return this.convertConversationToResponseDto(existingConversation);
    }

    // Create new conversation
    return this.createConversation(userId, {
      participantIds: [recipientId],
      title: 'Trade Discussion',
      contentType: 'trade_request',
      objectId: tradeRequestId ? String(tradeRequestId) : undefined,
    });
  }
}
