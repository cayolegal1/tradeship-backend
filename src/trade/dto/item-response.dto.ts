import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class InterestResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional()
  @Expose()
  description?: string;

  @ApiProperty()
  @Expose()
  color: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<InterestResponseDto>) {
    Object.assign(this, partial);
  }
}

export class ItemImageResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  url: string;

  @ApiProperty()
  @Expose()
  originalName: string;

  @ApiPropertyOptional()
  @Expose()
  mimeType?: string;

  @ApiPropertyOptional()
  @Expose()
  fileSize?: number;

  @ApiProperty()
  @Expose()
  isPrimary: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<ItemImageResponseDto>) {
    Object.assign(this, partial);
  }
}

export class ItemFileResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  file: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  fileType: string;

  @ApiPropertyOptional()
  @Expose()
  fileSize?: number;

  @ApiPropertyOptional()
  @Expose()
  mimeType?: string;

  @ApiPropertyOptional()
  @Expose()
  description?: string;

  @ApiProperty()
  @Expose()
  isPublic: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  fileSizeDisplay: string;

  @ApiProperty()
  @Expose()
  isImage: boolean;

  @ApiPropertyOptional()
  @Expose()
  fileUrl?: string;

  constructor(partial: Partial<ItemFileResponseDto>) {
    Object.assign(this, partial);
    this.fileSizeDisplay = this.getFileSizeDisplay();
    this.isImage =
      this.fileType === 'IMAGE' ||
      (this.mimeType && this.mimeType.startsWith('image/'));
  }

  private getFileSizeDisplay(): string {
    if (!this.fileSize) return 'Unknown size';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.fileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export class ShippingDetailsResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  shippingWeight: number;

  @ApiProperty()
  @Expose()
  length: number;

  @ApiProperty()
  @Expose()
  width: number;

  @ApiProperty()
  @Expose()
  height: number;

  @ApiProperty()
  @Expose()
  dimensionsDisplay: string;

  @ApiProperty()
  @Expose()
  volumeCubicInches: number;

  @ApiProperty()
  @Expose()
  shippingCostEstimate: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<ShippingDetailsResponseDto>) {
    Object.assign(this, partial);
    this.dimensionsDisplay = `${this.length} x ${this.width} x ${this.height} inches`;
    this.volumeCubicInches = this.length * this.width * this.height;
    this.shippingCostEstimate = this.calculateShippingCost();
  }

  private calculateShippingCost(): number {
    const weightCost = this.shippingWeight * 0.5;
    const volumeCost = this.volumeCubicInches * 0.1;
    return Math.round((weightCost + volumeCost) * 100) / 100;
  }
}

export class ItemResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  price: number;

  @ApiProperty()
  @Expose()
  ownerId: number;

  @ApiProperty()
  @Expose()
  isAvailableForTrade: boolean;

  @ApiPropertyOptional()
  @Expose()
  tradePreferences?: string;

  @ApiPropertyOptional()
  @Expose()
  minimumTradeValue?: number;

  @ApiProperty()
  @Expose()
  acceptsCashOffers: boolean;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  @Type(() => InterestResponseDto)
  interests: InterestResponseDto[];

  @ApiProperty()
  @Expose()
  @Type(() => ItemImageResponseDto)
  images: ItemImageResponseDto[];

  @ApiProperty()
  @Expose()
  @Type(() => ItemFileResponseDto)
  files: ItemFileResponseDto[];

  @ApiPropertyOptional()
  @Expose()
  @Type(() => ShippingDetailsResponseDto)
  shippingDetails?: ShippingDetailsResponseDto;

  @ApiProperty()
  @Expose()
  isTradeable: boolean;

  constructor(partial: Partial<ItemResponseDto>) {
    Object.assign(this, partial);
    this.isTradeable = this.isActive && this.isAvailableForTrade;
  }
}
