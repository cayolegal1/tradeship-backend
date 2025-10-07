import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateTradeRequestDto } from './dto/create-trade-request.dto';
import { UpdateTradeRequestDto } from './dto/update-trade-request.dto';
import { RespondTradeRequestDto } from './dto/respond-trade-request.dto';
import { GetTradeRequestsDto } from './dto/get-trade-requests.dto';
import { TradeRequestResponseDto } from './dto/trade-request-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { TradeRequestValidationHelper } from './helpers/validation.helpers';
import { TradeRequestNotificationHelper } from './helpers/notification.helpers';
import { TradeRequestTransformationHelper } from './helpers/transformation.helpers';
import { TradeRequestQueryHelper } from './helpers/query.helpers';
import { Prisma } from '@prisma/client';

@Injectable()
export class TradeRequestService {
  private readonly logger = new Logger(TradeRequestService.name);
  private readonly validationHelper: TradeRequestValidationHelper;
  private readonly notificationHelper: TradeRequestNotificationHelper;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    this.validationHelper = new TradeRequestValidationHelper(this.prisma);
    this.notificationHelper = new TradeRequestNotificationHelper(
      this.notificationService,
    );
  }

  async createTradeRequest(
    requesterId: number,
    createTradeRequestDto: CreateTradeRequestDto,
  ): Promise<TradeRequestResponseDto> {
    const {
      recipientId,
      requestedItemId,
      proposedItemId,
      cashAmount,
      message,
      expiresAt,
    } = createTradeRequestDto;

    // Validate trade request creation
    await this.validationHelper.validateTradeRequestCreation(
      requesterId,
      recipientId,
      requestedItemId,
      proposedItemId,
    );

    // Create the trade request
    const tradeRequest = await this.prisma.tradeRequest.create({
      data: {
        requesterId,
        recipientId,
        requestedItemId,
        proposedItemId,
        cashAmount,
        message,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: TradeRequestQueryHelper.getTradeRequestInclude(),
    });

    // Send notification to recipient
    await this.notificationHelper.sendTradeRequestNotification(tradeRequest);

    return TradeRequestTransformationHelper.convertTradeRequestToResponseDto(
      tradeRequest,
    );
  }

  async getTradeRequests(
    userId: number,
    getTradeRequestsDto: GetTradeRequestsDto,
  ): Promise<PaginatedResponseDto<TradeRequestResponseDto>> {
    const { page, limit, skip, status, direction, sortBy } =
      getTradeRequestsDto;

    // Build where clause using helper
    const whereClause = TradeRequestQueryHelper.buildWhereClause(
      userId,
      direction as 'sent' | 'received' | 'all',
      status,
    );

    // Build order by clause using helper
    const orderBy = TradeRequestQueryHelper.buildOrderByClause(sortBy);

    const [tradeRequests, total] = await Promise.all([
      this.prisma.tradeRequest.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: TradeRequestQueryHelper.getTradeRequestInclude(),
      }),
      this.prisma.tradeRequest.count({
        where: whereClause,
      }),
    ]);

    const tradeRequestDtos = tradeRequests.map((tr) =>
      TradeRequestTransformationHelper.convertTradeRequestToResponseDto(tr),
    );

    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(tradeRequestDtos, meta);
  }

  async getTradeRequestById(
    tradeRequestId: number,
    userId: number,
  ): Promise<TradeRequestResponseDto> {
    const tradeRequest = await this.prisma.tradeRequest.findFirst({
      where: {
        id: tradeRequestId,
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: TradeRequestQueryHelper.getTradeRequestByIdInclude(),
    });

    if (!tradeRequest) {
      throw new NotFoundException(
        'Trade request not found or you are not authorized to view it',
      );
    }

    return TradeRequestTransformationHelper.convertTradeRequestToResponseDto(
      tradeRequest,
    );
  }

  async updateTradeRequest(
    tradeRequestId: number,
    userId: number,
    updateTradeRequestDto: UpdateTradeRequestDto,
  ): Promise<TradeRequestResponseDto> {
    const tradeRequest = await this.prisma.tradeRequest.findFirst({
      where: {
        id: tradeRequestId,
        requesterId: userId,
        status: 'PENDING',
      },
    });

    if (!tradeRequest) {
      throw new NotFoundException(
        'Trade request not found or you cannot modify it',
      );
    }

    const updatedTradeRequest = await this.prisma.tradeRequest.update({
      where: { id: tradeRequestId },
      data: {
        ...updateTradeRequestDto,
        expiresAt: updateTradeRequestDto.expiresAt
          ? new Date(updateTradeRequestDto.expiresAt)
          : undefined,
      },
      include: TradeRequestQueryHelper.getTradeRequestInclude(),
    });

    return TradeRequestTransformationHelper.convertTradeRequestToResponseDto(
      updatedTradeRequest,
    );
  }

  async respondToTradeRequest(
    tradeRequestId: number,
    userId: number,
    respondTradeRequestDto: RespondTradeRequestDto,
  ): Promise<{ message: string; tradeId?: number }> {
    const { accept, message } = respondTradeRequestDto;

    // Validate trade request response
    await this.validationHelper.validateTradeRequestResponse(
      tradeRequestId,
      userId,
    );

    const tradeRequest = await this.prisma.tradeRequest.findFirst({
      where: {
        id: tradeRequestId,
        recipientId: userId,
        status: 'PENDING',
      },
      include: {
        requester: true,
        recipient: true,
        requestedItem: true,
        proposedItem: true,
      },
    });

    if (!tradeRequest) {
      throw new NotFoundException(
        'Trade request not found or you cannot respond to it',
      );
    }

    let result: { message: string; tradeId?: number } = { message: '' };

    if (accept) {
      result = await this.acceptTradeRequest(tradeRequest, message);
    } else {
      result = await this.declineTradeRequest(tradeRequest);
    }

    return result;
  }

  private async acceptTradeRequest(
    tradeRequest: Prisma.TradeRequestGetPayload<{
      include: {
        requester: true;
        recipient: true;
        requestedItem: true;
        proposedItem: true;
      };
    }>,
    message?: string,
  ): Promise<{ message: string; tradeId: number }> {
    // Create a trade from the accepted request
    const trade = await this.prisma.trade.create({
      data: {
        traderOfferingId: tradeRequest.requesterId,
        traderReceivingId: tradeRequest.recipientId,
        itemOfferedId:
          tradeRequest.proposedItemId || tradeRequest.requestedItemId,
        itemRequestedId: tradeRequest.proposedItemId
          ? tradeRequest.requestedItemId
          : null,
        cashAmount: tradeRequest.cashAmount,
        status: 'ACCEPTED',
        notes: message || 'Trade request accepted',
        acceptedAt: new Date(),
      },
    });

    // Update the trade request
    await this.prisma.tradeRequest.update({
      where: { id: tradeRequest.id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        tradeId: trade.id,
      },
    });

    // Send notification to requester
    await this.notificationHelper.sendTradeAcceptedNotification(
      tradeRequest,
      trade.id,
    );

    return {
      message:
        'Trade request accepted successfully! A new trade has been created.',
      tradeId: trade.id,
    };
  }

  private async declineTradeRequest(
    tradeRequest: Prisma.TradeRequestGetPayload<{
      include: {
        requester: true;
        recipient: true;
        requestedItem: true;
        proposedItem: true;
      };
    }>,
  ): Promise<{ message: string }> {
    // Decline the trade request
    await this.prisma.tradeRequest.update({
      where: { id: tradeRequest.id },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
    });

    // Send notification to requester
    await this.notificationHelper.sendTradeDeclinedNotification(tradeRequest);

    return {
      message: 'Trade request declined successfully.',
    };
  }

  async cancelTradeRequest(
    tradeRequestId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const tradeRequest = await this.prisma.tradeRequest.findFirst({
      where: {
        id: tradeRequestId,
        requesterId: userId,
        status: 'PENDING',
      },
    });

    if (!tradeRequest) {
      throw new NotFoundException(
        'Trade request not found or you cannot cancel it',
      );
    }

    await this.prisma.tradeRequest.update({
      where: { id: tradeRequestId },
      data: {
        status: 'CANCELLED',
        respondedAt: new Date(),
      },
    });

    return { message: 'Trade request cancelled successfully' };
  }

  async getTradeRequestStats(userId: number): Promise<{
    pendingReceived: number;
    pendingSent: number;
    totalReceived: number;
    totalSent: number;
  }> {
    const [pendingReceived, pendingSent, totalReceived, totalSent] =
      await Promise.all([
        this.prisma.tradeRequest.count({
          where: { recipientId: userId, status: 'PENDING' },
        }),
        this.prisma.tradeRequest.count({
          where: { requesterId: userId, status: 'PENDING' },
        }),
        this.prisma.tradeRequest.count({
          where: { recipientId: userId },
        }),
        this.prisma.tradeRequest.count({
          where: { requesterId: userId },
        }),
      ]);

    return {
      pendingReceived,
      pendingSent,
      totalReceived,
      totalSent,
    };
  }
}
