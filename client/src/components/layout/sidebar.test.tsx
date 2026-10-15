import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authStub, renderPage } from '@/test/harness';
import type { Permission } from '@/types/rbac';

let stub = authStub([]);
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => stub,
}));

const { Sidebar } = await import('./sidebar');

const PERMISSIONS: Permission[] = [
  'student.read',
  'academics.read',
  'guardian.read',
  'staff.read',
  'admission.read',
  'import.run',
  'analytics.read',
  'fee.manage',
  'invoice.manage',
  'payment.manage',
  'message.read',
  'announcement.read',
];

function renderSidebar({
  route = '/',
  collapsed = false,
  badges,
}: {
  route?: string;
  collapsed?: boolean;
  badges?: { messages?: number };
} = {}) {
  stub = authStub(PERMISSIONS);
  renderPage(<Sidebar collapsed={collapsed} onToggleCollapsed={vi.fn()} badges={badges} />, {
    route,
  });
  return userEvent.setup();
}

const link = (name: RegExp | string) => screen.queryByRole('link', { name });
const group = (name: RegExp | string) => screen.getByRole('button', { name });

afterEach(cleanup);

describe('Sidebar sections', () => {
  it('opens the section you are in and keeps the rest closed', () => {
    renderSidebar({ route: '/students' });

    expect(link('Students')).toBeInTheDocument();
    expect(group(/^people/i)).toHaveAttribute('aria-expanded', 'true');

    // Finance is not where they are, so its seven links are out of the way.
    expect(group(/^finance/i)).toHaveAttribute('aria-expanded', 'false');
    expect(link('Invoices')).not.toBeInTheDocument();
  });

  it('always opens the first section, so the dashboard is never behind a click', () => {
    renderSidebar({ route: '/finance/invoices' });

    expect(link('Dashboard')).toBeInTheDocument();
    expect(link('Invoices')).toBeInTheDocument();
    expect(link('Students')).not.toBeInTheDocument();
  });

  it('opens a closed section when its heading is clicked, and closes it again', async () => {
    const user = renderSidebar({ route: '/students' });

    await user.click(group(/^finance/i));
    expect(link('Invoices')).toBeInTheDocument();
    expect(group(/^finance/i)).toHaveAttribute('aria-expanded', 'true');

    await user.click(group(/^finance/i));
    expect(link('Invoices')).not.toBeInTheDocument();
  });

  it('lets the person close the section they are standing in', async () => {
    const user = renderSidebar({ route: '/students' });

    await user.click(group(/^people/i));

    expect(group(/^people/i)).toHaveAttribute('aria-expanded', 'false');
    expect(link('Students')).not.toBeInTheDocument();
  });

  it('remembers what was opened the next time the menu is drawn', async () => {
    const user = renderSidebar({ route: '/students' });
    await user.click(group(/^finance/i));
    cleanup();

    renderSidebar({ route: '/students' });

    expect(link('Invoices')).toBeInTheDocument();
  });

  it('survives a stored value it cannot read', () => {
    localStorage.setItem('scholaris:sidebar-sections', '"not an object"');

    renderSidebar({ route: '/students' });

    expect(link('Students')).toBeInTheDocument();
  });

  it('shows unread messages on a closed section’s heading', () => {
    renderSidebar({ route: '/students', badges: { messages: 3 } });

    expect(group(/^communication/i)).toHaveAttribute('aria-expanded', 'false');
    expect(group(/^communication/i)).toHaveTextContent('3');
  });

  it('closes every section from one button, including the one you are in', async () => {
    const user = renderSidebar({ route: '/students' });

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));

    for (const heading of [/^overview/i, /^people/i, /^finance/i, /^communication/i]) {
      expect(group(heading)).toHaveAttribute('aria-expanded', 'false');
    }
    expect(link('Students')).not.toBeInTheDocument();
    expect(link('Dashboard')).not.toBeInTheDocument();
  });

  it('offers to open everything again once it is all closed', async () => {
    const user = renderSidebar({ route: '/students' });
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));

    expect(screen.queryByRole('button', { name: 'Collapse all' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(group(/^finance/i)).toHaveAttribute('aria-expanded', 'true');
    expect(link('Invoices')).toBeInTheDocument();
    expect(link('Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();
  });

  it('keeps everything closed on the next visit, except the section the page is in', async () => {
    const user = renderSidebar({ route: '/students' });
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    cleanup();

    renderSidebar({ route: '/students' });

    expect(group(/^overview/i)).toHaveAttribute('aria-expanded', 'false');
    expect(group(/^finance/i)).toHaveAttribute('aria-expanded', 'false');
    // Landing on a page shows where it is, whatever was closed before.
    expect(group(/^people/i)).toHaveAttribute('aria-expanded', 'true');
    expect(link('Students')).toBeInTheDocument();
  });

  it('does not offer collapse-all in the icon-only rail', () => {
    renderSidebar({ route: '/students', collapsed: true });

    expect(screen.queryByRole('button', { name: /collapse all|expand all/i })).not.toBeInTheDocument();
  });

  it('lists every link in the icon-only rail, which has no headings to fold under', () => {
    renderSidebar({ route: '/students', collapsed: true });

    expect(screen.queryByRole('button', { name: /^finance/i })).not.toBeInTheDocument();
    expect(link('Invoices')).toBeVisible();
    expect(link('Students')).toBeVisible();
  });

  it('names each icon-only link, with its unread count, for a screen reader', () => {
    renderSidebar({ route: '/students', collapsed: true, badges: { messages: 3 } });

    // No visible text sits beside the icon in the rail; the name is all there is.
    expect(link('Messages (3)')).toHaveAttribute('href', '/messages');
    expect(link('Announcements')).toHaveAttribute('href', '/announcements');
  });

  it('leaves the expanded links named by their own text', () => {
    renderSidebar({ route: '/students', badges: { messages: 3 } });

    expect(screen.getByRole('link', { name: 'Students' })).not.toHaveAttribute('aria-label');
  });
});
