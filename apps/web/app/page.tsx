import { AppShell } from '@/components/layout/app-shell';
import { BrandMark } from '@/components/shared/brand-mark';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="space-y-6">
          <BrandMark />
          <div className="max-w-2xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-normal text-foreground">infranex CRM</h1>
            <p className="text-base leading-7 text-muted-foreground">
              Frontend scaffold for the AI-native CRM workspace.
            </p>
          </div>
          <div>
            <Button type="button">Ready</Button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
