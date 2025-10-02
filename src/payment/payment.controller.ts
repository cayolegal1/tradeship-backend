import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuccessResponseDto } from '../common/dto/response.dto';

@ApiTags('Payments')
@Controller('payment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Get user wallet information' })
  @ApiResponse({
    status: 200,
    description: 'Wallet information retrieved',
    type: WalletResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWallet(@CurrentUser() user: any): Promise<WalletResponseDto> {
    return this.paymentService.getUserWallet(user.id);
  }

  @Get('wallet/summary')
  @ApiOperation({ summary: 'Get wallet summary with recent transactions' })
  @ApiResponse({ status: 200, description: 'Wallet summary retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletSummary(@CurrentUser() user: any): Promise<any> {
    return this.paymentService.getWalletSummary(user.id);
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'Get user payment methods' })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved',
    type: [PaymentMethodResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPaymentMethods(
    @CurrentUser() user: any,
  ): Promise<PaymentMethodResponseDto[]> {
    return this.paymentService.getPaymentMethods(user.id);
  }

  @Get('bank-accounts')
  @ApiOperation({ summary: 'Get user bank accounts' })
  @ApiResponse({
    status: 200,
    description: 'Bank accounts retrieved',
    type: [BankAccountResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBankAccounts(
    @CurrentUser() user: any,
  ): Promise<BankAccountResponseDto[]> {
    return this.paymentService.getBankAccounts(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transactions with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  async getTransactions(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    return this.paymentService.getTransactions(user.id, paginationDto);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit money to wallet' })
  @ApiResponse({ status: 200, description: 'Deposit successful' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async deposit(
    @CurrentUser() user: any,
    @Body() depositRequestDto: DepositRequestDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.paymentService.deposit(
      user.id,
      depositRequestDto,
    );
    return new SuccessResponseDto(result.message);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw money from wallet' })
  @ApiResponse({ status: 200, description: 'Withdrawal successful' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  async withdraw(
    @CurrentUser() user: any,
    @Body() withdrawalRequestDto: WithdrawalRequestDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.paymentService.withdraw(
      user.id,
      withdrawalRequestDto,
    );
    return new SuccessResponseDto(result.message);
  }

  @Post('escrow/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Place amount in escrow' })
  @ApiResponse({
    status: 200,
    description: 'Amount placed in escrow successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async placeInEscrow(
    @CurrentUser() user: any,
    @Body() escrowOperationDto: EscrowOperationDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.paymentService.placeInEscrow(
      user.id,
      escrowOperationDto,
    );
    return new SuccessResponseDto(result.message);
  }

  @Post('escrow/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release amount from escrow' })
  @ApiResponse({
    status: 200,
    description: 'Amount released from escrow successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async releaseFromEscrow(
    @CurrentUser() user: any,
    @Body() escrowOperationDto: EscrowOperationDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.paymentService.releaseFromEscrow(
      user.id,
      escrowOperationDto,
    );
    return new SuccessResponseDto(result.message);
  }

  @Post('escrow/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund amount from escrow' })
  @ApiResponse({
    status: 200,
    description: 'Amount refunded from escrow successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async refundFromEscrow(
    @CurrentUser() user: any,
    @Body() escrowOperationDto: EscrowOperationDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.paymentService.refundFromEscrow(
      user.id,
      escrowOperationDto,
    );
    return new SuccessResponseDto(result.message);
  }

  @Post('shipping/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay for shipping' })
  @ApiResponse({ status: 200, description: 'Shipping payment successful' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async payShipping(
    @CurrentUser() user: any,
    @Body() body: { amount: number; tradeId: string; description?: string },
  ): Promise<SuccessResponseDto> {
    const result = await this.paymentService.payShipping(
      user.id,
      body.amount,
      body.tradeId,
      body.description,
    );
    return new SuccessResponseDto(result.message);
  }

  @Get('health')
  @ApiOperation({ summary: 'Payment service health check' })
  @ApiResponse({ status: 200, description: 'Payment service is healthy' })
  async healthCheck(): Promise<SuccessResponseDto> {
    return new SuccessResponseDto('Payment API is running');
  }
}
