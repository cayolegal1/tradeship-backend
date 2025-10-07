import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'Hi! I would love to trade my vintage guitar for your camera. What do you think?',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({
    description: 'ID of the message this is replying to',
    example: 123,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  replyToId?: number;
}
