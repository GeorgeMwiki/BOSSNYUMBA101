const NON_PROD_JWT_SECRET = 'bossnyumba-dev-jwt-secret-change-me';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required: JWT_SECRET');
  }

  return NON_PROD_JWT_SECRET;
}
