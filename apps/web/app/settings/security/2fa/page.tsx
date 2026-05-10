'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { FormField } from '@/components/auth/form-field';
import { BrandMark } from '@/components/shared/brand-mark';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/lib/store/auth-store';

type TwoFactorSetup = Awaited<ReturnType<typeof authClient.generateTwoFactor>>;

export default function TwoFactorSecurityPage() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setupToken = useAuthStore((state) => state.setupToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setSetupToken = useAuthStore((state) => state.setSetupToken);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [flowCompleted, setFlowCompleted] = useState(false);

  const canUseSetupToken = Boolean(setupToken);
  const isAuthenticated = status === 'authenticated';
  const isChecking = status === 'idle' || status === 'checking';

  useEffect(() => {
    if (!flowCompleted && !isChecking && !isAuthenticated && !canUseSetupToken) {
      router.replace('/login');
    }
  }, [canUseSetupToken, flowCompleted, isAuthenticated, isChecking, router]);

  async function handleGenerate(): Promise<void> {
    setError(null);
    setMessage(null);
    setIsGenerating(true);

    try {
      const result = await authClient.generateTwoFactor(setupToken ?? undefined);
      setSetup(result);
      setBackupCodes([]);
    } catch {
      setError('Could not start two-factor setup.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsVerifying(true);

    try {
      const result = await authClient.verifyTwoFactor(verificationCode, setupToken ?? undefined);
      setBackupCodes(result.backupCodes);
      setSetup(null);
      setVerificationCode('');
      setSetupToken(null);
      setFlowCompleted(true);
      clearAuth();
      setMessage('Two-factor authentication is enabled. Sign in again to continue.');
    } catch {
      setError('Invalid authentication code.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleDisable(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsDisabling(true);

    try {
      await authClient.disableTwoFactor(disablePassword, disableCode);
      setDisablePassword('');
      setDisableCode('');
      setFlowCompleted(true);
      clearAuth();
      setMessage('Two-factor authentication is disabled. Sign in again to continue.');
    } catch {
      setError('Could not disable two-factor authentication.');
    } finally {
      setIsDisabling(false);
    }
  }

  if (isChecking && !canUseSetupToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </main>
    );
  }

  if (!flowCompleted && !isAuthenticated && !canUseSetupToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12">
      <div className="space-y-8">
        <div className="space-y-4">
          <BrandMark />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">
              Security settings
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Manage two-factor authentication and provider connections.
            </p>
            {user ? <p className="text-sm text-muted-foreground">{user.email}</p> : null}
          </div>
        </div>

        {message ? (
          <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            {message}{' '}
            <Link
              className="font-medium text-foreground underline-offset-4 hover:underline"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        ) : null}

        {backupCodes.length > 0 ? (
          <section className="space-y-4 rounded-md border border-border p-5">
            <div className="space-y-1">
              <h2 className="text-lg font-medium text-foreground">Backup codes</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Save these codes now. They will not be shown again.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {backupCodes.map((backupCode) => (
                <code
                  key={backupCode}
                  className="rounded-md bg-muted px-3 py-2 text-center text-sm text-foreground"
                >
                  {backupCode}
                </code>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4 rounded-md border border-border p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-foreground">Set up authenticator app</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Scan the QR code with an authenticator app, then enter the generated code.
            </p>
          </div>

          {!setup ? (
            <Button type="button" onClick={handleGenerate} disabled={isGenerating || flowCompleted}>
              {isGenerating ? 'Starting setup...' : 'Start setup'}
            </Button>
          ) : (
            <div className="space-y-5">
              <Image
                className="h-48 w-48 rounded-md border border-border"
                src={setup.qrCode}
                alt="Two-factor authentication QR code"
                width={192}
                height={192}
                unoptimized
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Manual entry key</p>
                <code className="block break-all rounded-md bg-muted px-3 py-2 text-sm text-foreground">
                  {setup.manualEntryKey}
                </code>
              </div>
              <form className="space-y-4" onSubmit={handleVerify}>
                <FormField
                  id="verification-code"
                  label="Authentication code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  required
                  disabled={isVerifying}
                />
                <Button type="submit" disabled={isVerifying}>
                  {isVerifying ? 'Verifying...' : 'Enable two-factor authentication'}
                </Button>
              </form>
            </div>
          )}
        </section>

        {isAuthenticated ? (
          <>
            <section className="space-y-4 rounded-md border border-border p-5">
              <div className="space-y-1">
                <h2 className="text-lg font-medium text-foreground">Provider connections</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Provider linking will be enabled after the frontend has an authenticated redirect
                  start flow.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Google and Microsoft linking are coming soon.
              </p>
            </section>

            <section className="space-y-4 rounded-md border border-border p-5">
              <div className="space-y-1">
                <h2 className="text-lg font-medium text-foreground">
                  Disable two-factor authentication
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Confirm your password and a current authenticator or backup code.
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleDisable}>
                <FormField
                  id="disable-password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(event) => setDisablePassword(event.target.value)}
                  required
                  disabled={isDisabling || flowCompleted}
                />
                <FormField
                  id="disable-code"
                  label="Authentication or backup code"
                  value={disableCode}
                  onChange={(event) => setDisableCode(event.target.value)}
                  required
                  disabled={isDisabling || flowCompleted}
                />
                <Button type="submit" variant="secondary" disabled={isDisabling || flowCompleted}>
                  {isDisabling ? 'Disabling...' : 'Disable two-factor authentication'}
                </Button>
              </form>
            </section>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </main>
  );
}
