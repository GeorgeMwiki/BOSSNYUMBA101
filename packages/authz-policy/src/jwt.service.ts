import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  email?: string;
  roles: string[];
  permissions?: string[];
  tenantId?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
  issuer?: string;
  audience?: string;
}

export class JwtService {
  private readonly config: JwtConfig;

  constructor(config: Partial<JwtConfig> = {}) {
    this.config = {
      accessTokenSecret: config.accessTokenSecret || process.env.JWT_ACCESS_SECRET || 'access-secret-change-me',
      refreshTokenSecret: config.refreshTokenSecret || process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
      accessTokenExpiresIn: config.accessTokenExpiresIn || '15m',
      refreshTokenExpiresIn: config.refreshTokenExpiresIn || '7d',
      issuer: config.issuer || 'bossnyumba',
      audience: config.audience || 'bossnyumba-api',
    };
  }

  /**
   * Sign an access token
   */
  signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: this.config.accessTokenExpiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: payload.sub,
    };

    return jwt.sign(
      {
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
        tenantId: payload.tenantId,
      },
      this.config.accessTokenSecret,
      options
    );
  }

  /**
   * Sign a refresh token
   */
  signRefreshToken(payload: Pick<TokenPayload, 'sub'>): string {
    const options: SignOptions = {
      expiresIn: this.config.refreshTokenExpiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: payload.sub,
    };

    return jwt.sign({}, this.config.refreshTokenSecret, options);
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(payload: Omit<TokenPayload, 'iat' | 'exp'>): TokenPair {
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken({ sub: payload.sub });

    const accessDecoded = jwt.decode(accessToken) as JwtPayload;
    const refreshDecoded = jwt.decode(refreshToken) as JwtPayload;

    return {
      accessToken,
      refreshToken,
      expiresIn: accessDecoded.exp! - Math.floor(Date.now() / 1000),
      refreshExpiresIn: refreshDecoded.exp! - Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): TokenPayload {
    const options: VerifyOptions = {
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    const decoded = jwt.verify(token, this.config.accessTokenSecret, options) as JwtPayload;

    return {
      sub: decoded.sub!,
      email: decoded.email,
      roles: decoded.roles || [],
      permissions: decoded.permissions,
      tenantId: decoded.tenantId,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  }

  /**
   * Verify a refresh token
   */
  verifyRefreshToken(token: string): { sub: string; iat?: number; exp?: number } {
    const options: VerifyOptions = {
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    const decoded = jwt.verify(token, this.config.refreshTokenSecret, options) as JwtPayload;

    return {
      sub: decoded.sub!,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  }

  /**
   * Refresh tokens - verify refresh token and generate new pair
   */
  async refreshTokens(
    refreshToken: string,
    getUserPayload: (userId: string) => Promise<Omit<TokenPayload, 'iat' | 'exp'>>
  ): Promise<TokenPair> {
    const { sub } = this.verifyRefreshToken(refreshToken);
    const userPayload = await getUserPayload(sub);
    return this.generateTokenPair(userPayload);
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    return jwt.decode(token) as JwtPayload | null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    return decoded.exp < Math.floor(Date.now() / 1000);
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTokenTTL(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return 0;
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  }
}

export const jwtService = new JwtService();
