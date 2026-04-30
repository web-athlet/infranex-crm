import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type PasswordResetEmailInput = {
  email: string;
  token: string;
};

@Injectable()
export class MailService {
  assertPasswordResetEmailAvailable(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Password reset email delivery is not configured');
    }
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    this.assertPasswordResetEmailAvailable();

    // Development-only stub: do not log reset tokens in production.
    console.warn(`DEV ONLY password reset token for ${input.email}: ${input.token}`);
  }
}
