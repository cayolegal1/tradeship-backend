import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  username: string;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty()
  @Expose()
  fullName: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  agreesToTerms: boolean;

  @ApiPropertyOptional()
  @Expose()
  termsAgreedAt?: Date;

  @ApiProperty()
  @Expose()
  termsVersion: string;

  @ApiProperty()
  @Expose()
  profileCompleted: boolean;

  @ApiProperty()
  @Expose()
  dateJoined: Date;

  @ApiPropertyOptional()
  @Expose()
  lastLogin?: Date;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
    this.fullName = `${this.firstName} ${this.lastName}`.trim();
  }
}

export class UserProfileResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiPropertyOptional()
  @Expose()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @Expose()
  dateOfBirth?: Date;

  @ApiPropertyOptional()
  @Expose()
  bio?: string;

  @ApiPropertyOptional()
  @Expose()
  avatar?: string;

  @ApiProperty()
  @Expose()
  emailNotifications: boolean;

  @ApiProperty()
  @Expose()
  marketingEmails: boolean;

  @ApiPropertyOptional()
  @Expose()
  city?: string;

  @ApiPropertyOptional()
  @Expose()
  state?: string;

  @ApiProperty()
  @Expose()
  country: string;

  @ApiProperty()
  @Expose()
  traderSince: Date;

  @ApiProperty()
  @Expose()
  tradingRating: number;

  @ApiProperty()
  @Expose()
  totalTrades: number;

  @ApiProperty()
  @Expose()
  successfulTrades: number;

  @ApiProperty()
  @Expose()
  isVerifiedTrader: boolean;

  @ApiProperty()
  @Expose()
  traderTier: string;

  @ApiPropertyOptional()
  @Expose()
  specialties?: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  successRate: number;

  @ApiProperty()
  @Expose()
  traderStatus: string;

  constructor(partial: Partial<UserProfileResponseDto>) {
    Object.assign(this, partial);
    this.successRate =
      this.totalTrades > 0
        ? Math.round((this.successfulTrades / this.totalTrades) * 100 * 10) / 10
        : 0;
    this.traderStatus = this.isVerifiedTrader
      ? `Verified ${this.traderTier} Trader`
      : `${this.traderTier} Trader`;
  }
}

export class UserWithProfileResponseDto extends UserResponseDto {
  @ApiPropertyOptional()
  @Expose()
  @Type(() => UserProfileResponseDto)
  profile?: UserProfileResponseDto;
}

export class AuthTokensResponseDto {
  @ApiProperty()
  @Expose()
  accessToken: string;

  @ApiProperty()
  @Expose()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  @Expose()
  @Type(() => UserWithProfileResponseDto)
  user: UserWithProfileResponseDto;

  @ApiProperty()
  @Expose()
  @Type(() => AuthTokensResponseDto)
  tokens: AuthTokensResponseDto;

  @ApiProperty()
  @Expose()
  message: string;
}
