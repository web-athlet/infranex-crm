import { authClient } from '@/lib/auth-client';

type AuthUser = Awaited<ReturnType<typeof authClient.me>>;

type BootstrapSession = {
  accessToken: string;
  user: AuthUser;
};

type RefreshLease = {
  ownerId: string;
  expiresAt: number;
};

type LockManagerLike = {
  request: <Result>(name: string, callback: () => Result | Promise<Result>) => Promise<Result>;
};

type NavigatorWithLocks = Navigator & {
  locks?: LockManagerLike;
};

const REFRESH_LOCK_NAME = 'infranex-auth-refresh';
const REFRESH_LEASE_KEY = 'infranex.auth.refresh.lock';
const REFRESH_LEASE_TTL_MS = 8000;
const REFRESH_LEASE_WAIT_MS = 10000;
const REFRESH_LEASE_POLL_MS = 100;
const REFRESH_LEASE_RENEW_MS = 2000;
const BROADCAST_CHANNEL_NAME = 'infranex-auth-refresh';

let inFlightRefresh: Promise<BootstrapSession> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

type RefreshBroadcastEvent = {
  type: 'refresh-complete' | 'refresh-failed';
  occurredAt: number;
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRefreshLease(value: unknown): value is RefreshLease {
  return (
    isRecord(value) &&
    typeof value.ownerId === 'string' &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}

function createOwnerId(): string {
  if (typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readRefreshLease(): RefreshLease | null {
  try {
    const rawLease = window.localStorage.getItem(REFRESH_LEASE_KEY);

    if (!rawLease) {
      return null;
    }

    const parsedLease: unknown = JSON.parse(rawLease);
    return isRefreshLease(parsedLease) ? parsedLease : null;
  } catch {
    return null;
  }
}

async function acquireLocalStorageLease(): Promise<() => void> {
  const ownerId = createOwnerId();
  const deadline = Date.now() + REFRESH_LEASE_WAIT_MS;
  let renewalTimer: number | null = null;

  while (Date.now() < deadline) {
    const now = Date.now();
    const currentLease = readRefreshLease();

    if (!currentLease || currentLease.expiresAt <= now) {
      const nextLease: RefreshLease = {
        ownerId,
        expiresAt: now + REFRESH_LEASE_TTL_MS,
      };

      window.localStorage.setItem(REFRESH_LEASE_KEY, JSON.stringify(nextLease));

      if (readRefreshLease()?.ownerId === ownerId) {
        renewalTimer = window.setInterval(() => {
          if (readRefreshLease()?.ownerId === ownerId) {
            const renewedLease: RefreshLease = {
              ownerId,
              expiresAt: Date.now() + REFRESH_LEASE_TTL_MS,
            };
            window.localStorage.setItem(REFRESH_LEASE_KEY, JSON.stringify(renewedLease));
          }
        }, REFRESH_LEASE_RENEW_MS);

        return () => {
          if (renewalTimer !== null) {
            window.clearInterval(renewalTimer);
          }

          if (readRefreshLease()?.ownerId === ownerId) {
            window.localStorage.removeItem(REFRESH_LEASE_KEY);
          }
        };
      }
    }

    await sleep(REFRESH_LEASE_POLL_MS);
  }

  throw new Error('Auth refresh is already in progress');
}

async function withLocalStorageLease<Result>(callback: () => Promise<Result>): Promise<Result> {
  const releaseLease = await acquireLocalStorageLease();

  try {
    return await callback();
  } finally {
    releaseLease();
  }
}

async function withCrossTabRefreshLock<Result>(callback: () => Promise<Result>): Promise<Result> {
  const locks = (navigator as NavigatorWithLocks).locks;

  if (locks) {
    return locks.request(REFRESH_LOCK_NAME, callback);
  }

  return withLocalStorageLease(callback);
}

function ensureBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (broadcastChannel) {
    return broadcastChannel;
  }

  broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  return broadcastChannel;
}

function publishRefreshEvent(type: RefreshBroadcastEvent['type']): void {
  const event: RefreshBroadcastEvent = {
    type,
    occurredAt: Date.now(),
  };

  try {
    ensureBroadcastChannel()?.postMessage(event);
  } catch {
    // Cross-tab notifications are best effort; refresh serialization is handled by the lock.
  }
}

async function createBootstrapSession(): Promise<BootstrapSession> {
  const accessToken = await authClient.refresh();
  const user = await authClient.meWithAccessToken(accessToken);

  return {
    accessToken,
    user,
  };
}

async function runSerializedRefresh(): Promise<BootstrapSession> {
  try {
    const session = await withCrossTabRefreshLock(createBootstrapSession);
    publishRefreshEvent('refresh-complete');
    return session;
  } catch (error: unknown) {
    publishRefreshEvent('refresh-failed');
    throw error;
  }
}

export function refreshBootstrapSession(): Promise<BootstrapSession> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = runSerializedRefresh().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}
