import { api } from '@/lib/api';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || !value) {
    throw new Error('Unexpected auth response');
  }

  return value;
}

function parseAuthUser(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Unexpected auth user response');
  }

  const name = value.name;

  return {
    id: readString(value, 'id'),
    email: readString(value, 'email'),
    name: typeof name === 'string' || name === null ? name : null,
  };
}

function parseAccessToken(value: unknown): string {
  if (!isRecord(value)) {
    throw new Error('Unexpected access token response');
  }

  return readString(value, 'accessToken');
}

function parseLoginResult(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Unexpected login response');
  }

  if (typeof value.accessToken === 'string' && isRecord(value.user)) {
    return {
      kind: 'authenticated',
      accessToken: value.accessToken,
      user: parseAuthUser(value.user),
    } as const;
  }

  if (value.requiresTwoFactor === true) {
    return {
      kind: 'twoFactor',
      challengeToken: readString(value, 'challengeToken'),
    } as const;
  }

  if (value.requiresTwoFactorSetup === true) {
    return {
      kind: 'twoFactorSetup',
      setupToken: readString(value, 'setupToken'),
    } as const;
  }

  throw new Error('Unexpected login response');
}

function parseTwoFactorSetup(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Unexpected two-factor setup response');
  }

  return {
    qrCode: readString(value, 'qrCode'),
    manualEntryKey: readString(value, 'manualEntryKey'),
  };
}

function parseTwoFactorVerify(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.backupCodes)) {
    throw new Error('Unexpected two-factor verification response');
  }

  if (!value.backupCodes.every((code): code is string => typeof code === 'string')) {
    throw new Error('Unexpected two-factor verification response');
  }

  return {
    backupCodes: value.backupCodes,
  };
}

async function postUnknown(path: string, body?: JsonRecord): Promise<unknown> {
  const response = await api.post<unknown>(path, body);
  return response.data;
}

async function getUnknown(path: string, accessToken?: string): Promise<unknown> {
  const response = await api.get<unknown>(path, {
    ...(accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : {}),
  });
  return response.data;
}

export const authClient = {
  async register(name: string, email: string, password: string) {
    return parseAuthUser(await postUnknown('/auth/register', { name, email, password }));
  },

  async login(email: string, password: string) {
    return parseLoginResult(await postUnknown('/auth/login', { email, password }));
  },

  async refresh(): Promise<string> {
    return parseAccessToken(await postUnknown('/auth/refresh'));
  },

  async logout(): Promise<void> {
    await postUnknown('/auth/logout');
  },

  async logoutAll(): Promise<void> {
    await postUnknown('/auth/logout-all');
  },

  async me() {
    return parseAuthUser(await getUnknown('/auth/me'));
  },

  async meWithAccessToken(accessToken: string) {
    return parseAuthUser(await getUnknown('/auth/me', accessToken));
  },

  async forgotPassword(email: string): Promise<void> {
    await postUnknown('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await postUnknown('/auth/reset-password', { token, newPassword });
  },

  async generateTwoFactor(setupToken?: string) {
    return parseTwoFactorSetup(
      await postUnknown('/auth/2fa/generate', setupToken ? { setupToken } : {}),
    );
  },

  async verifyTwoFactor(code: string, setupToken?: string) {
    return parseTwoFactorVerify(
      await postUnknown('/auth/2fa/verify', {
        ...(setupToken ? { setupToken } : {}),
        code,
      }),
    );
  },

  async validateTwoFactor(challengeToken: string, code: string): Promise<string> {
    return parseAccessToken(await postUnknown('/auth/2fa/validate', { challengeToken, code }));
  },

  async disableTwoFactor(password: string, code: string): Promise<void> {
    await postUnknown('/auth/2fa/disable', { password, code });
  },
};
