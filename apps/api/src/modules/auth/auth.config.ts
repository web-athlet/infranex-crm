function requireEnv(name: 'JWT_SECRET'): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured`);
  }

  return value;
}

export function getJwtAccessSecret(): string {
  const accessSecret = requireEnv('JWT_SECRET');
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();

  if (refreshSecret && refreshSecret === accessSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  return accessSecret;
}
