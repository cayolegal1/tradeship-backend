import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  ParseIntPipe,
  ParseArrayPipe,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';

// services
import { AuthService } from './auth.service';

// decorators
import { CurrentUser } from './decorators/current-user.decorator';

// guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// dtos
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  // UserResponseDto,
  UserWithProfileResponseDto,
  UserProfileResponseDto,
  AuthResponseDto,
} from './dto/user-response.dto';
import { SuccessResponseDto } from '../common/dto/response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiBody({ type: RegisterDto })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.register(registerDto, response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto, response);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved',
    type: UserWithProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(
    @CurrentUser() user: any,
  ): Promise<UserWithProfileResponseDto> {
    return this.authService.getCurrentUser(user.id);
  }

  @Put('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user information' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserWithProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiBody({ type: UpdateUserDto })
  async updateUser(
    @CurrentUser() user: any,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserWithProfileResponseDto> {
    return this.authService.updateUser(user.id, updateUserDto);
  }

  @Patch('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Partially update current user information' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserWithProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: UpdateUserDto })
  async partialUpdateUser(
    @CurrentUser() user: any,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserWithProfileResponseDto> {
    return this.authService.updateUser(user.id, updateUserDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: SuccessResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.authService.changePassword(
      user.id,
      changePasswordDto,
    );
    return new SuccessResponseDto(result.message);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: any): Promise<UserProfileResponseDto> {
    return this.authService.getUserProfile(user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.authService.updateProfile(user.id, updateProfileDto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Partially update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: UpdateProfileDto })
  async partialUpdateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.authService.updateProfile(user.id, updateProfileDto);
  }

  @Get('profile/user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile by user ID' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved',
    type: UserWithProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserProfile(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserWithProfileResponseDto> {
    return this.authService.getUserById(userId);
  }

  @Get('interests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available interests' })
  @ApiResponse({ status: 200, description: 'Interests retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInterests(): Promise<any[]> {
    return this.authService.getInterests();
  }

  @Post('interests/add')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add interest to user profile' })
  @ApiResponse({ status: 200, description: 'Interest added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({
    schema: { type: 'object', properties: { interestId: { type: 'number' } } },
  })
  async addInterest(
    @CurrentUser() user: any,
    @Body('interestId', ParseIntPipe) interestId: number,
  ): Promise<{ message: string; interests: string[] }> {
    return this.authService.addInterest(user.id, interestId);
  }

  @Post('interests/remove')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove interest from user profile' })
  @ApiResponse({ status: 200, description: 'Interest removed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({
    schema: { type: 'object', properties: { interestId: { type: 'number' } } },
  })
  async removeInterest(
    @CurrentUser() user: any,
    @Body('interestId', ParseIntPipe) interestId: number,
  ): Promise<{ message: string; interests: string[] }> {
    return this.authService.removeInterest(user.id, interestId);
  }

  @Put('interests/bulk-update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update user interests' })
  @ApiResponse({ status: 200, description: 'Interests updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { interestIds: { type: 'array', items: { type: 'number' } } },
    },
  })
  async bulkUpdateInterests(
    @CurrentUser() user: any,
    @Body('interestIds', new ParseArrayPipe({ items: Number, optional: false }))
    interestIds: number[],
  ): Promise<{ message: string; interests: string[] }> {
    return this.authService.bulkUpdateInterests(user.id, interestIds);
  }

  @Get('health')
  @ApiOperation({ summary: 'Auth service health check' })
  @ApiResponse({ status: 200, description: 'Auth service is healthy' })
  async healthCheck(): Promise<SuccessResponseDto> {
    return new SuccessResponseDto('Auth API is running');
  }
}
