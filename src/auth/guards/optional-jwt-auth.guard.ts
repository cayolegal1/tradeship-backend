import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser | undefined {
    if (err || !user) {
      return undefined;
    }

    return user;
  }
}
