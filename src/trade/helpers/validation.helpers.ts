import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export class TradeRequestValidationHelper {
  constructor(private readonly prisma: PrismaService) {}

  async validateTradeRequestCreation(
    requesterId: number,
    recipientId: number,
    requestedItemId: number,
    proposedItemId?: number,
  ): Promise<void> {
    // Validate that user is not sending request to themselves
    if (recipientId === requesterId) {
      throw new BadRequestException(
        'You cannot send a trade request to yourself',
      );
    }

    // Validate that the requested item exists and belongs to the recipient
    await this.validateRequestedItem(requestedItemId, recipientId);

    // Validate proposed item if provided
    if (proposedItemId) {
      await this.validateProposedItem(proposedItemId, requesterId);
    }

    // Check if there's already a pending request for the same items
    await this.checkForExistingRequest(
      requesterId,
      recipientId,
      requestedItemId,
      proposedItemId,
    );
  }

  private async validateRequestedItem(
    requestedItemId: number,
    recipientId: number,
  ): Promise<void> {
    const requestedItem = await this.prisma.item.findFirst({
      where: { id: requestedItemId, ownerId: recipientId },
    });

    if (!requestedItem) {
      throw new BadRequestException(
        'Requested item not found or does not belong to the recipient',
      );
    }

    if (!requestedItem.isActive || !requestedItem.isAvailableForTrade) {
      throw new BadRequestException(
        'The requested item is not available for trading',
      );
    }
  }

  private async validateProposedItem(
    proposedItemId: number,
    requesterId: number,
  ): Promise<void> {
    const proposedItem = await this.prisma.item.findFirst({
      where: { id: proposedItemId, ownerId: requesterId },
    });

    if (!proposedItem) {
      throw new BadRequestException(
        'Proposed item not found or does not belong to you',
      );
    }

    if (!proposedItem.isActive || !proposedItem.isAvailableForTrade) {
      throw new BadRequestException(
        'Your proposed item is not available for trading',
      );
    }
  }

  private async checkForExistingRequest(
    requesterId: number,
    recipientId: number,
    requestedItemId: number,
    proposedItemId?: number,
  ): Promise<void> {
    const existingRequest = await this.prisma.tradeRequest.findFirst({
      where: {
        requesterId,
        recipientId,
        requestedItemId,
        proposedItemId: proposedItemId || null,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending trade request for these items',
      );
    }
  }

  async validateTradeRequestResponse(
    tradeRequestId: number,
    userId: number,
  ): Promise<void> {
    const tradeRequest = await this.prisma.tradeRequest.findFirst({
      where: {
        id: tradeRequestId,
        recipientId: userId,
        status: 'PENDING',
      },
      include: {
        requestedItem: true,
        proposedItem: true,
      },
    });

    if (!tradeRequest) {
      throw new BadRequestException(
        'Trade request not found or you cannot respond to it',
      );
    }

    // Check if items are still available
    if (
      !tradeRequest.requestedItem.isActive ||
      !tradeRequest.requestedItem.isAvailableForTrade
    ) {
      throw new BadRequestException(
        'The requested item is no longer available for trading',
      );
    }

    if (
      tradeRequest.proposedItem &&
      (!tradeRequest.proposedItem.isActive ||
        !tradeRequest.proposedItem.isAvailableForTrade)
    ) {
      throw new BadRequestException(
        'The proposed item is no longer available for trading',
      );
    }
  }
}
