import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class TradeResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  traderOfferingId: string;

  @ApiProperty()
  @Expose()
  traderReceivingId: string;

  @ApiProperty()
  @Expose()
  itemOfferedId: string;

  @ApiPropertyOptional()
  @Expose()
  itemRequestedId?: string;

  @ApiPropertyOptional()
  @Expose()
  cashAmount?: number;

  @ApiProperty()
  @Expose()
  status: string;

  @ApiPropertyOptional()
  @Expose()
  notes?: string;

  @ApiPropertyOptional()
  @Expose()
  escrowReference?: string;

  @ApiPropertyOptional()
  @Expose()
  estimatedCompletion?: Date;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiPropertyOptional()
  @Expose()
  acceptedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  completedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  cancelledAt?: Date;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  totalValue: number;

  @ApiProperty()
  @Expose()
  tradeSummary: Record<string, any>;

  constructor(partial: Partial<TradeResponseDto>) {
    Object.assign(this, partial);
    this.isActive = this.status === 'PENDING' || this.status === 'ACCEPTED' || 
                   this.status === 'IN_PROGRESS' || this.status === 'IN_ESCROW';
    this.totalValue = this.calculateTotalValue();
    this.tradeSummary = this.generateTradeSummary();
  }

  private calculateTotalValue(): number {
    // This would need to be calculated based on item values
    // For now, return the cash amount or 0
    return this.cashAmount || 0;
  }

  private generateTradeSummary(): Record<string, any> {
    return {
      offeringTrader: this.traderOfferingId,
      receivingTrader: this.traderReceivingId,
      offeredItem: this.itemOfferedId,
      requestedItem: this.itemRequestedId || 'Cash',
      cashAmount: this.cashAmount,
      totalValue: this.totalValue,
      status: this.status,
    };
  }
}

export class ReviewResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  tradeId: string;

  @ApiProperty()
  @Expose()
  reviewerId: string;

  @ApiProperty()
  @Expose()
  reviewedTraderId: string;

  @ApiProperty()
  @Expose()
  rating: number;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  wouldTradeAgain: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<ReviewResponseDto>) {
    Object.assign(this, partial);
  }
}

export class TradeRatingResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  tradeId: string;

  @ApiProperty()
  @Expose()
  raterId: string;

  @ApiProperty()
  @Expose()
  ratedTraderId: string;

  @ApiProperty()
  @Expose()
  communicationRating: number;

  @ApiProperty()
  @Expose()
  itemConditionRating: number;

  @ApiProperty()
  @Expose()
  shippingRating: number;

  @ApiProperty()
  @Expose()
  overallRating: number;

  @ApiPropertyOptional()
  @Expose()
  feedback?: string;

  @ApiProperty()
  @Expose()
  wouldTradeAgain: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  averageRating: number;

  constructor(partial: Partial<TradeRatingResponseDto>) {
    Object.assign(this, partial);
    this.averageRating = this.calculateAverageRating();
  }

  private calculateAverageRating(): number {
    const ratings = [
      this.communicationRating,
      this.itemConditionRating,
      this.shippingRating,
      this.overallRating,
    ];
    return Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
  }
}
