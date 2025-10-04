import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Express } from 'express';
// services
import { PrismaService } from '../common/prisma/prisma.service';

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
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';
import { GetItemsDto } from './dto/get-items.dto';

type UploadedImageMetadata = {
  storagePath: string;
  url: string;
  originalName: string;
  mimeType?: string;
  fileSize?: number;
};

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private supabaseClient: SupabaseClient | null = null;
  private supabaseBucket: string | null = null;

  private convertItemToResponseDto(item: any): ItemResponseDto {
    const shippingDetails = item?.shippingDetails
      ? {
          ...item.shippingDetails,
          shippingWeight: Number(item.shippingDetails.shippingWeight),
          length: Number(item.shippingDetails.length),
          width: Number(item.shippingDetails.width),
          height: Number(item.shippingDetails.height),
        }
      : undefined;

    return new ItemResponseDto({
      ...item,
      price: Number(item.price),
      minimumTradeValue: item.minimumTradeValue
        ? Number(item.minimumTradeValue)
        : undefined,
      shippingDetails,
    });
  }

  private convertTradeToResponseDto(trade: any): TradeResponseDto {
    return new TradeResponseDto({
      ...trade,
      cashAmount: trade.cashAmount ? Number(trade.cashAmount) : undefined,
    });
  }

  async prepareCreateItemDto(raw: Record<string, any>): Promise<CreateItemDto> {
    const normalized = this.normalizeCreateItemPayload(raw);
    const dto = plainToInstance(CreateItemDto, normalized);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) {
      throw new BadRequestException(
        `Invalid item payload: ${this.formatValidationErrors(errors)}`,
      );
    }
    return dto;
  }

  private normalizeCreateItemPayload(
    raw: Record<string, any>,
  ): Record<string, any> {
    if (!raw) {
      return {};
    }
    const parsedRoot = this.parseJsonIfPossible<Record<string, any>>(raw.root);
    const parsedShipping =
      this.parseJsonIfPossible<Record<string, any>>(raw.shipping) ??
      parsedRoot?.shipping;
    const payload: Record<string, any> = {
      name: raw.name ?? raw.title ?? raw.itemName ?? parsedRoot?.name,
      description:
        raw.description ?? raw.details ?? raw.body ?? parsedRoot?.description,
      price: raw.price ?? raw.estimatedValue ?? parsedRoot?.price,
      tradePreferences:
        raw.tradePreferences ?? parsedRoot?.tradePreferences ?? raw.preferences,
      minimumTradeValue:
        raw.minimumTradeValue ??
        parsedRoot?.minimumTradeValue ??
        raw.minTradeValue,
      acceptsCashOffers:
        raw.acceptsCashOffers ??
        parsedRoot?.acceptsCashOffers ??
        raw.cashOffers,
    };
    const interests =
      this.parseInterests(raw['interests[]']) ??
      this.parseInterests(raw.interests) ??
      this.parseInterests(parsedRoot?.interests);
    if (interests?.length) {
      payload.interests = interests;
    }
    const shippingWeight =
      raw['shipping[weight]'] ??
      parsedShipping?.weight ??
      raw.weight ??
      raw.shippingWeight;
    const shippingLength =
      raw['shipping[dimensions][length]'] ??
      parsedShipping?.dimensions?.length ??
      raw.length ??
      raw.shippingLength;
    const shippingWidth =
      raw['shipping[dimensions][width]'] ??
      parsedShipping?.dimensions?.width ??
      raw.width ??
      raw.shippingWidth;
    const shippingHeight =
      raw['shipping[dimensions][height]'] ??
      parsedShipping?.dimensions?.height ??
      raw.height ??
      raw.shippingHeight;
    if (
      shippingWeight !== undefined ||
      shippingLength !== undefined ||
      shippingWidth !== undefined ||
      shippingHeight !== undefined
    ) {
      payload.shipping = {
        weight: shippingWeight,
        dimensions: {
          length: shippingLength,
          width: shippingWidth,
          height: shippingHeight,
        },
      };
    } else if (parsedShipping) {
      payload.shipping = parsedShipping;
    }
    return payload;
  }

  private parseInterests(value: any): number[] | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    let rawValues: any[] = [];
    if (Array.isArray(value)) {
      rawValues = value;
    } else if (typeof value === 'string') {
      const parsedJson = this.parseJsonIfPossible<any[]>(value);
      if (parsedJson) {
        rawValues = parsedJson;
      } else {
        rawValues = value.split(',');
      }
    } else {
      rawValues = [value];
    }
    const numeric = rawValues
      .map((entry) => {
        if (typeof entry === 'number') {
          return entry;
        }
        const parsed = parseInt(String(entry).trim(), 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      })
      .filter((val): val is number => val !== undefined);
    return numeric.length ? numeric : undefined;
  }

  private parseJsonIfPossible<T>(value: any): T | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  private formatValidationErrors(errors: ValidationError[]): string {
    const messages: string[] = [];
    const walk = (items: ValidationError[], parent?: string) => {
      for (const error of items) {
        const propertyPath = parent
          ? `${parent}.${error.property}`
          : error.property;
        if (error.constraints) {
          messages.push(
            `${propertyPath}: ${Object.values(error.constraints).join(', ')}`,
          );
        }
        if (error.children?.length) {
          walk(error.children, propertyPath);
        }
      }
    };
    walk(errors);
    return messages.join('; ');
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabaseClient) {
      const url =
        this.configService.get<string>('SUPABASE_URL') ??
        this.configService.get<string>('SUPABASE_PROJECT_URL');
      const key =
        this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
        this.configService.get<string>('SUPABASE_SERVICE_KEY');
      if (!url || !key) {
        throw new BadRequestException('Supabase storage is not configured');
      }
      this.supabaseBucket =
        this.configService.get<string>('SUPABASE_ITEMS_BUCKET') ??
        'trade-items';
      this.supabaseClient = createClient(url, key);
    }
    return this.supabaseClient;
  }

  private getSupabaseBucket(): string {
    if (!this.supabaseBucket) {
      this.getSupabaseClient();
    }
    return this.supabaseBucket ?? 'trade-items';
  }

  private sanitizeFileName(filename: string): string {
    if (!filename) {
      return 'item-image';
    }
    return filename
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  private async uploadItemImages(
    itemId: number,
    files: Express.Multer.File[],
  ): Promise<UploadedImageMetadata[]> {
    if (!files?.length) {
      return [];
    }
    const client = this.getSupabaseClient();
    const bucket = this.getSupabaseBucket();
    const uploads: UploadedImageMetadata[] = [];
    for (const file of files) {
      const safeName = this.sanitizeFileName(file.originalname ?? '');
      const uniqueName = safeName
        ? `${Date.now()}-${safeName}`
        : `${Date.now()}`;
      const path = `${itemId}/${uniqueName}`;
      this.logger.log(
        `Uploading: ${file.originalname} (${file.mimetype}, ${file.size} bytes) to ${bucket}/${path}`,
      );
      const { error } = await client.storage
        .from(bucket)
        .upload(path, file.buffer, {
          contentType: file.mimetype ?? 'application/octet-stream',
        });
      if (error) {
        this.logger.error(
          `Supabase upload error for ${path}: ${error.message}`,
        );
        if (uploads.length) {
          await this.removeSupabaseFiles(
            uploads.map((item) => item.storagePath),
          );
        }
        throw new BadRequestException(
          `Unable to upload image ${file.originalname ?? safeName}: ${error.message}`,
        );
      }
      const { data } = client.storage.from(bucket).getPublicUrl(path);
      uploads.push({
        storagePath: path,
        url: data.publicUrl,
        originalName: file.originalname ?? safeName,
        mimeType: file.mimetype,
        fileSize: file.size,
      });
      this.logger.log(`Uploaded OK: ${path} → ${data.publicUrl}`);
    }
    return uploads;
  }

  private async removeSupabaseFiles(paths: string[]): Promise<void> {
    if (!paths.length) {
      return;
    }
    try {
      const client = this.getSupabaseClient();
      const bucket = this.getSupabaseBucket();
      await client.storage.from(bucket).remove(paths);
    } catch {
      // Ignore cleanup errors to avoid masking the original issue
    }
  }
  // Interest Management
  async getInterests(): Promise<InterestResponseDto[]> {
    const interests = await this.prisma.interest.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return interests.map((interest) => new InterestResponseDto(interest));
  }

  async createInterest(
    name: string,
    description?: string,
    color?: string,
  ): Promise<InterestResponseDto> {
    const interest = await this.prisma.interest.create({
      data: {
        name,
        description,
        color: color || '#007bff',
      },
    });

    return new InterestResponseDto(interest);
  }

  // Item Management
  async createItem(
    userId: number,
    createItemDto: CreateItemDto,
    options: { images?: Express.Multer.File[] } = {},
  ): Promise<ItemResponseDto> {
    const { interests, shipping, ...itemData } = createItemDto;
    const { images = [] } = options;

    const createdItem = await this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          ...itemData,
          owner: {
            connect: { id: userId },
          },
          interests: interests?.length
            ? {
                connect: interests.map((id) => ({ id })),
              }
            : undefined,
        },
      });

      if (shipping?.weight && shipping?.dimensions) {
        await tx.shippingDetails.create({
          data: {
            itemId: item.id,
            shippingWeight: shipping.weight,
            length: shipping.dimensions.length,
            width: shipping.dimensions.width,
            height: shipping.dimensions.height,
          },
        });
      }

      return item;
    });

    let uploadedImages: UploadedImageMetadata[] = [];
    try {
      if (images.length) {
        uploadedImages = await this.uploadItemImages(createdItem.id, images);
        if (uploadedImages.length) {
          await this.prisma.itemImage.createMany({
            data: uploadedImages.map((image, index) => ({
              itemId: createdItem.id,
              storagePath: image.storagePath,
              url: image.url,
              originalName: image.originalName,
              mimeType: image.mimeType,
              fileSize: image.fileSize,
              isPrimary: index === 0,
            })),
          });
        }
      }
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.itemImage.deleteMany({ where: { itemId: createdItem.id } });
        await tx.shippingDetails.deleteMany({
          where: { itemId: createdItem.id },
        });
        await tx.item.delete({ where: { id: createdItem.id } });
      });
      if (uploadedImages.length) {
        await this.removeSupabaseFiles(
          uploadedImages.map((img) => img.storagePath),
        );
      }
      throw error;
    }

    const itemWithRelations = await this.prisma.item.findUnique({
      where: { id: createdItem.id },
      include: {
        interests: true,
        images: true,
        files: true,
        shippingDetails: true,
      },
    });

    if (!itemWithRelations) {
      throw new NotFoundException('Item could not be created');
    }

    return this.convertItemToResponseDto(itemWithRelations);
  }

  async getItems(
    itemsDto: GetItemsDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    const { page, limit, skip } = itemsDto;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where: { isActive: true, isAvailableForTrade: true },
        include: {
          interests: true,
          images: true,
          files: true,
          shippingDetails: true,
          owner: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({
        where: { isActive: true, isAvailableForTrade: true },
      }),
    ]);

    const itemDtos = items.map((item) => this.convertItemToResponseDto(item));
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(itemDtos, meta);
  }

  async getItemById(itemId: number): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        interests: true,
        images: true,
        files: true,
        shippingDetails: true,
        owner: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return this.convertItemToResponseDto(item);
  }

  async getUserItems(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    const { page, limit, skip } = paginationDto;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where: { ownerId: userId },
        include: {
          interests: true,
          images: true,
          files: true,
          shippingDetails: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({
        where: { ownerId: userId },
      }),
    ]);

    const itemDtos = items.map((item) => this.convertItemToResponseDto(item));
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(itemDtos, meta);
  }

  async updateItem(
    userId: number,
    itemId: number,
    updateData: Partial<CreateItemDto>,
  ): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, ownerId: userId },
    });

    if (!item) {
      throw new NotFoundException('Item not found or you do not own this item');
    }

    const { interests, shipping, ...itemData } = updateData;

    await this.prisma.item.update({
      where: { id: itemId },
      data: {
        ...itemData,
        interests: interests
          ? {
              set: interests.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    if (shipping?.weight && shipping?.dimensions) {
      await this.prisma.shippingDetails.upsert({
        where: { itemId },
        update: {
          shippingWeight: shipping.weight,
          length: shipping.dimensions.length,
          width: shipping.dimensions.width,
          height: shipping.dimensions.height,
        },
        create: {
          itemId,
          shippingWeight: shipping.weight,
          length: shipping.dimensions.length,
          width: shipping.dimensions.width,
          height: shipping.dimensions.height,
        },
      });
    }

    const updatedItem = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        interests: true,
        images: true,
        files: true,
        shippingDetails: true,
      },
    });

    if (!updatedItem) {
      throw new NotFoundException('Item could not be updated');
    }

    return this.convertItemToResponseDto(updatedItem);
  }

  async deleteItem(
    userId: number,
    itemId: number,
  ): Promise<{ message: string }> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, ownerId: userId },
    });

    if (!item) {
      throw new NotFoundException('Item not found or you do not own this item');
    }

    await this.prisma.item.update({
      where: { id: itemId },
      data: { isActive: false },
    });

    return { message: 'Item deleted successfully' };
  }

  // Trade Management
  async createTrade(
    userId: number,
    createTradeDto: CreateTradeDto,
  ): Promise<TradeResponseDto> {
    const {
      traderReceivingId,
      itemOfferedId,
      itemRequestedId,
      cashAmount,
      notes,
      estimatedCompletion,
    } = createTradeDto;

    // Validate that user is not trading with themselves
    if (traderReceivingId === userId) {
      throw new BadRequestException('You cannot trade with yourself');
    }

    // Validate that the offered item belongs to the user
    const offeredItem = await this.prisma.item.findFirst({
      where: { id: itemOfferedId, ownerId: userId },
    });

    if (!offeredItem) {
      throw new BadRequestException('You can only offer your own items');
    }

    if (!offeredItem.isActive || !offeredItem.isAvailableForTrade) {
      throw new BadRequestException('This item is not available for trading');
    }

    // Validate that the requested item belongs to the receiving trader
    if (itemRequestedId) {
      const requestedItem = await this.prisma.item.findFirst({
        where: { id: itemRequestedId, ownerId: traderReceivingId },
      });

      if (!requestedItem) {
        throw new BadRequestException(
          'The requested item must belong to the receiving trader',
        );
      }

      if (!requestedItem.isActive || !requestedItem.isAvailableForTrade) {
        throw new BadRequestException(
          'The requested item is not available for trading',
        );
      }
    }

    // Validate minimum trade value if set
    if (offeredItem.minimumTradeValue) {
      const totalValue = (itemRequestedId ? 0 : 0) + (cashAmount || 0); // Would need to get requested item value
      if (totalValue < Number(offeredItem.minimumTradeValue)) {
        throw new BadRequestException(
          `Trade value must be at least $${Number(offeredItem.minimumTradeValue)}`,
        );
      }
    }

    const trade = await this.prisma.trade.create({
      data: {
        traderOfferingId: userId,
        traderReceivingId,
        itemOfferedId,
        itemRequestedId,
        cashAmount,
        notes,
        estimatedCompletion: estimatedCompletion
          ? new Date(estimatedCompletion)
          : null,
      },
    });

    return this.convertTradeToResponseDto(trade);
  }

  async getTrades(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<TradeResponseDto>> {
    const { page, limit, skip } = paginationDto;

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: {
          OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        },
        include: {
          itemOffered: true,
          itemRequested: true,
          traderOffering: true,
          traderReceiving: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trade.count({
        where: {
          OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        },
      }),
    ]);

    const tradeDtos = trades.map((trade) =>
      this.convertTradeToResponseDto(trade),
    );
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(tradeDtos, meta);
  }

  async getTradeById(
    tradeId: number,
    userId: number,
  ): Promise<TradeResponseDto> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
      },
      include: {
        itemOffered: true,
        itemRequested: true,
        traderOffering: true,
        traderReceiving: true,
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to view this trade',
      );
    }

    return this.convertTradeToResponseDto(trade);
  }

  async acceptTrade(
    tradeId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        traderReceivingId: userId,
        status: 'PENDING',
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to accept this trade',
      );
    }

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    return { message: 'Trade accepted successfully' };
  }

  async completeTrade(
    tradeId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'IN_ESCROW'] },
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to complete this trade',
      );
    }

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update trader statistics
    try {
      const offeringProfile = await this.prisma.userProfile.findUnique({
        where: { userId: trade.traderOfferingId },
      });

      const receivingProfile = await this.prisma.userProfile.findUnique({
        where: { userId: trade.traderReceivingId },
      });

      if (offeringProfile) {
        await this.prisma.userProfile.update({
          where: { id: offeringProfile.id },
          data: {
            totalTrades: offeringProfile.totalTrades + 1,
            successfulTrades: offeringProfile.successfulTrades + 1,
          },
        });
      }

      if (receivingProfile) {
        await this.prisma.userProfile.update({
          where: { id: receivingProfile.id },
          data: {
            totalTrades: receivingProfile.totalTrades + 1,
            successfulTrades: receivingProfile.successfulTrades + 1,
          },
        });
      }
    } catch (error) {
      // Handle case where profiles don't exist yet
      console.error('Error updating trader statistics:', error);
    }

    return { message: 'Trade completed successfully' };
  }

  async cancelTrade(
    tradeId: number,
    userId: number,
    reason?: string,
  ): Promise<{ message: string }> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [{ traderOfferingId: userId }, { traderReceivingId: userId }],
        status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    if (!trade) {
      throw new NotFoundException(
        'Trade not found or you are not authorized to cancel this trade',
      );
    }

    const updatedNotes = reason
      ? `Cancelled: ${reason}\n${trade.notes || ''}`
      : trade.notes;

    await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: updatedNotes,
      },
    });

    return { message: 'Trade cancelled successfully' };
  }

  // Review Management
  async createReview(
    userId: number,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const { tradeId, rating, description, wouldTradeAgain } = createReviewDto;

    // Check if trade is completed
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.status !== 'COMPLETED') {
      throw new BadRequestException('You can only review completed trades');
    }

    // Check if user was involved in the trade
    if (
      userId !== trade.traderOfferingId &&
      userId !== trade.traderReceivingId
    ) {
      throw new ForbiddenException(
        'You can only review trades you were involved in',
      );
    }

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: { tradeId, reviewerId: userId },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this trade');
    }

    // Determine who is being reviewed
    const reviewedTraderId =
      userId === trade.traderOfferingId
        ? trade.traderReceivingId
        : trade.traderOfferingId;

    const review = await this.prisma.review.create({
      data: {
        tradeId,
        reviewerId: userId,
        reviewedTraderId,
        rating,
        description,
        wouldTradeAgain,
      },
    });

    return new ReviewResponseDto(review);
  }

  async getTradeReviews(tradeId: number): Promise<ReviewResponseDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { tradeId },
      include: {
        reviewer: true,
        reviewedTrader: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => new ReviewResponseDto(review));
  }

  // Rating Management
  async createTradeRating(
    userId: number,
    createRatingDto: CreateTradeRatingDto,
  ): Promise<TradeRatingResponseDto> {
    const {
      tradeId,
      communicationRating,
      itemConditionRating,
      shippingRating,
      overallRating,
      feedback,
      wouldTradeAgain,
    } = createRatingDto;

    // Check if trade is completed
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.status !== 'COMPLETED') {
      throw new BadRequestException('You can only rate completed trades');
    }

    // Check if user was involved in the trade
    if (
      userId !== trade.traderOfferingId &&
      userId !== trade.traderReceivingId
    ) {
      throw new ForbiddenException(
        'You can only rate trades you were involved in',
      );
    }

    // Check if rating already exists
    const existingRating = await this.prisma.tradeRating.findFirst({
      where: { tradeId, raterId: userId },
    });

    if (existingRating) {
      throw new ConflictException('You have already rated this trade');
    }

    // Determine who is being rated
    const ratedTraderId =
      userId === trade.traderOfferingId
        ? trade.traderReceivingId
        : trade.traderOfferingId;

    const rating = await this.prisma.tradeRating.create({
      data: {
        tradeId,
        raterId: userId,
        ratedTraderId,
        communicationRating,
        itemConditionRating,
        shippingRating,
        overallRating,
        feedback,
        wouldTradeAgain,
      },
    });

    // Update trader's average rating
    await this.updateTraderRating(ratedTraderId);

    return new TradeRatingResponseDto(rating);
  }

  async getTradeRatings(tradeId: number): Promise<TradeRatingResponseDto[]> {
    const ratings = await this.prisma.tradeRating.findMany({
      where: { tradeId },
      include: {
        rater: true,
        ratedTrader: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ratings.map((rating) => new TradeRatingResponseDto(rating));
  }

  private async updateTraderRating(traderId: number): Promise<void> {
    const ratings = await this.prisma.tradeRating.findMany({
      where: { ratedTraderId: traderId },
    });

    if (ratings.length > 0) {
      const avgRating =
        ratings.reduce((sum, rating) => sum + rating.overallRating, 0) /
        ratings.length;
      const roundedRating = Math.round(avgRating * 100) / 100;

      await this.prisma.userProfile.updateMany({
        where: { userId: traderId },
        data: { tradingRating: roundedRating },
      });

      // Recalculate tier
      await this.calculateTraderTier(traderId);
    }
  }

  private async calculateTraderTier(traderId: number): Promise<void> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: traderId },
    });

    if (!profile) return;

    let tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' = 'BRONZE';
    if (profile.totalTrades >= 100 && Number(profile.tradingRating) >= 4.5) {
      tier = 'PLATINUM';
    } else if (
      profile.totalTrades >= 50 &&
      Number(profile.tradingRating) >= 4.0
    ) {
      tier = 'GOLD';
    } else if (
      profile.totalTrades >= 20 &&
      Number(profile.tradingRating) >= 3.5
    ) {
      tier = 'SILVER';
    }

    await this.prisma.userProfile.update({
      where: { id: profile.id },
      data: { traderTier: tier },
    });
  }
}
