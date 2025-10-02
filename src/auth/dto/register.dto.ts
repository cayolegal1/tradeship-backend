import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
  Matches,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @ApiProperty({
    description: 'Password',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiProperty({
    description: 'Password confirmation',
    example: 'SecurePassword123!',
  })
  @IsString()
  passwordConfirm: string;

  @ApiProperty({
    description: 'Agreement to terms and conditions',
    example: true,
  })
  @IsBoolean()
  agreesToTerms: boolean;
}
