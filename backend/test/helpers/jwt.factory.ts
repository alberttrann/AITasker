import * as jwt from 'jsonwebtoken';

export class JwtFactory {
  static createToken(payload: {
    sub: string;
    active_role: string;
    client_subtype?: string | null;
    roles?: string[];
  }): string {
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';
    return jwt.sign(payload, secret, { expiresIn: '15m' });
  }
}