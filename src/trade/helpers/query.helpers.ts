import { Prisma } from '@prisma/client';

export class TradeRequestQueryHelper {
  static buildWhereClause(
    userId: number,
    direction?: 'sent' | 'received' | 'all',
    status?: string,
  ): Prisma.TradeRequestWhereInput {
    const whereClause: Prisma.TradeRequestWhereInput = {};

    // Build where clause based on direction
    if (direction === 'sent') {
      whereClause.requesterId = userId;
    } else if (direction === 'received') {
      whereClause.recipientId = userId;
    } else {
      // Both sent and received
      whereClause.OR = [
        { requesterId: userId },
        { recipientId: userId },
      ];
    }

    if (status) {
      whereClause.status = status as any;
    }

    return whereClause;
  }

  static buildOrderByClause(sortBy: string): Prisma.TradeRequestOrderByWithRelationInput {
    const [sortField, sortOrder] = sortBy.split(':');
    return { [sortField]: sortOrder };
  }

  static getTradeRequestInclude(): Prisma.TradeRequestInclude {
    return {
      requester: {
        include: {
          profile: true,
        },
      },
      recipient: {
        include: {
          profile: true,
        },
      },
      requestedItem: {
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
      proposedItem: {
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
    };
  }

  static getTradeRequestByIdInclude(): Prisma.TradeRequestInclude {
    return {
      requester: {
        include: {
          profile: true,
        },
      },
      recipient: {
        include: {
          profile: true,
        },
      },
      requestedItem: {
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
      proposedItem: {
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
    };
  }
}
