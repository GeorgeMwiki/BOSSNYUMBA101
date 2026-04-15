import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/user-role';
import { getJwtSecret } from '../config/jwt';

// Simplified AuthContext for the API gateway
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
}

const JWT_SECRET = getJwtSecret();

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  exp: number;
  iat: number;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      (req as AuthenticatedRequest).auth = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role,
        permissions: decoded.permissions,
        propertyAccess: decoded.propertyAccess,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
          },
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;

    if (!auth) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(auth.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;

    if (!auth) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const hasPermission = permissions.every(
      (p) => auth.permissions.includes(p) || auth.role === UserRole.SUPER_ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
};

/**
 * Default access-token lifetime when no env override is supplied. Kept at 24h
 * so unrelated callers/tests that rely on the legacy long-lived JWTs continue
 * to work; the auth router itself uses ACCESS_TOKEN_TTL_SECONDS (default 900s)
 * for tokens that are paired with a refresh token.
 */
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export const generateToken = (
  payload: Omit<JWTPayload, 'exp' | 'iat'>,
  options?: { expiresInSeconds?: number }
): string => {
  const ttl = options?.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ttl });
};
