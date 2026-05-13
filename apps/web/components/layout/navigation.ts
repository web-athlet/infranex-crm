export type NavigationItem = {
  href: string;
  label: string;
  marker: string;
};

export const primaryNavigationItems = [
  { href: '/pulse', label: 'Pulse', marker: 'P' },
  { href: '/leads', label: 'Leads', marker: 'L' },
  { href: '/deals', label: 'Deals', marker: 'D' },
  { href: '/projects', label: 'Projekte', marker: 'Pr' },
  { href: '/campaigns', label: 'Campaigns', marker: 'C' },
  { href: '/inbox', label: 'Inbox', marker: 'I' },
  { href: '/activities', label: 'Aktivitäten', marker: 'A' },
  { href: '/notes', label: 'Notizen', marker: 'N' },
  { href: '/contacts', label: 'Kontakte', marker: 'K' },
  { href: '/insights', label: 'Einblicke', marker: 'E' },
  { href: '/products', label: 'Produkte', marker: 'Pd' },
] satisfies NavigationItem[];

export const mobileNavigationItems = primaryNavigationItems
  .slice(0, 4)
  .concat(primaryNavigationItems[5]);

export const secondaryNavigationItems = [
  { href: '/settings', label: 'Settings', marker: 'S' },
  { href: '/help', label: 'Help', marker: 'H' },
] satisfies NavigationItem[];
