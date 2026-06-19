import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService }   from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';

// Shape of req.user after validate() — available via @CurrentUser() in any controller.
// Never includes passwordHash.
export interface AuthUser {
  id:                      string;
  email:                   string;
  activeRole:              string;   // 'CLIENT' | 'EXPERT' | 'ADMIN'
  clientSubtype:           string | null;  // 'CEO' | 'TECH_TEAM' | null
  isActive:                boolean;
  subscriptionClientTier:  string;  // 'free' | 'pro'
  subscriptionExpertTier:  string;
}
 
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Read secret from ConfigService so it works in both app and test contexts.
      secretOrKey:
        configService.get<string>('jwt.secret') ??
        process.env.JWT_SECRET ??
        'changeme-set-JWT_SECRET-in-env',
    });
  }
 
  // validate() is called by Passport after the JWT signature is verified.
  // Its return value becomes req.user — available via @CurrentUser() in controllers.
  // Keeping the DB re-query is intentional:
  //   - Immediately blocks deactivated accounts even if their token hasn't expired.
  //   - Ensures the user still exists (handles deleted accounts).
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
 
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
 
    // Return a clean mapped object — passwordHash must NEVER appear on req.user.
    return {
      id:                     user.id,
      email:                  user.email,
      activeRole:             user.activeRole,
      clientSubtype:          user.clientSubtype ?? null,
      isActive:               user.isActive,
      subscriptionClientTier: user.subscriptionClientTier,
      subscriptionExpertTier: user.subscriptionExpertTier,
    };
  }
}