import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateItemDto } from '../dto/create-item.dto';
import { ItemResponseDto, InterestResponseDto } from '../dto/item-response.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { GetItemsDto } from '../dto/get-items.dto';
import { TradeHelpers } from '../helpers/trade.helpers';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async prepareCreateItemDto(raw: Record<string, any>): Promise<CreateItemDto> {
    const dto = plainToInstance(CreateItemDto, raw);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const errorMessages = errors
        .map((error: ValidationError) =>
          Object.values(error.constraints || {}).join(', '),
        )
        .join('; ');
      throw new BadRequestException(`Validation failed: ${errorMessages}`);
    }

    return dto;
  }

  async getInterests(): Promise<InterestResponseDto[]> {
    const interests = await this.prisma.interest.findMany({
      orderBy: { name: 'asc' },
    });

    return interests.map((interest) => new InterestResponseDto(interest));
  }

  async createInterest(name: string): Promise<InterestResponseDto> {
    const interest = await this.prisma.interest.create({
      data: { name },
    });

    return new InterestResponseDto(interest);
  }

  async createItem(
    userId: number,
    createItemDto: CreateItemDto,
    images?: Express.Multer.File[],
  ): Promise<ItemResponseDto> {
    const {
      name,
      description,
      price,
      interests: interestIds,
      tradePreferences,
      minimumTradeValue,
      acceptsCashOffers,
    } = createItemDto;

    // Validate interests exist if provided
    if (interestIds && interestIds.length > 0) {
      const interests = await this.prisma.interest.findMany({
        where: { id: { in: interestIds } },
      });

      if (interests.length !== interestIds.length) {
        throw new BadRequestException('One or more interests are invalid');
      }
    }

    // Create item
    const item = await this.prisma.item.create({
      data: {
        name,
        description,
        price,
        ownerId: userId,
        tradePreferences,
        minimumTradeValue,
        acceptsCashOffers,
        interests:
          interestIds && interestIds.length > 0
            ? {
                connect: interestIds.map((id) => ({ id })),
              }
            : undefined,
      },
      include: {
        owner: {
          include: {
            profile: true,
          },
        },
        interests: true,
        images: true,
      },
    });

    // Handle image uploads if provided
    if (images && images.length > 0) {
      // This would be handled by FileService in a real implementation
      this.logger.log(`Processing ${images.length} images for item ${item.id}`);
    }

    return new ItemResponseDto({
      ...item,
      price: Number(item.price),
      minimumTradeValue: item.minimumTradeValue
        ? Number(item.minimumTradeValue)
        : undefined,
    });
  }

  async getItems(
    getItemsDto: GetItemsDto,
    userId?: number,
    ownerId?: number,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    const { page, limit, skip, search, category, trade_type, order_by } =
      getItemsDto;

    const where = TradeHelpers.buildItemWhere({
      search,
      category,
      trade_type,
      userId,
      ownerId,
    });

    const orderBy = TradeHelpers.buildItemOrderBy(order_by);

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          owner: {
            include: {
              profile: true,
            },
          },
          interests: true,
          images: {
            orderBy: { isPrimary: 'desc' },
          },
        },
      }),
      this.prisma.item.count({ where }),
    ]);

    const itemDtos = items.map(
      (item) =>
        new ItemResponseDto({
          ...item,
          price: Number(item.price),
          minimumTradeValue: item.minimumTradeValue
            ? Number(item.minimumTradeValue)
            : undefined,
        }),
    );
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
        owner: {
          include: {
            profile: true,
          },
        },
        interests: true,
        images: {
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return new ItemResponseDto({
      ...item,
      price: Number(item.price),
      minimumTradeValue: item.minimumTradeValue
        ? Number(item.minimumTradeValue)
        : undefined,
    });
  }

  async getUserItems(
    userId: number,
    getItemsDto: GetItemsDto,
  ): Promise<PaginatedResponseDto<ItemResponseDto>> {
    return this.getItems(getItemsDto, userId, userId);
  }

  async updateItem(
    itemId: number,
    userId: number,
    updateData: Partial<CreateItemDto>,
    images?: Express.Multer.File[],
  ): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.ownerId !== userId) {
      throw new ForbiddenException('You can only update your own items');
    }

    const { interests: interestIds, ...otherData } = updateData;

    const updatePayload: any = { ...otherData };

    if (interestIds) {
      // Validate interests exist
      const interests = await this.prisma.interest.findMany({
        where: { id: { in: interestIds } },
      });

      if (interests.length !== interestIds.length) {
        throw new BadRequestException('One or more interests are invalid');
      }

      updatePayload.interests = {
        set: interestIds.map((id) => ({ id })),
      };
    }

    const updatedItem = await this.prisma.item.update({
      where: { id: itemId },
      data: updatePayload,
      include: {
        owner: {
          include: {
            profile: true,
          },
        },
        interests: true,
        images: {
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    // Handle image updates if provided
    if (images && images.length > 0) {
      this.logger.log(
        `Processing ${images.length} updated images for item ${itemId}`,
      );
    }

    return new ItemResponseDto({
      ...updatedItem,
      price: Number(updatedItem.price),
      minimumTradeValue: updatedItem.minimumTradeValue
        ? Number(updatedItem.minimumTradeValue)
        : undefined,
    });
  }

  async deleteItem(
    itemId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own items');
    }

    await this.prisma.item.delete({
      where: { id: itemId },
    });

    return { message: 'Item deleted successfully' };
  }
}
