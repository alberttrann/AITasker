import * as jwt from 'jsonwebtoken';

export interface JwtTestPayload {
  sub:            string;   // user.id
  email?:         string;
  activeRole:     string;   // 'CLIENT' | 'EXPERT' | 'ADMIN'
  clientSubtype?: string | null; // 'CEO' | 'TECH_TEAM' (only when activeRole=CLIENT)
}

export class JwtFactory {
  static readonly SECRET =
    process.env.JWT_SECRET ?? 'test-jwt-secret-not-for-production';

  // FIX [BLOCK-11]: payload now uses camelCase field names to match what
  // JwtStrategy.validate() returns to RolesGuard (user.activeRole).
  // Using snake_case (active_role) in the token means user.activeRole === undefined
  // inside RolesGuard, causing every authenticated request to return 403.
  static createToken(payload: JwtTestPayload): string {
    return jwt.sign(payload, this.SECRET, { expiresIn: '15m' });
  }

  // Convenience factories for common test personas 

  static ceoToken(userId: string): string {
    return this.createToken({
      sub:          userId,
      activeRole:   'CLIENT',
      clientSubtype: 'CEO',
    });
  }

  static techTeamToken(userId: string): string {
    return this.createToken({
      sub:          userId,
      activeRole:   'CLIENT',
      clientSubtype: 'TECH_TEAM',
    });
  }

  static expertToken(userId: string): string {
    return this.createToken({
      sub:        userId,
      activeRole: 'EXPERT',
    });
  }

  static adminToken(userId: string): string {
    return this.createToken({
      sub:        userId,
      activeRole: 'ADMIN',
    });
  }
}