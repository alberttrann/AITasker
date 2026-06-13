import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Taking jwt incoming from request
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Verify signature with the secret ky
      secretOrKey: process.env.JWT_SECRET,
      // If token expired -> blocked
      ignoreExpiration: false,
      // Calling prisma service to validate user still exist in db
    });
  }

  async validate(payload: any) {
    // Consider validation
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.activeRole,
    };
  }
}
