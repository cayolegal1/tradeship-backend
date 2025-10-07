import { Logger } from '@nestjs/common';
import { NotificationService } from '../../notification/notification.service';
import { Prisma } from '@prisma/client';

type TradeRequestForNotification = Prisma.TradeRequestGetPayload<{
  include: {
    requester: {
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

export class TradeRequestNotificationHelper {
  private readonly logger = new Logger(TradeRequestNotificationHelper.name);

  constructor(private readonly notificationService: NotificationService) {}

  async sendTradeRequestNotification(tradeRequest: any): Promise<void> {
    try {
      await this.notificationService.sendNotificationToUser(
        tradeRequest.recipientId,
        'trade_request',
        'New Trade Request',
        `${tradeRequest.requester.firstName} ${tradeRequest.requester.lastName} wants to trade with you!`,
        {
          senderId: tradeRequest.requesterId,
          contentType: 'trade_request',
          objectId: String(tradeRequest.id),
          metadata: {
            tradeRequestId: tradeRequest.id,
            requestedItemName: tradeRequest.requestedItem.name,
            proposedItemName: tradeRequest.proposedItem?.name || 'Cash offer',
          },
          actionUrl: `/trades/requests/${tradeRequest.id}`,
        },
      );
    } catch (error) {
      this.logger.error('Failed to send trade request notification:', error);
    }
  }

  async sendTradeAcceptedNotification(
    tradeRequest: any,
    tradeId: number,
  ): Promise<void> {
    try {
      await this.notificationService.sendNotificationToUser(
        tradeRequest.requesterId,
        'trade_accepted',
        'Trade Request Accepted!',
        `${tradeRequest.recipient.firstName} ${tradeRequest.recipient.lastName} accepted your trade request!`,
        {
          senderId: tradeRequest.recipientId,
          contentType: 'trade',
          objectId: String(tradeId),
          metadata: {
            tradeId,
            tradeRequestId: tradeRequest.id,
          },
          actionUrl: `/trades/${tradeId}`,
        },
      );
    } catch (error) {
      this.logger.error('Failed to send trade accepted notification:', error);
    }
  }

  async sendTradeDeclinedNotification(tradeRequest: any): Promise<void> {
    try {
      await this.notificationService.sendNotificationToUser(
        tradeRequest.requesterId,
        'trade_declined',
        'Trade Request Declined',
        `We're sorry! ${tradeRequest.recipient.firstName} ${tradeRequest.recipient.lastName} has declined this trade. Continue working on a trade that works for both parties or find a new user to trade with!`,
        {
          senderId: tradeRequest.recipientId,
          contentType: 'trade_request',
          objectId: String(tradeRequest.id),
          metadata: {
            tradeRequestId: tradeRequest.id,
          },
        },
      );
    } catch (error) {
      this.logger.error('Failed to send trade declined notification:', error);
    }
  }
}
