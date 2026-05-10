import { ResetPasswordForm } from './reset-password-form';

type ResetPasswordPageProps = {
  searchParams?: {
    token?: string | string[];
  };
};

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const tokenParam = searchParams?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : (tokenParam ?? '');

  return <ResetPasswordForm token={token} />;
}
