import type { ReactNode } from 'react';

import { BrandMark } from '@/components/shared/brand-mark';

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-8">
        <div className="space-y-4">
          <BrandMark />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">{title}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="space-y-6 rounded-md border border-border bg-background p-6 shadow-sm">
          {children}
        </div>
        {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}
