'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/lib/store/auth-store';

type LoginStep = 'credentials' | 'two-factor';

export default function LoginPage() {
  const router = useRouter();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setSetupToken = useAuthStore((state) => state.setSetupToken);
  const challengeToken = useAuthStore((state) => state.challengeToken);
  const setChallengeToken = useAuthStore((state) => state.setChallengeToken);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.login(email, password);

      if (result.kind === 'authenticated') {
        setAuthenticated(result.accessToken, result.user);
        router.push('/');
        return;
      }

      if (result.kind === 'twoFactor') {
        setChallengeToken(result.challengeToken);
        setPassword('');
        setCode('');
        setStep('two-factor');
        return;
      }

      if (result.kind === 'twoFactorSetup') {
        setSetupToken(result.setupToken);
        setPassword('');
        router.push('/settings/security/2fa');
      }
    } catch {
      setError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTwoFactor(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!challengeToken) {
      setError('Sign in again to continue.');
      setStep('credentials');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const accessToken = await authClient.validateTwoFactor(challengeToken, code);
      const user = await authClient.meWithAccessToken(accessToken);
      setAuthenticated(accessToken, user);
      router.push('/');
    } catch {
      useAuthStore.getState().setAccessToken(null);
      setError('Invalid authentication code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access your Infranex CRM workspace with your account credentials."
      footer={
        <>
          Need an account?{' '}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/register"
          >
            Create one
          </Link>
        </>
      }
    >
      {step === 'credentials' ? (
        <form className="space-y-4" onSubmit={handleLogin}>
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />
          <div className="flex items-center justify-between text-sm">
            <Link
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleTwoFactor}>
          <FormField
            id="code"
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            disabled={isSubmitting}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Verify code'}
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => {
              setChallengeToken(null);
              setCode('');
              setStep('credentials');
            }}
          >
            Back to sign in
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
