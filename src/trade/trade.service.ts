import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// services
import { PrismaService } from '../common/prisma/prisma.service';
import { ItemService } from './services/item.service';
import { TradeManagementService } from './services/trade-management.service';
import { ReviewService } from './services/review.service';
import { FileService } from './services/file.service';

// dtos
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
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { GetItemsDto } from './dto/get-items.dto';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly itemService: ItemService,
    private readonly tradeManagementService: TradeManagementService,
    private readonly reviewService: ReviewService,
    private readonly fileService: FileService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  // ==================== ITEM METHODS ====================

  async prepareCreateItemDto(raw: Record<string, any>): Promise<CreateItemDto> {
    return this.itemService.prepareCreateItemDto(raw);
  }

  async getInterests(): Promise<InterestResponseDto[]> {
    return this.itemService.getInterests();
  }

  async createInterest(name: string): Promise<InterestResponseDto> {
    return this.itemService.createInterest(name);
  }

  async createItem(
    userId: number,
    createItemDto: CreateItemDto,
    images?: Express.Multer.File[],
  ): Promise<ItemResponseDto> {
    // Validate and upload images if provided
    if (images && images.length > 0) {
      images.forEach((image) => this.fileService.validateImageFile(image));
    }

    return this.itemService.createItem(userId, createItemDto, images);
  }

  async getItems(
    getItemsDto: GetItemsDto,
    userId?: number,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    return this.itemService.getItems(getItemsDto, userId);
  }

  async getItemById(itemId: number): Promise<ItemResponseDto> {
    return this.itemService.getItemById(itemId);
  }

  async getUserItems(
    userId: number,
    getItemsDto: GetItemsDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    return this.itemService.getUserItems(userId, getItemsDto);
  }

  async updateItem(
    itemId: number,
    userId: number,
    updateData: Partial<CreateItemDto>,
    images?: Express.Multer.File[],
  ): Promise<ItemResponseDto> {
    // Validate images if provided
    if (images && images.length > 0) {
      images.forEach((image) => this.fileService.validateImageFile(image));
    }

    return this.itemService.updateItem(itemId, userId, updateData, images);
  }

  async deleteItem(
    itemId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return this.itemService.deleteItem(itemId, userId);
  }

  // ==================== TRADE METHODS ====================

  async createTrade(
    userId: number,
    createTradeDto: CreateTradeDto,
  ): Promise<TradeResponseDto> {
    return this.tradeManagementService.createTrade(userId, createTradeDto);
  }

  async getTrades(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<PaginatedResponseDto<TradeResponseDto>> {
    return this.tradeManagementService.getTrades(userId, page, limit, status);
  }

  async getTradeById(
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    return this.tradeManagementService.getTradeById(tradeId, userId);
  }

  async acceptTrade(
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    return this.tradeManagementService.acceptTrade(tradeId, userId);
  }

  async completeTrade(
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    return this.tradeManagementService.completeTrade(tradeId, userId);
  }

  async cancelTrade(
    tradeId: number,
    userId: number,
  ): Promise<{ message: string }> {
    return this.tradeManagementService.cancelTrade(tradeId, userId);
  }

  // ==================== REVIEW METHODS ====================

  async createReview(
    userId: number,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.createReview(userId, createReviewDto);
  }

  async getTradeReviews(tradeId: number): Promise<ReviewResponseDto[]> {
    return this.reviewService.getTradeReviews(tradeId);
  }

  async createTradeRating(
    userId: number,
    createTradeRatingDto: CreateTradeRatingDto,
  ): Promise<TradeRatingResponseDto> {
    return this.reviewService.createTradeRating(userId, createTradeRatingDto);
  }

  async getTradeRatings(tradeId: number): Promise<TradeRatingResponseDto[]> {
    return this.reviewService.getTradeRatings(tradeId);
  }

  // ==================== FILE METHODS ====================

  async uploadItemImages(
    itemId: number,
    images: Express.Multer.File[],
  ): Promise<any[]> {
    return this.fileService.uploadItemImages(itemId, images);
  }

  async removeSupabaseFiles(paths: string[]): Promise<void> {
    return this.fileService.removeSupabaseFiles(paths);
  }

  // ==================== LEGACY METHODS (for backward compatibility) ====================

  private async updateTraderRating(): Promise<void> {
    // This method is now handled by ReviewService
    this.logger.warn(
      'updateTraderRating called directly - this should be handled by ReviewService',
    );
  }

  private async calculateTraderTier(): Promise<void> {
    // This method is now handled by ReviewService
    this.logger.warn(
      'calculateTraderTier called directly - this should be handled by ReviewService',
    );
  }
}
