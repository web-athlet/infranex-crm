'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandMark } from '@/components/shared/brand-mark';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/lib/store/ui-store';

import {
  primaryNavigationItems,
  secondaryNavigationItems,
  type NavigationItem,
} from './navigation';

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, isExpanded }: { item: NavigationItem; isExpanded: boolean }) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, item.href);

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/72 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        isActive && 'bg-white/[0.12] text-white',
        !isExpanded && 'justify-center px-0',
      )}
      href={item.href}
      title={isExpanded ? undefined : item.label}
    >
      {isActive ? (
        <span className="absolute left-0 h-5 w-0.5 rounded-r bg-white" aria-hidden="true" />
      ) : null}
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] text-[11px] font-semibold uppercase text-white"
      >
        {item.marker}
      </span>
      <span className={cn('truncate', !isExpanded && 'sr-only')}>{item.label}</span>
    </Link>
  );
}

export function NavRail() {
  const navExpanded = useUiStore((state) => state.navExpanded);
  const toggleNavExpanded = useUiStore((state) => state.toggleNavExpanded);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col bg-nav-bg px-2 py-4 text-white shadow-card transition-[width] duration-200 md:flex',
        navExpanded ? 'w-[220px]' : 'w-[60px]',
      )}
    >
      <div
        className={cn(
          'flex items-center',
          navExpanded ? 'justify-between gap-2 px-1' : 'justify-center',
        )}
      >
        <div className={cn(!navExpanded && 'sr-only')}>
          <BrandMark inverted />
        </div>
        <button
          aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/78 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          type="button"
          onClick={toggleNavExpanded}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {navExpanded ? '<' : '>'}
          </span>
        </button>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-1">
        {primaryNavigationItems.map((item) => (
          <NavigationLink key={item.href} item={item} isExpanded={navExpanded} />
        ))}
      </div>

      <div className="border-t border-white/10 pt-3">
        <button
          aria-label="Notifications"
          className={cn(
            'mb-2 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-white/72 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            !navExpanded && 'justify-center px-0',
          )}
          type="button"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] text-[11px] font-semibold uppercase text-white"
          >
            N
          </span>
          <span className={cn('truncate', !navExpanded && 'sr-only')}>Notifications</span>
        </button>
        {secondaryNavigationItems.map((item) => (
          <NavigationLink key={item.href} item={item} isExpanded={navExpanded} />
        ))}
        <div
          className={cn(
            'mt-3 flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/72',
            !navExpanded && 'justify-center px-0',
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.16] text-[11px] font-semibold text-white"
          >
            U
          </span>
          <span className={cn('truncate', !navExpanded && 'sr-only')}>User</span>
        </div>
      </div>
    </nav>
  );
}
