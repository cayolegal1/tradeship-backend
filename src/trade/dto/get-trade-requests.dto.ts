import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTradeRequestsDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by trade request status',
    example: 'PENDING',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by direction: sent or received',
    example: 'sent',
    enum: ['sent', 'received'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['sent', 'received'])
  direction?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'createdAt:desc',
    enum: ['createdAt:asc', 'createdAt:desc', 'updatedAt:asc', 'updatedAt:desc'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt:asc', 'createdAt:desc', 'updatedAt:asc', 'updatedAt:desc'])
  sortBy?: string = 'createdAt:desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
