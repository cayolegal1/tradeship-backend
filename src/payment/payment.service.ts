import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DepositRequestDto } from './dto/deposit.dto';
import { WithdrawalRequestDto } from './dto/withdrawal.dto';
import { EscrowOperationDto } from './dto/escrow.dto';
import {
  WalletResponseDto,
  PaymentMethodResponseDto,
  BankAccountResponseDto,
  TransactionResponseDto,
} from './dto/wallet-response.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  private convertWalletToResponseDto(wallet: any): WalletResponseDto {
    return new WalletResponseDto({
      ...wallet,
      availableBalance: Number(wallet.availableBalance),
      escrowBalance: Number(wallet.escrowBalance),
      totalDeposited: Number(wallet.totalDeposited),
      totalWithdrawn: Number(wallet.totalWithdrawn),
      totalShippingPaid: Number(wallet.totalShippingPaid),
      withdrawalLimitDaily: Number(wallet.withdrawalLimitDaily),
      withdrawalLimitMonthly: Number(wallet.withdrawalLimitMonthly),
    });
  }

  private convertTransactionToResponseDto(
    transaction: any,
  ): TransactionResponseDto {
    return new TransactionResponseDto({
      ...transaction,
      amount: Number(transaction.amount),
      platformFee: Number(transaction.platformFee),
      stripeFee: Number(transaction.stripeFee),
      balanceBefore: transaction.balanceBefore
        ? Number(transaction.balanceBefore)
        : undefined,
      balanceAfter: transaction.balanceAfter
        ? Number(transaction.balanceAfter)
        : undefined,
    });
  }

  async getUserWallet(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      const newWallet = await this.prisma.userWallet.create({
        data: { userId },
      });
      return this.convertWalletToResponseDto(newWallet);
    }

    return this.convertWalletToResponseDto(wallet);
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethodResponseDto[]> {
    const paymentMethods = await this.prisma.paymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return paymentMethods.map((method) => new PaymentMethodResponseDto(method));
  }

  async getBankAccounts(userId: string): Promise<BankAccountResponseDto[]> {
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return bankAccounts.map((account) => new BankAccountResponseDto(account));
  }

  async getTransactions(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    const { page, limit, skip } = paginationDto;

    // Get user's wallet
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          paymentMethod: true,
        },
      }),
      this.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    const transactionDtos = transactions.map((transaction) =>
      this.convertTransactionToResponseDto(transaction),
    );
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(transactionDtos, meta);
  }

  async deposit(
    userId: string,
    depositRequestDto: DepositRequestDto,
  ): Promise<{ message: string; transactionId: string }> {
    const { amount, paymentMethodId, description } = depositRequestDto;

    // Get or create wallet
    let wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.userWallet.create({
        data: { userId },
      });
    }

    // Check if payment method exists and belongs to user
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
        isActive: true,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found or inactive');
    }

    // Create transaction record
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'DEPOSIT',
        amount,
        status: 'PENDING',
        description: description || 'Wallet deposit',
        paymentMethodId,
        balanceBefore: wallet.availableBalance,
      },
    });

    // TODO: Integrate with Stripe to process payment
    // For now, we'll simulate a successful deposit
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(wallet.availableBalance) + amount,
        completedAt: new Date(),
      },
    });

    // Update wallet balance
    await this.prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: Number(wallet.availableBalance) + amount,
        totalDeposited: Number(wallet.totalDeposited) + amount,
      },
    });

    return {
      message: 'Deposit successful',
      transactionId: transaction.id,
    };
  }

  async withdraw(
    userId: string,
    withdrawalRequestDto: WithdrawalRequestDto,
  ): Promise<{ message: string; transactionId: string }> {
    const { amount, bankAccountId, description } = withdrawalRequestDto;

    // Get wallet
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check if user has sufficient balance
    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Check daily withdrawal limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayWithdrawals = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        transactionType: 'WITHDRAWAL',
        status: 'COMPLETED',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: { amount: true },
    });

    const totalTodayWithdrawals = Number(todayWithdrawals._sum.amount) || 0;
    if (totalTodayWithdrawals + amount > Number(wallet.withdrawalLimitDaily)) {
      throw new BadRequestException('Daily withdrawal limit exceeded');
    }

    // Check monthly withdrawal limit
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthWithdrawals = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        transactionType: 'WITHDRAWAL',
        status: 'COMPLETED',
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
    });

    const totalMonthWithdrawals = Number(monthWithdrawals._sum.amount) || 0;
    if (
      totalMonthWithdrawals + amount >
      Number(wallet.withdrawalLimitMonthly)
    ) {
      throw new BadRequestException('Monthly withdrawal limit exceeded');
    }

    // Get bank account if specified
    let bankAccount = null;
    if (bankAccountId) {
      bankAccount = await this.prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          userId,
          isActive: true,
        },
      });

      if (!bankAccount) {
        throw new NotFoundException('Bank account not found or inactive');
      }
    } else {
      // Get default bank account
      bankAccount = await this.prisma.bankAccount.findFirst({
        where: {
          userId,
          isDefault: true,
          isActive: true,
        },
      });

      if (!bankAccount) {
        throw new BadRequestException(
          'No bank account specified and no default account found',
        );
      }
    }

    // Create transaction record
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'WITHDRAWAL',
        amount,
        status: 'PENDING',
        description: description || 'Wallet withdrawal',
        balanceBefore: wallet.availableBalance,
      },
    });

    // TODO: Integrate with Stripe to process withdrawal
    // For now, we'll simulate a successful withdrawal
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(wallet.availableBalance) - amount,
        completedAt: new Date(),
      },
    });

    // Update wallet balance
    await this.prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: Number(wallet.availableBalance) - amount,
        totalWithdrawn: Number(wallet.totalWithdrawn) + amount,
      },
    });

    return {
      message: 'Withdrawal successful',
      transactionId: transaction.id,
    };
  }

  async placeInEscrow(
    userId: string,
    escrowOperationDto: EscrowOperationDto,
  ): Promise<{ message: string; transactionId: string }> {
    const { amount, tradeId, description } = escrowOperationDto;

    // Get wallet
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check if user has sufficient available balance
    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException(
        'Insufficient available balance for escrow',
      );
    }

    // Verify trade exists
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Create transaction record
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'ESCROW_DEPOSIT',
        amount,
        status: 'PENDING',
        description: description || `Escrow deposit for trade ${tradeId}`,
        tradeId,
        balanceBefore: wallet.availableBalance,
      },
    });

    // Update wallet balances
    await this.prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: Number(wallet.availableBalance) - amount,
        escrowBalance: Number(wallet.escrowBalance) + amount,
      },
    });

    // Mark transaction as completed
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(wallet.availableBalance) - amount,
        completedAt: new Date(),
      },
    });

    return {
      message: 'Amount placed in escrow successfully',
      transactionId: transaction.id,
    };
  }

  async releaseFromEscrow(
    userId: string,
    escrowOperationDto: EscrowOperationDto,
  ): Promise<{ message: string; transactionId: string }> {
    const { amount, tradeId, description } = escrowOperationDto;

    // Get wallet
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check if user has sufficient escrow balance
    if (Number(wallet.escrowBalance) < amount) {
      throw new BadRequestException('Insufficient escrow balance');
    }

    // Create transaction record
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'ESCROW_RELEASE',
        amount,
        status: 'PENDING',
        description: description || `Escrow release for trade ${tradeId}`,
        tradeId,
        balanceBefore: wallet.availableBalance,
      },
    });

    // Update wallet balances
    await this.prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: Number(wallet.availableBalance) + amount,
        escrowBalance: Number(wallet.escrowBalance) - amount,
      },
    });

    // Mark transaction as completed
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(wallet.availableBalance) + amount,
        completedAt: new Date(),
      },
    });

    return {
      message: 'Amount released from escrow successfully',
      transactionId: transaction.id,
    };
  }

  async refundFromEscrow(
    userId: string,
    escrowOperationDto: EscrowOperationDto,
  ): Promise<{ message: string; transactionId: string }> {
    const { amount, tradeId, description } = escrowOperationDto;

    // Get wallet
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check if user has sufficient escrow balance
    if (Number(wallet.escrowBalance) < amount) {
      throw new BadRequestException('Insufficient escrow balance');
    }

    // Create transaction record
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'ESCROW_REFUND',
        amount,
        status: 'PENDING',
        description: description || `Escrow refund for trade ${tradeId}`,
        tradeId,
        balanceBefore: wallet.availableBalance,
      },
    });

    // Update wallet balances
    await this.prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: Number(wallet.availableBalance) + amount,
        escrowBalance: Number(wallet.escrowBalance) - amount,
      },
    });

    // Mark transaction as completed
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(wallet.availableBalance) + amount,
        completedAt: new Date(),
      },
    });

    return {
      message: 'Amount refunded from escrow successfully',
      transactionId: transaction.id,
    };
  }

  async payShipping(
    userId: string,
    amount: number,
    tradeId: string,
    description?: string,
  ): Promise<{ message: string; transactionId: string }> {
    // Get wallet
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check if user has sufficient available balance
    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException(
        'Insufficient available balance for shipping payment',
      );
    }

    // Create transaction record
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'SHIPPING_PAYMENT',
        amount,
        status: 'PENDING',
        description: description || `Shipping payment for trade ${tradeId}`,
        tradeId,
        balanceBefore: wallet.availableBalance,
      },
    });

    // Update wallet balances
    await this.prisma.userWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: Number(wallet.availableBalance) - amount,
        totalShippingPaid: Number(wallet.totalShippingPaid) + amount,
      },
    });

    // Mark transaction as completed
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        balanceAfter: Number(wallet.availableBalance) - amount,
        completedAt: new Date(),
      },
    });

    return {
      message: 'Shipping payment successful',
      transactionId: transaction.id,
    };
  }

  async getWalletSummary(userId: string): Promise<{
    wallet: WalletResponseDto;
    recentTransactions: TransactionResponseDto[];
    withdrawalLimits: {
      daily: number;
      monthly: number;
    };
  }> {
    const wallet = await this.getUserWallet(userId);

    const recentTransactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      wallet,
      recentTransactions: recentTransactions.map((t) =>
        this.convertTransactionToResponseDto(t),
      ),
      withdrawalLimits: {
        daily: wallet.withdrawalLimitDaily,
        monthly: wallet.withdrawalLimitMonthly,
      },
    };
  }
}
