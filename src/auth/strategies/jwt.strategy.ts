import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IJwtPayload } from '../../common/interfaces/user.interface';
import { User } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => req?.cookies?.jwt || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: IJwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    let user: User | undefined = undefined;

    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          profile: {
            include: {
              interests: true,
            },
          },
        },
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
