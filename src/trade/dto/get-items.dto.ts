import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class GetItemsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter items by search keyword',
    example: '',
  })
  @IsOptional()
  @IsString()
  search?: string = '';

  @ApiPropertyOptional({
    description: 'Filter items by category ID',
    example: 0,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter items by trade type ID',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trade_type?: number = 0;

  @ApiPropertyOptional({
    description: 'Order items by type (1 = newest, 2 = oldest, etc.)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order_by?: number = 1;
}
