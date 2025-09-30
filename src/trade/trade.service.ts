import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateTradeDto } from './dto/create-trade.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateTradeRatingDto } from './dto/create-rating.dto';
import { ItemResponseDto, InterestResponseDto } from './dto/item-response.dto';
import {
  TradeResponseDto,
  ReviewResponseDto,
  TradeRatingResponseDto,
} from './dto/trade-response.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';

@Injectable()
export class TradeService {
  constructor(private prisma: PrismaService) {}

  private convertItemToResponseDto(item: any): ItemResponseDto {
    return new ItemResponseDto({
      ...item,
      estimatedValue: Number(item.estimatedValue),
      minimumTradeValue: item.minimumTradeValue
        ? Number(item.minimumTradeValue)
        : undefined,
    });
  }

  private convertTradeToResponseDto(trade: any): TradeResponseDto {
    return new TradeResponseDto({
      ...trade,
      cashAmount: trade.cashAmount ? Number(trade.cashAmount) : undefined,
    });
  }

  // Interest Management
  async getInterests(): Promise<InterestResponseDto[]> {
    const interests = await this.prisma.interest.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return interests.map((interest) => new InterestResponseDto(interest));
  }

  async createInterest(
    name: string,
    description?: string,
    color?: string,
  ): Promise<InterestResponseDto> {
    const interest = await this.prisma.interest.create({
      data: {
        name,
        description,
        color: color || '#007bff',
      },
    });

    return new InterestResponseDto(interest);
  }

  // Item Management
  async createItem(
    userId: string,
    createItemDto: CreateItemDto,
  ): Promise<ItemResponseDto> {
    const { interests, ...itemData } = createItemDto;

    const item = await this.prisma.item.create({
      data: {
        ...itemData,
        ownerId: userId,
        interests: {
          connect: interests?.map((id) => ({ id })) || [],
        },
      },
      include: {
        interests: true,
        images: true,
        files: true,
        shippingDetails: true,
      },
    });

    return this.convertItemToResponseDto(item);
  }

  async getItems(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    const { page, limit, skip } = paginationDto;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where: { isActive: true, isAvailableForTrade: true },
        include: {
          interests: true,
          images: true,
          files: true,
          shippingDetails: true,
          owner: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({
        where: { isActive: true, isAvailableForTrade: true },
      }),
    ]);

