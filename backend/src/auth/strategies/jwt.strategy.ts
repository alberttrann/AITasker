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
  activeRole:              string;
  clientSubtype:           string | null;
  isActive:                boolean;
  subscriptionClientTier:  string;
  subscriptionExpertTier:  string;
  subClientExpiresAt:      Date | null;              
  subExpertExpiresAt:      Date | null;               
  selfTechnical:           boolean;                   
  selfTechnicalProjects:   Array<{ sessionId: string; override: boolean }>; 
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
      secretOrKey:
        configService.get<string>('jwt.secret') ??
        process.env.JWT_SECRET ??
        'changeme-set-JWT_SECRET-in-env',
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return {
      id:                     user.id,
      email:                  user.email,
      activeRole:             user.activeRole,
      clientSubtype:          user.clientSubtype ?? null,
      isActive:               user.isActive,
      subscriptionClientTier: user.subscriptionClientTier,
      subscriptionExpertTier: user.subscriptionExpertTier,
      subClientExpiresAt:     user.subClientExpiresAt ?? null,
      subExpertExpiresAt:     user.subExpertExpiresAt ?? null,
      selfTechnical:          user.selfTechnical ?? false,
      selfTechnicalProjects:  (user.selfTechnicalProjects as any) ?? [],
    };
  }
}