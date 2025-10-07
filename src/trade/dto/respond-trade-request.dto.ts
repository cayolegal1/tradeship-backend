import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondTradeRequestDto {
  @ApiProperty({
    description: 'Whether to accept or decline the trade request',
    example: true,
  })
  @IsBoolean()
  accept: boolean;

  @ApiPropertyOptional({
    description: 'Message to include with the response',
    example: 'Great! I accept your trade offer. When can we arrange shipping?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
