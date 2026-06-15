import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
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
    // Requery db to see if the user still exist in the db or not
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
