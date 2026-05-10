'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';
import { PasswordStrength, evaluatePasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const isPasswordOverByteLimit = evaluatePasswordStrength(password).isOverByteLimit;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (isPasswordOverByteLimit) {
      setError('Password must be at most 72 UTF-8 bytes.');
      return;
    }

    setIsSubmitting(true);

    try {
      await authClient.register(name, email, password);
      setRegistered(true);
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Could not create the account. Check the details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      description="Set up your Infranex CRM user account."
      footer={
        <>
          Already registered?{' '}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </>
      }
    >
      {registered ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Your account was created. Sign in with your email and password to continue.
          </p>
          <Button
            className="w-full"
            type="button"
            onClick={() => (window.location.href = '/login')}
          >
            Go to sign in
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField
            id="name"
            label="Name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isSubmitting}
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />
          <PasswordStrength password={password} />
          <FormField
            id="confirm-password"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            className="w-full"
            type="submit"
            disabled={isSubmitting || isPasswordOverByteLimit}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
