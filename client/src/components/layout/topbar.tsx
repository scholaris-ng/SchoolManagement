import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bell,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useTheme, type ThemeMode } from '@/app/providers/theme-provider';
import { QUICK_ACTIONS } from '@/app/navigation';
import { useCurrentTerm } from '@/features/academics/api';
import { Avatar } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { CurrentTermBadge } from './current-term-badge';
import { SyncIndicator } from './sync-indicator';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { CommandPalette } from './command-palette';

export interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const navigate = useNavigate();
  const { user, membership, signOut, can } = useAuth();
  const { mode, setMode } = useTheme();
  const { data: currentTerm } = useCurrentTerm();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const quickActions = QUICK_ACTIONS.filter((action) => !action.require || can(action.require));

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-sm no-print sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
        >
          <Menu />
        </Button>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent sm:max-w-sm"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">Search or jump to…</span>
          <kbd className="hidden shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <CurrentTermBadge />
          <SyncIndicator />

          {quickActions.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Plus />
                  New
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 w-56 rounded-md border border-border bg-popover p-1 shadow-popover animate-in"
                >
                  {quickActions.map((action) => (
                    <DropdownMenu.Item
                      key={action.to}
                      onSelect={() => navigate(action.to)}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                    >
                      <action.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {action.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          <NotificationBell />

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Account menu"
              >
                <Avatar name={user?.displayName ?? 'User'} src={user?.photoUrl} size="sm" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-60 rounded-md border border-border bg-popover p-1 shadow-popover animate-in"
              >
                <div className="border-b border-border px-2 py-2">
                  <p className="truncate text-sm font-medium">{user?.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  {membership && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {membership.schoolName}
                    </p>
                  )}
                  {/* The top-bar badge is hidden on a phone; this is where a
                      mobile user finds the same answer. */}
                  {currentTerm && (
                    <p className="mt-1 truncate text-xs text-muted-foreground sm:hidden">
                      {currentTerm.name} · {currentTerm.sessionName}
                    </p>
                  )}
                </div>

                <DropdownMenu.Item asChild>
                  <Link
                    to="/profile"
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                  >
                    <UserIcon className="size-4 text-muted-foreground" />
                    My profile
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link
                    to="/profile/notifications"
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                  >
                    <Bell className="size-4 text-muted-foreground" />
                    Notification settings
                  </Link>
                </DropdownMenu.Item>
                {can('settings.manage') && (
                  <DropdownMenu.Item asChild>
                    <Link
                      to="/settings"
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                    >
                      <Settings className="size-4 text-muted-foreground" />
                      School settings
                    </Link>
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Separator className="my-1 h-px bg-border" />

                <DropdownMenu.Label className="px-2 py-1 text-xs text-muted-foreground">
                  Appearance
                </DropdownMenu.Label>
                <div className="flex gap-1 px-1 pb-1">
                  {(
                    [
                      { value: 'light', icon: Sun, label: 'Light' },
                      { value: 'dark', icon: Moon, label: 'Dark' },
                      { value: 'system', icon: Monitor, label: 'System' },
                    ] as { value: ThemeMode; icon: typeof Sun; label: string }[]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      aria-pressed={mode === option.value}
                      className={cn(
                        'flex flex-1 flex-col items-center gap-1 rounded-sm px-2 py-1.5 text-[11px] transition-colors',
                        mode === option.value
                          ? 'bg-primary-subtle text-primary'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <option.icon className="size-3.5" aria-hidden="true" />
                      {option.label}
                    </button>
                  ))}
                </div>

                <DropdownMenu.Separator className="my-1 h-px bg-border" />

                <DropdownMenu.Item
                  onSelect={() => void signOut()}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-subtle"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
