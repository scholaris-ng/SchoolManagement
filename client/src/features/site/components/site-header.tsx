import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogIn, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSite } from '../site-context';
import { buildNav } from '../site-nav';
import { Container } from './site-ui';

/**
 * The site header.
 *
 * Two tiers, because a school's front door has two jobs: the dark utility strip
 * answers "where are you and how do I reach you" for the parent who arrived
 * from a search result, and the white bar below it carries the actual
 * navigation. The strip collapses on small screens, where the drawer takes over.
 */
export function SiteHeader() {
  const { content, path } = useSite();
  const location = useLocation();
  const nav = buildNav(content);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes the drawer — including a tap on the link for the page
  // the visitor is already on.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const isActive = (href: string) => {
    const target = path(href.split('#')[0]);
    if (href === '') return location.pathname === target || location.pathname === `${target}/`;
    return location.pathname.startsWith(target);
  };

  return (
    <header className="sticky top-0 z-50">
      <a
        href="#site-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Utility strip */}
      <div className="hidden bg-[var(--site-brand-dark)] text-white/80 lg:block">
        <Container className="flex h-10 items-center justify-between text-[0.8125rem]">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <MapPin className="size-3.5 text-[var(--site-gold)]" aria-hidden="true" />
              {content.contact.addressLines[0]}
            </span>
            <a
              href={`tel:${content.contact.phones[0].replace(/\s/g, '')}`}
              className="flex items-center gap-2 whitespace-nowrap hover:text-white"
            >
              <Phone className="size-3.5 text-[var(--site-gold)]" aria-hidden="true" />
              {content.contact.phones[0]}
            </a>
            <a
              href={`mailto:${content.contact.email}`}
              className="flex items-center gap-2 whitespace-nowrap hover:text-white"
            >
              <Mail className="size-3.5 text-[var(--site-gold)]" aria-hidden="true" />
              {content.contact.email}
            </a>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden whitespace-nowrap italic text-white/60 2xl:inline">{content.brand.motto}</span>
            <Link
              to="/sign-in"
              className="flex items-center gap-1.5 whitespace-nowrap font-medium text-white hover:text-[var(--site-gold)]"
            >
              <LogIn className="size-3.5" aria-hidden="true" />
              Student & parent portal
            </Link>
          </div>
        </Container>
      </div>

      {/* Main bar */}
      <div
        className={cn(
          'border-b border-[var(--site-line)] bg-white transition-shadow',
          stuck && 'site-header--stuck',
        )}
      >
        <Container className="flex h-[72px] items-center gap-4">
          <Link to={path('')} className="flex shrink-0 items-center gap-3">
            <img
              src={content.brand.crestUrl}
              alt=""
              className="size-11 object-contain"
              width={44}
              height={44}
            />
            <span className="leading-tight">
              <span className="site-display block text-[1.0625rem] font-semibold text-[var(--site-ink)]">
                {content.brand.name}
              </span>
              <span className="block text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-muted)]">
                {content.brand.motto}
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center gap-6 xl:flex">
            {nav.map((item) => (
              <div key={item.label} className="site-menu relative">
                <Link
                  to={path(item.href)}
                  className="site-nav-link"
                  data-active={isActive(item.href)}
                  aria-haspopup={item.children ? 'true' : undefined}
                >
                  {item.label}
                  {item.children && <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />}
                </Link>

                {item.children && (
                  <div className="site-menu__panel absolute left-1/2 top-full w-[290px] -translate-x-1/2 pt-3">
                    <ul className="overflow-hidden rounded-xl border border-[var(--site-line)] bg-white py-2 shadow-[0_20px_50px_-20px_rgb(15_23_42/0.4)]">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            to={path(child.href)}
                            className="block px-4 py-2.5 hover:bg-[var(--site-brand-soft)]"
                          >
                            <span className="block text-sm font-medium text-[var(--site-ink)]">
                              {child.label}
                            </span>
                            {child.description && (
                              <span className="block text-xs text-[var(--site-muted)]">
                                {child.description}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <Link
            to={path('admissions')}
            className="site-btn site-btn--primary site-btn--sm ml-auto hidden sm:inline-flex xl:ml-6"
          >
            Apply for admission
          </Link>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="ml-auto inline-flex size-10 items-center justify-center rounded-md border border-[var(--site-line)] text-[var(--site-ink)] sm:ml-0 xl:hidden"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </Container>
      </div>

      {drawerOpen && <MobileDrawer onClose={() => setDrawerOpen(false)} />}
    </header>
  );
}

/* -- Drawer ---------------------------------------------------------------- */

function MobileDrawer({ onClose }: { onClose: () => void }) {
  const { content, path } = useSite();
  const nav = buildNav(content);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--site-line)] px-5">
          <span className="site-display text-base font-semibold text-[var(--site-ink)]">
            {content.brand.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--site-line)]"
            aria-label="Close menu"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-2 py-3">
          <ul>
            {nav.map((item) => (
              <li key={item.label} className="border-b border-[var(--site-line)]/70 last:border-0">
                <div className="flex items-center">
                  <Link
                    to={path(item.href)}
                    className="flex-1 px-3 py-3.5 text-[0.9375rem] font-medium text-[var(--site-ink)]"
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                      className="inline-flex size-10 items-center justify-center text-[var(--site-muted)]"
                      aria-label={`${expanded === item.label ? 'Collapse' : 'Expand'} ${item.label}`}
                      aria-expanded={expanded === item.label}
                    >
                      <ChevronDown
                        className={cn('size-4 transition-transform', expanded === item.label && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
                {item.children && expanded === item.label && (
                  <ul className="pb-2">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          to={path(child.href)}
                          className="block rounded-md px-6 py-2.5 text-sm text-[var(--site-body)] hover:bg-[var(--site-brand-soft)]"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 space-y-2 border-t border-[var(--site-line)] p-4">
          <Link to={path('admissions')} className="site-btn site-btn--primary w-full">
            Apply for admission
          </Link>
          <Link to="/sign-in" className="site-btn site-btn--outline w-full">
            <LogIn className="size-4" aria-hidden="true" />
            Portal login
          </Link>
          <a
            href={`tel:${content.contact.phones[0].replace(/\s/g, '')}`}
            className="block pt-1 text-center text-sm text-[var(--site-muted)]"
          >
            {content.contact.phones[0]}
          </a>
        </div>
      </div>
    </div>
  );
}
