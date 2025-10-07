import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsArray, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Array of user IDs to include in the conversation',
    example: [123, 456],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  participantIds: number[];

  @ApiPropertyOptional({
    description: 'Title of the conversation',
    example: 'Trade Discussion',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Description of the conversation',
    example: 'Discussion about trading vintage guitar for camera',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the conversation is private',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean = true;

  @ApiPropertyOptional({
    description: 'Content type for context (e.g., trade_request, item)',
    example: 'trade_request',
  })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({
    description: 'Object ID for context (e.g., trade request ID)',
    example: '123',
  })
  @IsOptional()
  @IsString()
  objectId?: string;
}
