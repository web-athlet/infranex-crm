'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await authClient.forgotPassword(email);
      setSubmitted(true);
    } catch {
      setError('Could not submit the request. Try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Reset password"
      description="Request a password reset link for your account."
      footer={
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          Back to sign in
        </Link>
      }
    >
      {submitted ? (
        <p className="text-sm leading-6 text-muted-foreground">
          If an account exists for that email, password reset instructions will be sent.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
