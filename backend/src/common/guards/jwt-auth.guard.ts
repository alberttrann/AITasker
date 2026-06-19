import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Validates the Bearer JWT from the Authorization header using the 'jwt'
 * Passport strategy (JwtStrategy in auth/strategies/jwt.strategy.ts).
 * On success, populates req.user with the JwtStrategy.validate() return value.
 * On failure (missing/expired/invalid token), throws UnauthorizedException.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}