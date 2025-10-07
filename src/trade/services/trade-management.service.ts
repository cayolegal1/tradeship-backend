import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { TradeResponseDto } from '../dto/trade-response.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { TradeHelpers } from '../helpers/trade.helpers';

@Injectable()
export class TradeManagementService {
  private readonly logger = new Logger(TradeManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTrade(
    userId: number,
    createTradeDto: CreateTradeDto,
  ): Promise<TradeResponseDto> {
    const {
      traderReceivingId,
      itemOfferedId,
      itemRequestedId,
      cashAmount,
      notes,
    } = createTradeDto;

    // The user creating the trade is the offering trader
    const traderOfferingId = userId;

    // Validate that the offering trader owns the offered item
    const offeredItem = await this.prisma.item.findFirst({
      where: {
        id: itemOfferedId,
        ownerId: traderOfferingId,
        isActive: true,
        isAvailableForTrade: true,
      },
    });

    if (!offeredItem) {
      throw new BadRequestException(
        'Offered item not found or not available for trade',
      );
    }

    // Validate that the receiving trader owns the requested item (if provided)
    if (itemRequestedId) {
      const requestedItem = await this.prisma.item.findFirst({
        where: {
          id: itemRequestedId,
          ownerId: traderReceivingId,
          isActive: true,
          isAvailableForTrade: true,
        },
      });

      if (!requestedItem) {
        throw new BadRequestException(
          'Requested item not found or not available for trade',
        );
      }
    }

    // Check if there's already a pending trade for these items
    const existingTrade = await this.prisma.trade.findFirst({
      where: {
        OR: [
          {
            itemOfferedId,
            itemRequestedId,
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
          {
            itemOfferedId: itemRequestedId,
            itemRequestedId: itemOfferedId,
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
        ],
      },
    });

    if (existingTrade) {
      throw new BadRequestException(
        'There is already a pending or accepted trade for these items',
      );
    }

    // Create the trade
    const trade = await this.prisma.trade.create({
      data: {
        traderOfferingId,
        traderReceivingId,
        itemOfferedId,
        itemRequestedId,
        cashAmount,
        notes,
        status: 'PENDING',
      },
      include: {
        traderOffering: {
          include: {
            profile: true,
          },
        },
        traderReceiving: {
          include: {
            profile: true,
          },
        },
        itemOffered: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        itemRequested: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    return new TradeResponseDto({
      ...trade,
      cashAmount: trade.cashAmount ? Number(trade.cashAmount) : undefined,
    });
  }

  async getTrades(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<PaginatedResponseDto<TradeResponseDto>> {
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
    };

    if (status) {
      where.status = status;
    }

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          traderOffering: {
            include: {
              profile: true,
            },
          },
          traderReceiving: {
            include: {
              profile: true,
            },
          },
          itemOffered: {
            include: {
              owner: {
                include: {
                  profile: true,
                },
              },
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
          itemRequested: {
            include: {
              owner: {
                include: {
                  profile: true,
                },
              },
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.trade.count({ where }),
    ]);

    const tradeDtos = trades.map(
      (trade) =>
        new TradeResponseDto({
          ...trade,
          cashAmount: trade.cashAmount ? Number(trade.cashAmount) : undefined,
        }),
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
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        traderOffering: {
          include: {
            profile: true,
          },
        },
        traderReceiving: {
          include: {
            profile: true,
          },
        },
        itemOffered: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        itemRequested: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Check if user is a participant in this trade
    if (
      trade.traderOfferingId !== userId &&
      trade.traderReceivingId !== userId
    ) {
      throw new ForbiddenException('You are not authorized to view this trade');
    }

    return new TradeResponseDto({
      ...trade,
      cashAmount: trade.cashAmount ? Number(trade.cashAmount) : undefined,
    });
  }

  async acceptTrade(
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        itemOffered: true,
        itemRequested: true,
      },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.traderReceivingId !== userId) {
      throw new ForbiddenException(
        'Only the receiving trader can accept a trade',
      );
    }

    if (trade.status !== 'PENDING') {
      throw new BadRequestException('Trade is not in pending status');
    }

    // Check if items are still available
    if (!trade.itemOffered.isActive || !trade.itemOffered.isAvailableForTrade) {
      throw new BadRequestException('Offered item is no longer available');
    }

    if (
      trade.itemRequested &&
      (!trade.itemRequested.isActive ||
        !trade.itemRequested.isAvailableForTrade)
    ) {
      throw new BadRequestException('Requested item is no longer available');
    }

    const updatedTrade = await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        traderOffering: {
          include: {
            profile: true,
          },
        },
        traderReceiving: {
          include: {
            profile: true,
          },
        },
        itemOffered: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        itemRequested: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    return new TradeResponseDto({
      ...updatedTrade,
      cashAmount: updatedTrade.cashAmount
        ? Number(updatedTrade.cashAmount)
        : undefined,
    });
  }

  async completeTrade(
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        itemOffered: true,
        itemRequested: true,
      },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (
      trade.traderOfferingId !== userId &&
      trade.traderReceivingId !== userId
    ) {
      throw new ForbiddenException(
        'Only trade participants can complete a trade',
      );
    }

    if (trade.status !== 'ACCEPTED') {
      throw new BadRequestException('Trade must be accepted before completion');
    }

    // Mark items as no longer available for trade
    await this.prisma.item.updateMany({
      where: {
        id: {
          in: [trade.itemOfferedId, trade.itemRequestedId].filter(Boolean),
        },
      },
      data: {
        isAvailableForTrade: false,
      },
    });

    const updatedTrade = await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        traderOffering: {
          include: {
            profile: true,
          },
        },
        traderReceiving: {
          include: {
            profile: true,
          },
        },
        itemOffered: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        itemRequested: {
          include: {
            owner: {
              include: {
                profile: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    return new TradeResponseDto({
      ...updatedTrade,
      cashAmount: updatedTrade.cashAmount
        ? Number(updatedTrade.cashAmount)
        : undefined,
    });
  }

  async cancelTrade(
    tradeId: number,
    userId: number,
  ): Promise<{ message: string }> {
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
        'Only trade participants can cancel a trade',
      );
    }

    if (trade.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed trade');
    }

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return { message: 'Trade cancelled successfully' };
  }
}
