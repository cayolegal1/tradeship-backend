import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class WalletResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiProperty()
  @Expose()
  availableBalance: number;

  @ApiProperty()
  @Expose()
  escrowBalance: number;

  @ApiProperty()
  @Expose()
  totalBalance: number;

  @ApiProperty()
  @Expose()
  totalDeposited: number;

  @ApiProperty()
  @Expose()
  totalWithdrawn: number;

  @ApiProperty()
  @Expose()
  totalShippingPaid: number;

  @ApiProperty()
  @Expose()
  withdrawalLimitDaily: number;

  @ApiProperty()
  @Expose()
  withdrawalLimitMonthly: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<WalletResponseDto>) {
    Object.assign(this, partial);
    this.totalBalance = this.availableBalance + this.escrowBalance;
  }
}

export class PaymentMethodResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiProperty()
  @Expose()
  paymentType: string;

  @ApiProperty()
  @Expose()
  lastFour: string;

  @ApiProperty()
  @Expose()
  brand: string;

  @ApiProperty()
  @Expose()
  displayName: string;

  @ApiProperty()
  @Expose()
  isDefault: boolean;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<PaymentMethodResponseDto>) {
    Object.assign(this, partial);
    this.displayName = `${this.brand} ending in ${this.lastFour}`;
  }
}

export class BankAccountResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiProperty()
  @Expose()
  bankName: string;

  @ApiProperty()
  @Expose()
  accountHolderName: string;

  @ApiProperty()
  @Expose()
  lastFour: string;

  @ApiProperty()
  @Expose()
  displayName: string;

  @ApiProperty()
  @Expose()
  isVerified: boolean;

  @ApiProperty()
  @Expose()
  isDefault: boolean;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<BankAccountResponseDto>) {
    Object.assign(this, partial);
    this.displayName = `${this.bankName} ****${this.lastFour}`;
  }
}

export class TransactionResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  walletId: number;

  @ApiProperty()
  @Expose()
  transactionType: string;

  @ApiProperty()
  @Expose()
  amount: number;

  @ApiProperty()
  @Expose()
  status: string;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  stripePaymentIntentId: string;

  @ApiProperty()
  @Expose()
  stripeChargeId: string;

  @ApiProperty()
  @Expose()
  paymentMethodId: number;

  @ApiProperty()
  @Expose()
  tradeId: number;

  @ApiProperty()
  @Expose()
  platformFee: number;

  @ApiProperty()
  @Expose()
  stripeFee: number;

  @ApiProperty()
  @Expose()
  netAmount: number;

  @ApiProperty()
  @Expose()
  balanceBefore: number;

  @ApiProperty()
  @Expose()
  balanceAfter: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  completedAt: Date;

  constructor(partial: Partial<TransactionResponseDto>) {
    Object.assign(this, partial);
    this.netAmount = this.amount - this.platformFee - this.stripeFee;
  }
}
