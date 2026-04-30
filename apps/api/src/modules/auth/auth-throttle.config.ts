const AUTH_THROTTLE_TTL_MS = 15 * 60 * 1000;

export const AUTH_THROTTLE_LIMITS = {
  default: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  login: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  register: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  refresh: {
    limit: 30,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  forgotPassword: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  resetPassword: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  changePassword: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
  twoFactorValidate: {
    limit: 10,
    ttl: AUTH_THROTTLE_TTL_MS,
  },
} as const;
