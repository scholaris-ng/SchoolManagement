import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Loader2, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { NAV_SECTIONS, QUICK_ACTIONS } from '@/app/navigation';
import { useStudentSearch } from '@/features/students/api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/primitives';

interface PaletteEntry {
  id: string;
  label: string;
  hint?: string;
  group: string;
  to: string;
  icon?: React.ReactNode;
}

/**
 * Ctrl/Cmd-K palette. It searches navigation, quick actions and — because it
 * is what staff actually look for — students, by name or admission number.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { can, persona } = useAuth();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Debounces internally, so this passes every keystroke straight through.
  const studentSearch = useStudentSearch(query, {
    enabled: open && can('student.read'),
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const needle = query.trim().toLowerCase();

    const navEntries = NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter(
          (item) =>
            (!item.personas || item.personas.includes(persona)) &&
            (!item.require || can(item.require)),
        )
        .map((item) => ({
          id: `nav:${item.to}`,
          label: item.label,
          hint: section.label,
          group: 'Go to',
          to: item.to,
          icon: <item.icon className="size-4" />,
        })),
    );

    const actionEntries = QUICK_ACTIONS.filter(
      (action) => !action.require || can(action.require),
    ).map((action) => ({
      id: `action:${action.to}`,
      label: action.label,
      group: 'Actions',
      to: action.to,
      icon: <action.icon className="size-4" />,
      hint: action.keywords?.join(' '),
    }));

    const studentEntries = (studentSearch.data ?? []).map((student) => ({
      id: `student:${student.id}`,
      label: student.fullName,
      hint: `${student.admissionNo}${student.className ? ` · ${student.className}` : ''}`,
      group: 'Students',
      to: `/students/${student.id}`,
      icon: (
        <Avatar
          name={student.fullName}
          src={student.photoUrl}
          suppressPhoto={!student.photoConsent}
          size="xs"
        />
      ),
    }));

    const matches = (entry: PaletteEntry) =>
      !needle ||
      entry.label.toLowerCase().includes(needle) ||
      entry.hint?.toLowerCase().includes(needle);

    return [
      ...actionEntries.filter(matches),
      ...navEntries.filter(matches),
      ...studentEntries,
    ].slice(0, 40);
  }, [query, can, persona, studentSearch.data]);

  useEffect(() => setActiveIndex(0), [entries.length]);

  const go = (entry: PaletteEntry) => {
    onOpenChange(false);
    navigate(entry.to);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, entries.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && entries[activeIndex]) {
      event.preventDefault();
      go(entries[activeIndex]);
    }
  };

  let lastGroup = '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" hideClose data-cy="command-palette" className="top-[12%] translate-y-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-4">
          {studentSearch.isSearching ? (
            <Loader2
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            autoFocus
            data-cy="command-palette-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search students, pages and actions…"
            aria-label="Command palette search"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="scrollbar-thin max-h-[min(28rem,60vh)] overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {studentSearch.isSearching ? 'Searching…' : 'No matches.'}
            </p>
          ) : (
            <ul role="listbox" aria-label="Results">
              {entries.map((entry, index) => {
                const showGroup = entry.group !== lastGroup;
                lastGroup = entry.group;
                return (
                  <li key={entry.id}>
                    {showGroup && (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                        {entry.group}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      data-cy={`command-palette-option-${entry.id}`}
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(entry)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {entry.icon ?? <Users className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      {entry.hint && (
                        <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:block">
                          {entry.hint}
                        </span>
                      )}
                      {index === activeIndex && (
                        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
