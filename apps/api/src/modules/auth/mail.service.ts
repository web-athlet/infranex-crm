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

    void input.email;
    void input.token;
    console.warn('Password reset email prepared in non-production mail stub');
  }
}
