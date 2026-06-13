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
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.activeRole,
    };
  }
}
