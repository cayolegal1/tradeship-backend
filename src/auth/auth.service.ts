import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  // UserResponseDto,
  UserProfileResponseDto,
  UserWithProfileResponseDto,
  AuthResponseDto,
} from './dto/user-response.dto';
import { IJwtPayload, IAuthTokens } from '../common/interfaces/user.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private convertProfileToResponseDto(profile: any): UserProfileResponseDto {
    return new UserProfileResponseDto({
      ...profile,
      tradingRating: Number(profile.tradingRating),
    });
  }

  async register(
    registerDto: RegisterDto,
    response: Response,
  ): Promise<AuthResponseDto> {
    const {
      firstName,
      lastName,
      email,
      username,
      password,
      passwordConfirm,
      agreesToTerms,
    } = registerDto;

    // Validate password confirmation
    if (password !== passwordConfirm) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or username already exists',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        username: username || firstName + lastName,
        password: hashedPassword,
        agreesToTerms,
        termsAgreedAt: agreesToTerms ? new Date() : null,
      },
      include: {
        profile: true,
      },
    });

    // Create user profile
    await this.prisma.userProfile.create({
      data: {
        userId: user.id,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Get updated user with profile
    const userWithProfile = await this.getUserWithProfile(user.id);

    // Set cookie for frontend
    response.cookie('jwt', tokens.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      priority: 'high',
    });

    return {
      user: userWithProfile,
      tokens,
      message: 'User registered successfully',
    };
  }

  async login(
    loginDto: LoginDto,
    response: Response,
  ): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Get user with profile
    const userWithProfile = await this.getUserWithProfile(user.id);

    // Set cookie for frontend
    response.cookie('jwt', tokens.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      priority: 'high',
    });

    return {
      user: userWithProfile,
      tokens,
      message: 'Login successful',
    };
  }

  async logout(response: Response) {
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      priority: 'high',
    });

    return { message: 'Logged out' };
  }

  async getCurrentUser(userId: number): Promise<UserWithProfileResponseDto> {
    return this.getUserWithProfile(userId);
  }

  async updateUser(
    userId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserWithProfileResponseDto> {
    const { email } = updateUserDto;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
      include: {
        profile: true,
      },
    });

    return this.getUserWithProfile(user.id);
  }

  async updateProfile(
    userId: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    const { interests, ...profileData } = updateProfileDto;

    // Update profile
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
      },
    });

    // Update interests if provided
    if (interests !== undefined) {
      await this.prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          interests: {
            set: interests.map((id) => ({ id })),
          },
        },
      });
    }

    // Mark profile as completed if not already
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user.profileCompleted) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { profileCompleted: true },
      });
    }

    // Get updated profile with interests
    const updatedProfile = await this.prisma.userProfile.findUnique({
      where: { id: profile.id },
      include: {
        interests: true,
      },
    });

    return this.convertProfileToResponseDto(updatedProfile);
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword, newPasswordConfirm } = changePasswordDto;

    // Validate password confirmation
    if (newPassword !== newPasswordConfirm) {
      throw new BadRequestException('New passwords do not match');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async getUserProfile(userId: number): Promise<UserProfileResponseDto> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        interests: true,
      },
    });

    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    return this.convertProfileToResponseDto(profile);
  }

  async getUserById(userId: number): Promise<UserWithProfileResponseDto> {
    return this.getUserWithProfile(userId);
  }

  async getInterests(): Promise<any[]> {
    const interests = await this.prisma.interest.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return interests;
  }

  async addInterest(
    userId: number,
    interestId: number,
  ): Promise<{ message: string; interests: string[] }> {
    // Get user profile
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: { interests: true },
    });

    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    // Check if interest exists and is active
    const interest = await this.prisma.interest.findUnique({
      where: { id: interestId },
    });

    if (!interest || !interest.isActive) {
      throw new UnauthorizedException('Interest not found or inactive');
    }

    // Add interest to profile
    await this.prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        interests: {
          connect: { id: interestId },
        },
      },
    });

    // Get updated interests list
    const updatedProfile = await this.prisma.userProfile.findUnique({
      where: { id: profile.id },
      include: { interests: true },
    });

    return {
      message: `Interest "${interest.name}" added successfully`,
      interests: updatedProfile.interests.map((i) => i.name),
    };
  }

  async removeInterest(
    userId: number,
    interestId: number,
  ): Promise<{ message: string; interests: string[] }> {
    // Get user profile
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: { interests: true },
    });

    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    // Check if interest exists
    const interest = await this.prisma.interest.findUnique({
      where: { id: interestId },
    });

    if (!interest) {
      throw new UnauthorizedException('Interest not found');
    }

    // Remove interest from profile
    await this.prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        interests: {
          disconnect: { id: interestId },
        },
      },
    });

    // Get updated interests list
    const updatedProfile = await this.prisma.userProfile.findUnique({
      where: { id: profile.id },
      include: { interests: true },
    });

    return {
      message: `Interest "${interest.name}" removed successfully`,
      interests: updatedProfile.interests.map((i) => i.name),
    };
  }

  async bulkUpdateInterests(
    userId: number,
    interestIds: number[],
  ): Promise<{ message: string; interests: string[] }> {
    // Get user profile
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    // Validate all interests exist and are active
    const interests = await this.prisma.interest.findMany({
      where: {
        id: { in: interestIds },
        isActive: true,
      },
    });

    if (interests.length !== interestIds.length) {
      throw new BadRequestException('Some interests are invalid or inactive');
    }

    // Update interests
    await this.prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        interests: {
          set: interestIds.map((id) => ({ id })),
        },
      },
    });

    // Get updated interests list
    const updatedProfile = await this.prisma.userProfile.findUnique({
      where: { id: profile.id },
      include: { interests: true },
    });

    return {
      message: 'Interests updated successfully',
      interests: updatedProfile.interests.map((i) => i.name),
    };
  }

  private async generateTokens(user: any): Promise<IAuthTokens> {
    const payload: IJwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async getUserWithProfile(
    userId: number,
  ): Promise<UserWithProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            interests: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return new UserWithProfileResponseDto(user);
  }
}
