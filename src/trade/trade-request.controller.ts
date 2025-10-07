import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TradeRequestService } from './trade-request.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTradeRequestDto } from './dto/create-trade-request.dto';
import { UpdateTradeRequestDto } from './dto/update-trade-request.dto';
import { RespondTradeRequestDto } from './dto/respond-trade-request.dto';
import { GetTradeRequestsDto } from './dto/get-trade-requests.dto';
import { TradeRequestResponseDto } from './dto/trade-request-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { SuccessResponseDto } from '../common/dto/response.dto';

@ApiTags('Trade Requests')
@Controller('trade-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradeRequestController {
  constructor(private readonly tradeRequestService: TradeRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new trade request' })
  @ApiResponse({
    status: 201,
    description: 'Trade request created successfully',
    type: TradeRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Trade request already exists' })
  async createTradeRequest(
    @CurrentUser() user: any,
    @Body() createTradeRequestDto: CreateTradeRequestDto,
  ): Promise<TradeRequestResponseDto> {
    return this.tradeRequestService.createTradeRequest(
      user.id,
      createTradeRequestDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get trade requests with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'Trade requests retrieved successfully',
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
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description:
      'Filter by status (PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED)',
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    type: String,
    description: 'Filter by direction (sent, received)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      'Sort order (createdAt:desc, createdAt:asc, updatedAt:desc, updatedAt:asc)',
  })
  async getTradeRequests(
    @CurrentUser() user: any,
    @Query() getTradeRequestsDto: GetTradeRequestsDto,
  ): Promise<PaginatedResponseDto<TradeRequestResponseDto>> {
    return this.tradeRequestService.getTradeRequests(
      user.id,
      getTradeRequestsDto,
    );
  }

  @Get('sent')
  @ApiOperation({ summary: 'Get trade requests sent by the user' })
  @ApiResponse({
    status: 200,
    description: 'Sent trade requests retrieved successfully',
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
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
  })
  async getSentTradeRequests(
    @CurrentUser() user: any,
    @Query() getTradeRequestsDto: GetTradeRequestsDto,
  ): Promise<PaginatedResponseDto<TradeRequestResponseDto>> {
    const dto = { ...getTradeRequestsDto, direction: 'sent' };
    return this.tradeRequestService.getTradeRequests(
      user.id,
      dto as GetTradeRequestsDto,
    );
  }

  @Get('received')
  @ApiOperation({ summary: 'Get trade requests received by the user' })
  @ApiResponse({
    status: 200,
    description: 'Received trade requests retrieved successfully',
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
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
  })
  async getReceivedTradeRequests(
    @CurrentUser() user: any,
    @Query() getTradeRequestsDto: GetTradeRequestsDto,
  ): Promise<PaginatedResponseDto<TradeRequestResponseDto>> {
    const dto = { ...getTradeRequestsDto, direction: 'received' };
    return this.tradeRequestService.getTradeRequests(
      user.id,
      dto as GetTradeRequestsDto,
    );
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending trade requests received by the user' })
  @ApiResponse({
    status: 200,
    description: 'Pending trade requests retrieved successfully',
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
  async getPendingTradeRequests(
    @CurrentUser() user: any,
    @Query() getTradeRequestsDto: GetTradeRequestsDto,
  ): Promise<PaginatedResponseDto<TradeRequestResponseDto>> {
    const dto = {
      ...getTradeRequestsDto,
      direction: 'received',
      status: 'PENDING',
    };
    return this.tradeRequestService.getTradeRequests(
      user.id,
      dto as GetTradeRequestsDto,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get trade request statistics for the user' })
  @ApiResponse({
    status: 200,
    description: 'Trade request statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        pendingReceived: { type: 'number', example: 3 },
        pendingSent: { type: 'number', example: 1 },
        totalReceived: { type: 'number', example: 15 },
        totalSent: { type: 'number', example: 8 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTradeRequestStats(@CurrentUser() user: any): Promise<{
    pendingReceived: number;
    pendingSent: number;
    totalReceived: number;
    totalSent: number;
  }> {
    return this.tradeRequestService.getTradeRequestStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trade request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Trade request retrieved successfully',
    type: TradeRequestResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade request not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Trade request ID',
  })
  async getTradeRequestById(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeRequestId: number,
  ): Promise<TradeRequestResponseDto> {
    return this.tradeRequestService.getTradeRequestById(
      tradeRequestId,
      user.id,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a trade request (only by requester)' })
  @ApiResponse({
    status: 200,
    description: 'Trade request updated successfully',
    type: TradeRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade request not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Trade request ID',
  })
  async updateTradeRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeRequestId: number,
    @Body() updateTradeRequestDto: UpdateTradeRequestDto,
  ): Promise<TradeRequestResponseDto> {
    return this.tradeRequestService.updateTradeRequest(
      tradeRequestId,
      user.id,
      updateTradeRequestDto,
    );
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Respond to a trade request (accept or decline)' })
  @ApiResponse({
    status: 200,
    description: 'Trade request responded to successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Trade request accepted successfully!',
        },
        tradeId: {
          type: 'number',
          example: 123,
          description: 'Only present if accepted',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade request not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Trade request ID',
  })
  async respondToTradeRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeRequestId: number,
    @Body() respondTradeRequestDto: RespondTradeRequestDto,
  ): Promise<{ message: string; tradeId?: number }> {
    return this.tradeRequestService.respondToTradeRequest(
      tradeRequestId,
      user.id,
      respondTradeRequestDto,
    );
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a trade request' })
  @ApiResponse({
    status: 200,
    description: 'Trade request accepted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Trade request accepted successfully!',
        },
        tradeId: { type: 'number', example: 123 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade request not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Trade request ID',
  })
  async acceptTradeRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeRequestId: number,
    @Body() body: { message?: string } = {},
  ): Promise<{ message: string; tradeId?: number }> {
    return this.tradeRequestService.respondToTradeRequest(
      tradeRequestId,
      user.id,
      {
        accept: true,
        message: body.message,
      },
    );
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a trade request' })
  @ApiResponse({
    status: 200,
    description: 'Trade request declined successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade request not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Trade request ID',
  })
  async declineTradeRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeRequestId: number,
    @Body() body: { message?: string } = {},
  ): Promise<{ message: string }> {
    const result = await this.tradeRequestService.respondToTradeRequest(
      tradeRequestId,
      user.id,
      {
        accept: false,
        message: body.message,
      },
    );
    return { message: result.message };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a trade request (only by requester)' })
  @ApiResponse({
    status: 200,
    description: 'Trade request cancelled successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade request not found' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Trade request ID',
  })
  async cancelTradeRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeRequestId: number,
  ): Promise<SuccessResponseDto> {
    const result = await this.tradeRequestService.cancelTradeRequest(
      tradeRequestId,
      user.id,
    );
    return new SuccessResponseDto(result.message);
  }
}
