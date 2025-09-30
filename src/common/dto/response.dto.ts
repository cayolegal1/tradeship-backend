import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto<T = any> {
  @ApiProperty()
  success: boolean = true;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  timestamp: string;

  constructor(message: string, data?: T) {
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }
}

export class ErrorResponseDto {
  @ApiProperty()
  success: boolean = false;

  @ApiProperty()
  message: string;

  @ApiProperty()
  error?: string;

  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  timestamp: string;

  constructor(message: string, statusCode: number, error?: string) {
    this.message = message;
    this.statusCode = statusCode;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }
}
