import { cn } from '@/lib/utils';

type BrandMarkProps = {
  inverted?: boolean;
};

export function BrandMark({ inverted = false }: BrandMarkProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium',
        inverted ? 'text-white' : 'text-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md font-semibold',
          inverted ? 'bg-white text-nav-bg' : 'bg-primary text-primary-foreground',
        )}
      >
        i
      </span>
      <span>infranex CRM</span>
    </div>
  );
}
