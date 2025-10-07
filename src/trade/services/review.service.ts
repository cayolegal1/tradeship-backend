import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewDto } from '../dto/create-review.dto';
import { CreateTradeRatingDto } from '../dto/create-rating.dto';
import {
  ReviewResponseDto,
  TradeRatingResponseDto,
} from '../dto/trade-response.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    userId: number,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const { tradeId, rating, description } = createReviewDto;

    // Validate trade exists and user is a participant
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (
      trade.traderOfferingId !== userId &&
      trade.traderReceivingId !== userId
    ) {
      throw new ForbiddenException(
        'You can only review trades you participated in',
      );
    }

    if (trade.status !== 'COMPLETED') {
      throw new BadRequestException('You can only review completed trades');
    }

    // Check if user has already reviewed this trade
    const existingReview = await this.prisma.review.findFirst({
      where: {
        tradeId,
        reviewerId: userId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this trade');
    }

    // Determine the reviewed trader (the other participant)
    const reviewedTraderId =
      trade.traderOfferingId === userId
        ? trade.traderReceivingId
        : trade.traderOfferingId;

    const review = await this.prisma.review.create({
      data: {
        tradeId,
        reviewerId: userId,
        reviewedTraderId,
        rating,
        description,
      },
      include: {
        reviewer: {
          include: {
            profile: true,
          },
        },
        reviewedTrader: {
          include: {
            profile: true,
          },
        },
        trade: true,
      },
    });

    // Update trader rating after creating review
    await this.updateTraderRating(reviewedTraderId);

    return new ReviewResponseDto(review);
  }

  async getTradeReviews(tradeId: number): Promise<ReviewResponseDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { tradeId },
      include: {
        reviewer: {
          include: {
            profile: true,
          },
        },
        reviewedTrader: {
          include: {
            profile: true,
          },
        },
        trade: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => new ReviewResponseDto(review));
  }

  async createTradeRating(
    userId: number,
    createTradeRatingDto: CreateTradeRatingDto,
  ): Promise<TradeRatingResponseDto> {
    const {
      tradeId,
      communicationRating,
      itemConditionRating,
      shippingRating,
      overallRating,
      feedback,
      wouldTradeAgain,
    } = createTradeRatingDto;

    // Validate trade exists and user is a participant
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (
      trade.traderOfferingId !== userId &&
      trade.traderReceivingId !== userId
    ) {
      throw new ForbiddenException(
        'You can only rate trades you participated in',
      );
    }

    if (trade.status !== 'COMPLETED') {
      throw new BadRequestException('You can only rate completed trades');
    }

    // Check if user has already rated this trade
    const existingRating = await this.prisma.tradeRating.findFirst({
      where: {
        tradeId,
        raterId: userId,
      },
    });

    if (existingRating) {
      throw new BadRequestException('You have already rated this trade');
    }

    // Determine the rated trader (the other participant)
    const ratedTraderId =
      trade.traderOfferingId === userId
        ? trade.traderReceivingId
        : trade.traderOfferingId;

    const tradeRating = await this.prisma.tradeRating.create({
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
      include: {
        rater: {
          include: {
            profile: true,
          },
        },
        ratedTrader: {
          include: {
            profile: true,
          },
        },
        trade: true,
      },
    });

    // Update trader rating after creating rating
    await this.updateTraderRating(ratedTraderId);

    return new TradeRatingResponseDto(tradeRating);
  }

  async getTradeRatings(tradeId: number): Promise<TradeRatingResponseDto[]> {
    const ratings = await this.prisma.tradeRating.findMany({
      where: { tradeId },
      include: {
        rater: {
          include: {
            profile: true,
          },
        },
        ratedTrader: {
          include: {
            profile: true,
          },
        },
        trade: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ratings.map((rating) => new TradeRatingResponseDto(rating));
  }

  private async updateTraderRating(traderId: number): Promise<void> {
    // Calculate average rating from reviews
    const reviewStats = await this.prisma.review.aggregate({
      where: { reviewedTraderId: traderId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Calculate average rating from trade ratings
    const ratingStats = await this.prisma.tradeRating.aggregate({
      where: { ratedTraderId: traderId },
      _avg: { overallRating: true },
      _count: { overallRating: true },
    });

    // Calculate weighted average (reviews and trade ratings have equal weight)
    const totalReviews = reviewStats._count.rating || 0;
    const totalRatings = ratingStats._count.overallRating || 0;
    const totalCount = totalReviews + totalRatings;

    if (totalCount === 0) {
      return;
    }

    const reviewAvg = reviewStats._avg.rating || 0;
    const ratingAvg = ratingStats._avg.overallRating || 0;

    const overallRating =
      totalCount > 0
        ? (reviewAvg * totalReviews + ratingAvg * totalRatings) / totalCount
        : 0;

    // Update trader's rating in UserProfile
    await this.prisma.userProfile.upsert({
      where: { userId: traderId },
      update: {
        tradingRating: overallRating,
        totalTrades: totalCount,
      },
      create: {
        userId: traderId,
        tradingRating: overallRating,
        totalTrades: totalCount,
      },
    });

    // Update trader tier based on rating
    await this.calculateTraderTier(traderId);
  }

  private async calculateTraderTier(traderId: number): Promise<void> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId: traderId },
    });

    if (!userProfile) {
      return;
    }

    const tradesCount = await this.prisma.trade.count({
      where: {
        OR: [{ traderOfferingId: traderId }, { traderReceivingId: traderId }],
        status: 'COMPLETED',
      },
    });

    const rating = Number(userProfile.tradingRating) || 0;

    let tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' = 'BRONZE';
    if (tradesCount >= 50 && rating >= 4.5) {
      tier = 'PLATINUM';
    } else if (tradesCount >= 25 && rating >= 4.0) {
      tier = 'GOLD';
    } else if (tradesCount >= 10 && rating >= 3.5) {
      tier = 'SILVER';
    }

    await this.prisma.userProfile.update({
      where: { userId: traderId },
      data: { traderTier: tier },
    });
  }
}
