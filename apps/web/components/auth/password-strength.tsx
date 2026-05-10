import { cn } from '@/lib/utils';

type PasswordStrengthProps = {
  password: string;
};

type PasswordStrengthResult = {
  score: number;
  label: string;
  helperText: string;
  isOverByteLimit: boolean;
};

export const MAX_BCRYPT_PASSWORD_BYTES = 72;

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const byteLength = getUtf8ByteLength(password);
  const isOverByteLimit = byteLength > MAX_BCRYPT_PASSWORD_BYTES;
  const defaultHelperText =
    'Use at least 8 characters with uppercase, number, and symbol. Password must be at most 72 UTF-8 bytes.';

  if (!password) {
    return {
      score: 0,
      label: 'Enter a password',
      helperText: defaultHelperText,
      isOverByteLimit,
    };
  }

  if (isOverByteLimit) {
    return {
      score: 0,
      label: 'Too long',
      helperText: 'Password must be at most 72 UTF-8 bytes.',
      isOverByteLimit,
    };
  }

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    !isOverByteLimit,
  ];
  const score = checks.filter(Boolean).length;

  if (score <= 2) {
    return { score, label: 'Weak', helperText: defaultHelperText, isOverByteLimit };
  }

  if (score <= 4) {
    return { score, label: 'Good', helperText: defaultHelperText, isOverByteLimit };
  }

  return { score, label: 'Strong', helperText: defaultHelperText, isOverByteLimit };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = evaluatePasswordStrength(password);
  const filledSegments = password ? Math.max(1, Math.min(strength.score, 5)) : 0;

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className={cn(
              'h-1.5 rounded-full bg-muted',
              index < filledSegments && strength.score <= 2 ? 'bg-red-500' : null,
              index < filledSegments && strength.score > 2 && strength.score <= 4
                ? 'bg-amber-500'
                : null,
              index < filledSegments && strength.score > 4 ? 'bg-emerald-600' : null,
            )}
          />
        ))}
      </div>
      <p
        className={cn('text-xs text-muted-foreground', strength.isOverByteLimit && 'text-red-600')}
      >
        {strength.label}. {strength.helperText}
      </p>
    </div>
  );
}
