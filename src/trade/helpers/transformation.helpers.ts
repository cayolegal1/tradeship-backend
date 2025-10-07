import { TradeRequestResponseDto } from '../dto/trade-request-response.dto';
import { Prisma } from '@prisma/client';

type TradeRequestWithIncludes = Prisma.TradeRequestGetPayload<{
  include: {
    requester: {
      include: {
        profile: true;
      };
    };
    recipient: {
      include: {
        profile: true;
      };
    };
    requestedItem: {
      include: {
        owner: {
          include: {
            profile: true;
          };
        };
        images: {
          where: { isPrimary: true };
          take: 1;
        };
      };
    };
    proposedItem?: {
      include: {
        owner: {
          include: {
            profile: true;
          };
        };
        images: {
          where: { isPrimary: true };
          take: 1;
        };
      };
    } | null;
  };
}>;

export class TradeRequestTransformationHelper {
  static convertTradeRequestToResponseDto(
    tradeRequest: any,
  ): TradeRequestResponseDto {
    const dto = new TradeRequestResponseDto();
    Object.assign(dto, {
      ...tradeRequest,
      cashAmount: tradeRequest.cashAmount
        ? Number(tradeRequest.cashAmount)
        : undefined,
      requester: {
        id: tradeRequest.requester.id,
        username: tradeRequest.requester.username,
        firstName: tradeRequest.requester.firstName,
        lastName: tradeRequest.requester.lastName,
        avatar: tradeRequest.requester.profile?.avatar,
      },
      recipient: {
        id: tradeRequest.recipient.id,
        username: tradeRequest.recipient.username,
        firstName: tradeRequest.recipient.firstName,
        lastName: tradeRequest.recipient.lastName,
        avatar: tradeRequest.recipient.profile?.avatar,
      },
      requestedItem: {
        id: tradeRequest.requestedItem.id,
        name: tradeRequest.requestedItem.name,
        description: tradeRequest.requestedItem.description,
        price: tradeRequest.requestedItem.price,
        primaryImage: tradeRequest.requestedItem.images?.find(
          (img) => img.isPrimary,
        )?.url,
        owner: {
          id: tradeRequest.requestedItem.owner.id,
          username: tradeRequest.requestedItem.owner.username,
          firstName: tradeRequest.requestedItem.owner.firstName,
          lastName: tradeRequest.requestedItem.owner.lastName,
          avatar: tradeRequest.requestedItem.owner.profile?.avatar,
        },
      },
      proposedItem: tradeRequest.proposedItem
        ? {
            id: tradeRequest.proposedItem.id,
            name: tradeRequest.proposedItem.name,
            description: tradeRequest.proposedItem.description,
            price: tradeRequest.proposedItem.price,
            primaryImage: tradeRequest.proposedItem.images?.find(
              (img) => img.isPrimary,
            )?.url,
            owner: {
              id: tradeRequest.proposedItem.owner.id,
              username: tradeRequest.proposedItem.owner.username,
              firstName: tradeRequest.proposedItem.owner.firstName,
              lastName: tradeRequest.proposedItem.owner.lastName,
              avatar: tradeRequest.proposedItem.owner.profile?.avatar,
            },
          }
        : undefined,
    });
    return dto;
  }
}
