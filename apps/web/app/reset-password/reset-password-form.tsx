'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';
import { PasswordStrength, evaluatePasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/lib/store/auth-store';

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPasswordOverByteLimit = evaluatePasswordStrength(newPassword).isOverByteLimit;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('The reset link is invalid or expired.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (isPasswordOverByteLimit) {
      setError('Password must be at most 72 UTF-8 bytes.');
      return;
    }

    setIsSubmitting(true);

    try {
      await authClient.resetPassword(token, newPassword);
      clearAuth();
      setCompleted(true);
      setNewPassword('');
      setConfirmPassword('');
      router.replace('/login?reset=success');
    } catch {
      setError(
        'Reset failed. Please check the link and make sure your password meets the requirements.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Use a strong password to secure your account."
      footer={
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          Back to sign in
        </Link>
      }
    >
      {completed ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Your password has been changed. Sign in with your new password to continue.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            disabled={isSubmitting || !token}
          />
          <PasswordStrength password={newPassword} />
          <FormField
            id="confirm-password"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={isSubmitting || !token}
          />
          {!token ? (
            <p className="text-sm text-red-600">The reset link is invalid or expired.</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            className="w-full"
            type="submit"
            disabled={isSubmitting || !token || isPasswordOverByteLimit}
          >
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
