import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';

// services
import { TradeService } from './trade.service';

// decorators
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';

// guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/auth/guards/optional-jwt-auth.guard';

// DTOs
import { CreateItemDto } from './dto/create-item.dto';
import { CreateTradeDto } from './dto/create-trade.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateTradeRatingDto } from './dto/create-rating.dto';
import { ItemResponseDto, InterestResponseDto } from './dto/item-response.dto';
import {
  TradeResponseDto,
  ReviewResponseDto,
  TradeRatingResponseDto,
} from './dto/trade-response.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';
import { SuccessResponseDto } from '../common/dto/response.dto';
import { GetItemsDto } from './dto/get-items.dto';
import { User } from '@prisma/client';

@ApiTags('Trading')
@Controller('trade')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  // Interest Management
  @Get('interests')
  @Public()
  @ApiOperation({ summary: 'Get all available interests' })
  @ApiResponse({
    status: 200,
    description: 'Interests retrieved',
    type: [InterestResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInterests(): Promise<InterestResponseDto[]> {
    return this.tradeService.getInterests();
  }

  @Post('interests')
  @ApiOperation({ summary: 'Create a new interest' })
  @ApiResponse({
    status: 201,
    description: 'Interest created successfully',
    type: InterestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createInterest(
    @Body() body: { name: string; description?: string; color?: string },
  ): Promise<InterestResponseDto> {
    return this.tradeService.createInterest(
      body.name,
      body.description,
      body.color,
    );
  }

  @Post('items')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new item' })
  @ApiResponse({ status: 201, description: 'Item created successfully' })
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 5 },
      fileFilter: (
        _req,
        file,
        cb: (err: Error | null, accept: boolean) => void,
      ) => {
        const ok = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
        return ok ? cb(null, true) : cb(new Error('Invalid image type'), false);
      },
    }),
  )
  async createItem(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    // 1) Convertir el body (multipart) a tu CreateItemDto
    console.log(
      'files:',
      images?.length,
      images?.map((f) => f.originalname),
    );
    const dto = await this.tradeService.prepareCreateItemDto(body);
    // 2) Llamar a tu service con la firma correcta
    return this.tradeService.createItem(user.id, dto, { images });
  }

  @Get('items')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all available items with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Items retrieved successfully',
    type: PaginatedResponseDto,
  })
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
  async getItems(
    @Query() itemsDto: GetItemsDto,
    @CurrentUser() user?: User,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    return this.tradeService.getItems(itemsDto, user);
  }

  @Get('items/:id')
  @Public()
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiResponse({
    status: 200,
    description: 'Item retrieved',
    type: ItemResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getItemById(
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<ItemResponseDto> {
    return this.tradeService.getItemById(itemId);
  }

  @Get('items/my')
  @ApiOperation({ summary: 'Get current user items with pagination' })
  @ApiResponse({
    status: 200,
    description: 'User items retrieved successfully',
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
  async getUserItems(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    return this.tradeService.getUserItems(user.id, paginationDto);
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'Update item' })
  @ApiResponse({
    status: 200,
    description: 'Item updated successfully',
    type: ItemResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateItem(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() updateData: Partial<CreateItemDto>,
  ): Promise<ItemResponseDto> {
    return this.tradeService.updateItem(user.id, itemId, updateData);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete item' })
  @ApiResponse({
    status: 200,
    description: 'Item deleted successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async deleteItem(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<SuccessResponseDto> {
    const result = await this.tradeService.deleteItem(user.id, itemId);
    return new SuccessResponseDto(result.message);
  }

  // Trade Management
  @Post('trades')
  @ApiOperation({ summary: 'Create a new trade' })
  @ApiResponse({
    status: 201,
    description: 'Trade created successfully',
    type: TradeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTrade(
    @CurrentUser() user: any,
    @Body() createTradeDto: CreateTradeDto,
  ): Promise<TradeResponseDto> {
    return this.tradeService.createTrade(user.id, createTradeDto);
  }

  @Get('trades')
  @ApiOperation({ summary: 'Get user trades with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Trades retrieved successfully',
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
  async getTrades(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<TradeResponseDto>> {
    return this.tradeService.getTrades(user.id, paginationDto);
  }

  @Get('trades/:id')
  @ApiOperation({ summary: 'Get trade by ID' })
  @ApiResponse({
    status: 200,
    description: 'Trade retrieved',
    type: TradeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async getTradeById(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeId: number,
  ): Promise<TradeResponseDto> {
    return this.tradeService.getTradeById(tradeId, user.id);
  }

  @Post('trades/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a trade' })
  @ApiResponse({
    status: 200,
    description: 'Trade accepted successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async acceptTrade(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeId: number,
  ): Promise<SuccessResponseDto> {
    const result = await this.tradeService.acceptTrade(tradeId, user.id);
    return new SuccessResponseDto(result.message);
  }

  @Post('trades/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a trade' })
  @ApiResponse({
    status: 200,
    description: 'Trade completed successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async completeTrade(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeId: number,
  ): Promise<SuccessResponseDto> {
    const result = await this.tradeService.completeTrade(tradeId, user.id);
    return new SuccessResponseDto(result.message);
  }

  @Post('trades/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a trade' })
  @ApiResponse({
    status: 200,
    description: 'Trade cancelled successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async cancelTrade(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) tradeId: number,
    @Body() body: { reason?: string },
  ): Promise<SuccessResponseDto> {
    const result = await this.tradeService.cancelTrade(
      tradeId,
      user.id,
      body.reason,
    );
    return new SuccessResponseDto(result.message);
  }

  // Review Management
  @Post('reviews')
  @ApiOperation({ summary: 'Create a trade review' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async createReview(
    @CurrentUser() user: any,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.tradeService.createReview(user.id, createReviewDto);
  }

  @Get('trades/:id/reviews')
  @ApiOperation({ summary: 'Get trade reviews' })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved',
    type: [ReviewResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async getTradeReviews(
    @Param('id', ParseIntPipe) tradeId: number,
  ): Promise<ReviewResponseDto[]> {
    return this.tradeService.getTradeReviews(tradeId);
  }

  // Rating Management
  @Post('ratings')
  @ApiOperation({ summary: 'Create a trade rating' })
  @ApiResponse({
    status: 201,
    description: 'Rating created successfully',
    type: TradeRatingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async createTradeRating(
    @CurrentUser() user: any,
    @Body() createRatingDto: CreateTradeRatingDto,
  ): Promise<TradeRatingResponseDto> {
    return this.tradeService.createTradeRating(user.id, createRatingDto);
  }

  @Get('trades/:id/ratings')
  @ApiOperation({ summary: 'Get trade ratings' })
  @ApiResponse({
    status: 200,
    description: 'Ratings retrieved',
    type: [TradeRatingResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  async getTradeRatings(
    @Param('id', ParseIntPipe) tradeId: number,
  ): Promise<TradeRatingResponseDto[]> {
    return this.tradeService.getTradeRatings(tradeId);
  }

  @Get('health')
  @ApiOperation({ summary: 'Trade service health check' })
  @ApiResponse({ status: 200, description: 'Trade service is healthy' })
  async healthCheck(): Promise<SuccessResponseDto> {
    return new SuccessResponseDto('Trade API is running');
  }
}