    const itemDtos = items.map((item) => this.convertItemToResponseDto(item));
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(itemDtos, meta);
  }

  async getItemById(itemId: string): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        interests: true,
        images: true,
        files: true,
        shippingDetails: true,
        owner: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return this.convertItemToResponseDto(item);
  }

  async getUserItems(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    const { page, limit, skip } = paginationDto;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where: { ownerId: userId },
        include: {
          interests: true,
          images: true,
          files: true,
          shippingDetails: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({
        where: { ownerId: userId },
      }),
    ]);

    const itemDtos = items.map((item) => this.convertItemToResponseDto(item));
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(itemDtos, meta);
  }

  async updateItem(
    userId: string,
    itemId: string,
    updateData: Partial<CreateItemDto>,
  ): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, ownerId: userId },
    });

    if (!item) {
      throw new NotFoundException('Item not found or you do not own this item');
    }

    const { interests, ...itemData } = updateData;

    const updatedItem = await this.prisma.item.update({
      where: { id: itemId },
      data: {
        ...itemData,
        interests: interests
          ? {
              set: interests.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        interests: true,
        images: true,
        files: true,
        shippingDetails: true,
      },
    });

    return this.convertItemToResponseDto(updatedItem);
  }

  async deleteItem(
    userId: string,
    itemId: string,
  ): Promise<{ message: string }> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, ownerId: userId },
    });

    if (!item) {
      throw new NotFoundException('Item not found or you do not own this item');
    }

    await this.prisma.item.update({
      where: { id: itemId },
      data: { isActive: false },
    });

    return { message: 'Item deleted successfully' };
  }

  // Trade Management
  async createTrade(
    userId: string,
    createTradeDto: CreateTradeDto,
  ): Promise<TradeResponseDto> {
    const {
      traderReceivingId,
      itemOfferedId,
      itemRequestedId,
      cashAmount,
      notes,
      estimatedCompletion,
    } = createTradeDto;

    // Validate that user is not trading with themselves
    if (traderReceivingId === userId) {
      throw new BadRequestException('You cannot trade with yourself');
    }

    // Validate that the offered item belongs to the user
    const offeredItem = await this.prisma.item.findFirst({
      where: { id: itemOfferedId, ownerId: userId },
    });

    if (!offeredItem) {
      throw new BadRequestException('You can only offer your own items');
    }

    if (!offeredItem.isActive || !offeredItem.isAvailableForTrade) {
      throw new BadRequestException('This item is not available for trading');
    }

    // Validate that the requested item belongs to the receiving trader
    if (itemRequestedId) {
      const requestedItem = await this.prisma.item.findFirst({
        where: { id: itemRequestedId, ownerId: traderReceivingId },
      });

      if (!requestedItem) {
        throw new BadRequestException(
          'The requested item must belong to the receiving trader',
        );
      }

      if (!requestedItem.isActive || !requestedItem.isAvailableForTrade) {
        throw new BadRequestException(
          'The requested item is not available for trading',
        );
      }
    }

    // Validate minimum trade value if set
    if (offeredItem.minimumTradeValue) {
      const totalValue = (itemRequestedId ? 0 : 0) + (cashAmount || 0); // Would need to get requested item value
      if (totalValue < Number(offeredItem.minimumTradeValue)) {
        throw new BadRequestException(
          `Trade value must be at least $${Number(offeredItem.minimumTradeValue)}`,
        );
      }
    }

    const trade = await this.prisma.trade.create({
      data: {
        traderOfferingId: userId,
        traderReceivingId,
        itemOfferedId,
        itemRequestedId,
        cashAmount,
        notes,
        estimatedCompletion: estimatedCompletion
          ? new Date(estimatedCompletion)
          : null,
      },
    });

    return this.convertTradeToResponseDto(trade);
  }

  async getTrades(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<TradeResponseDto>> {
    const { page, limit, skip } = paginationDto;

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: {
          OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        },
        include: {
          itemOffered: true,
          itemRequested: true,
          traderOffering: true,
          traderReceiving: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trade.count({
        where: {
          OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        },
      }),
    ]);

    const tradeDtos = trades.map((trade) =>
      this.convertTradeToResponseDto(trade),
    );
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(tradeDtos, meta);
  }

  async getTradeById(
    tradeId: string,
    userId: string,
  ): Promise<TradeResponseDto> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
      },
      include: {
        itemOffered: true,
        itemRequested: true,
        traderOffering: true,
        traderReceiving: true,
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to view this trade',
      );
    }

    return this.convertTradeToResponseDto(trade);
  }

  async acceptTrade(
    tradeId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        traderReceivingId: userId,
        status: 'PENDING',
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to accept this trade',
      );
    }

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    return { message: 'Trade accepted successfully' };
  }

  async completeTrade(
    tradeId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'IN_ESCROW'] },
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to complete this trade',
      );
    }

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update trader statistics
    try {
      const offeringProfile = await this.prisma.userProfile.findUnique({
        where: { userId: trade.traderOfferingId },
      });

      const receivingProfile = await this.prisma.userProfile.findUnique({
        where: { userId: trade.traderReceivingId },
      });

      if (offeringProfile) {
        await this.prisma.userProfile.update({
          where: { id: offeringProfile.id },
          data: {
            totalTrades: offeringProfile.totalTrades + 1,
            successfulTrades: offeringProfile.successfulTrades + 1,
          },
        });
      }

      if (receivingProfile) {
        await this.prisma.userProfile.update({
          where: { id: receivingProfile.id },
          data: {
            totalTrades: receivingProfile.totalTrades + 1,
            successfulTrades: receivingProfile.successfulTrades + 1,
          },
        });
      }
    } catch (error) {
      // Handle case where profiles don't exist yet
      console.error('Error updating trader statistics:', error);
    }

    return { message: 'Trade completed successfully' };
  }

  async cancelTrade(
    tradeId: string,
    userId: string,
    reason?: string,
  ): Promise<{ message: string }> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to cancel this trade',
      );
    }

    const updatedNotes = reason
      ? `Cancelled: ${reason}\n${trade.notes || ''}`
      : trade.notes;

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: updatedNotes,
      },
    });

    return { message: 'Trade cancelled successfully' };
  }

  // Review Management
  async createReview(
    userId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const { tradeId, rating, description, wouldTradeAgain } = createReviewDto;

    // Check if trade is completed
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.status !== 'COMPLETED') {
      throw new BadRequestException('You can only review completed trades');
    }

    // Check if user was involved in the trade
    if (
      userId !== trade.traderOfferingId &&
      userId !== trade.traderReceivingId
    ) {
      throw new ForbiddenException(
        'You can only review trades you were involved in',
      );
    }

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: { tradeId, reviewerId: userId },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this trade');
    }

    // Determine who is being reviewed
    const reviewedTraderId =
      userId === trade.traderOfferingId
        ? trade.traderReceivingId
        : trade.traderOfferingId;

    const review = await this.prisma.review.create({
      data: {
        tradeId,
        reviewerId: userId,
        reviewedTraderId,
        rating,
        description,
        wouldTradeAgain,
      },
    });

    return new ReviewResponseDto(review);
  }

  async getTradeReviews(tradeId: string): Promise<ReviewResponseDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { tradeId },
      include: {
        reviewer: true,
        reviewedTrader: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => new ReviewResponseDto(review));
  }

  // Rating Management
  async createTradeRating(
    userId: string,
    createRatingDto: CreateTradeRatingDto,
  ): Promise<TradeRatingResponseDto> {
    const {
      tradeId,
      communicationRating,
      itemConditionRating,
      shippingRating,
      overallRating,
      feedback,
      wouldTradeAgain,
    } = createRatingDto;

    // Check if trade is completed
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.status !== 'COMPLETED') {
      throw new BadRequestException('You can only rate completed trades');
    }

    // Check if user was involved in the trade
    if (
      userId !== trade.traderOfferingId &&
      userId !== trade.traderReceivingId
    ) {
      throw new ForbiddenException(
        'You can only rate trades you were involved in',
      );
    }

    // Check if rating already exists
    const existingRating = await this.prisma.tradeRating.findFirst({
      where: { tradeId, raterId: userId },
    });

    if (existingRating) {
      throw new ConflictException('You have already rated this trade');
    }

    // Determine who is being rated
    const ratedTraderId =
      userId === trade.traderOfferingId
        ? trade.traderReceivingId
        : trade.traderOfferingId;

    const rating = await this.prisma.tradeRating.create({
      data: {
        tradeId,
        raterId: userId,
        ratedTraderId,
        communicationRating,
        itemConditionRating,
        shippingRating,
        overallRating,
        feedback,
        wouldTradeAgain,
      },
    });

    // Update trader's average rating
    await this.updateTraderRating(ratedTraderId);

    return new TradeRatingResponseDto(rating);
  }

  async getTradeRatings(tradeId: string): Promise<TradeRatingResponseDto[]> {
    const ratings = await this.prisma.tradeRating.findMany({
      where: { tradeId },
      include: {
        rater: true,
        ratedTrader: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ratings.map((rating) => new TradeRatingResponseDto(rating));
  }

  private async updateTraderRating(traderId: string): Promise<void> {
    const ratings = await this.prisma.tradeRating.findMany({
      where: { ratedTraderId: traderId },
    });

    if (ratings.length > 0) {
      const avgRating =
        ratings.reduce((sum, rating) => sum + rating.overallRating, 0) /
        ratings.length;
      const roundedRating = Math.round(avgRating * 100) / 100;

      await this.prisma.userProfile.updateMany({
        where: { userId: traderId },
        data: { tradingRating: roundedRating },
      });

      // Recalculate tier
      await this.calculateTraderTier(traderId);
    }
  }

  private async calculateTraderTier(traderId: string): Promise<void> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: traderId },
    });

    if (!profile) return;

    let tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' = 'BRONZE';
    if (profile.totalTrades >= 100 && Number(profile.tradingRating) >= 4.5) {
      tier = 'PLATINUM';
    } else if (
      profile.totalTrades >= 50 &&
      Number(profile.tradingRating) >= 4.0
    ) {
      tier = 'GOLD';
    } else if (
      profile.totalTrades >= 20 &&
      Number(profile.tradingRating) >= 3.5
    ) {
      tier = 'SILVER';
    }

    await this.prisma.userProfile.update({
      where: { id: profile.id },
      data: { traderTier: tier },
    });
  }
}
