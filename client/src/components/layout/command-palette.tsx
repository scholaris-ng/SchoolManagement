import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Loader2, Search, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { NAV_SECTIONS, QUICK_ACTIONS, isNavItemVisible } from '@/app/navigation';
import { useStudentSearch } from '@/features/students/api';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/primitives';
import { searchEntries, splitOnMatches, type SearchableEntry } from './command-palette-search';

interface PaletteEntry extends SearchableEntry {
  id: string;
  group: 'Actions' | 'Go to' | 'Students';
  to: string;
  icon?: React.ReactNode;
}

/** Enough that a one-letter query doesn't bury the students under every page in the app. */
const MAX_PAGE_RESULTS = 20;

/**
 * Ctrl/Cmd-K palette. It searches navigation, quick actions and — because it
 * is what staff actually look for — students, by name or admission number.
 *
 * The groups always read Actions, Go to, Students, in that order. Student
 * results arrive a moment after the rest, so anything that put them first
 * would shove the row someone is about to press Enter on down the list.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { can, persona, user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-results`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const canSearchStudents = can('student.read');
  const trimmed = query.trim();

  // Debounces internally, so this passes every keystroke straight through.
  const studentSearch = useStudentSearch(query, { enabled: open && canSearchStudents });
  const searchingStudents = canSearchStudents && trimmed.length >= 2 && studentSearch.isSearching;

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

  // A new query is a new list: start at its top. (Not on every change in the
  // number of results — student matches landing late must not move the cursor.)
  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollTo?.({ top: 0 });
  }, [query]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const navEntries: PaletteEntry[] = NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter(
          (item) =>
            (!item.personas || item.personas.includes(persona)) &&
            (!item.require || can(item.require)) &&
            isNavItemVisible(item, user),
        )
        .map((item) => ({
          id: `nav:${item.to}`,
          label: item.label,
          hint: section.label,
          group: 'Go to' as const,
          to: item.to,
          icon: <item.icon className="size-4" />,
        })),
    );

    const actionEntries: PaletteEntry[] = QUICK_ACTIONS.filter(
      (action) => !action.require || can(action.require),
    ).map((action) => ({
      id: `action:${action.to}`,
      label: action.label,
      group: 'Actions' as const,
      to: action.to,
      icon: <action.icon className="size-4" />,
      // Matched, not shown: "enrol register" beside "Add a student" read as
      // noise. When one of these is the only reason a row appears, it says so.
      keywords: action.keywords,
    }));

    const studentEntries: PaletteEntry[] = (studentSearch.data ?? []).map((student) => ({
      id: `student:${student.id}`,
      label: student.fullName,
      hint: `${student.admissionNo}${student.className ? ` · ${student.className}` : ''}`,
      group: 'Students' as const,
      to: `/students/${student.id}`,
      icon: (
        <Avatar
          name={student.fullName}
          src={student.photoUrl}
          suppressPhoto={!student.photoConsent}
          size="sm"
        />
      ),
    }));

    const withMatchNote = ({ entry, via }: { entry: PaletteEntry; via?: string }) =>
      via ? { ...entry, hint: `matches “${via}”` } : entry;

    const pages = searchEntries(navEntries, query).slice(0, trimmed ? MAX_PAGE_RESULTS : undefined);

    return [
      ...searchEntries(actionEntries, query).map(withMatchNote),
      ...pages.map(withMatchNote),
      // The server has already decided these match; sorting them again here
      // would second-guess it.
      ...studentEntries,
    ];
  }, [query, trimmed, can, persona, user, studentSearch.data]);

  const groups = useMemo(() => {
    const result: { label: string; items: { entry: PaletteEntry; index: number }[] }[] = [];
    entries.forEach((entry, index) => {
      let group = result[result.length - 1];
      if (!group || group.label !== entry.group) {
        group = { label: entry.group, items: [] };
        result.push(group);
      }
      group.items.push({ entry, index });
    });
    return result;
  }, [entries]);

  // Results can shrink under the cursor as the query narrows.
  const active = Math.min(activeIndex, Math.max(entries.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    // `scroll-mt` on each option leaves room for its group heading, so moving
    // onto the first row of a group brings the heading along.
    document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, baseId]);

  const go = (entry: PaletteEntry) => {
    onOpenChange(false);
    navigate(entry.to);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Enter confirms an IME candidate here; it isn't a request to navigate.
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (entries.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // Wraps: on a list this long, Up from the top is the quickest way to the bottom.
      setActiveIndex((active + step + entries.length) % entries.length);
    } else if (event.key === 'Enter' && entries[active]) {
      event.preventDefault();
      go(entries[active]);
    }
  };

  const status = searchingStudents
    ? entries.length > 0
      ? `${entries.length} result${entries.length === 1 ? '' : 's'} · searching students…`
      : 'Searching students…'
    : entries.length > 0
      ? `${entries.length} result${entries.length === 1 ? '' : 's'}`
      : 'No results';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" hideClose data-cy="command-palette" className="top-[12%] translate-y-0 p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Find {canSearchStudents ? 'students, ' : ''}pages and actions. Use the arrow keys to move
          through the results and Enter to open one.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border px-4">
          {searchingStudents ? (
            <Loader2
              className="size-5 shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={entries.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            data-cy="command-palette-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              canSearchStudents ? 'Search students, pages and actions…' : 'Search pages and actions…'
            }
            aria-label="Command palette search"
            autoComplete="off"
            spellCheck={false}
            // The global focus ring is a box-shadow, which this dialog's
            // `overflow-hidden` clips into a stray frame. The palette is the
            // focus context; the input needs no ring of its own.
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Kbd className="hidden sm:grid">Esc</Kbd>
        </div>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Results"
          className="scrollbar-thin max-h-[min(28rem,55dvh)] overflow-y-auto p-2"
        >
          {entries.length === 0 ? (
            <div className="px-3 py-10 text-center">
              {searchingStudents ? (
                <Loader2
                  className="mx-auto size-6 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <SearchX className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              )}
              <p className="mt-3 text-sm font-medium">
                {searchingStudents ? 'Searching students…' : `No results for “${trimmed}”`}
              </p>
              {!searchingStudents && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {canSearchStudents
                    ? 'Try a student’s name or admission number, or the name of a page.'
                    : 'Try the name of a page or action.'}
                </p>
              )}
            </div>
          ) : (
            groups.map((group, groupIndex) => (
              <div
                key={group.label}
                role="group"
                aria-labelledby={`${baseId}-group-${groupIndex}`}
                className="[&:not(:first-child)]:mt-2"
              >
                <p
                  id={`${baseId}-group-${groupIndex}`}
                  className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {group.label}
                </p>
                {group.items.map(({ entry, index }) => {
                  const isActive = index === active;
                  return (
                    <button
                      key={entry.id}
                      id={optionId(index)}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      data-cy={`command-palette-option-${entry.id}`}
                      aria-selected={isActive}
                      // Mouse *move*, not enter: scrolling the list to follow the
                      // arrow keys slides rows under a resting pointer, and that
                      // must not steal the selection back.
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => go(entry)}
                      className={cn(
                        'flex w-full scroll-mt-8 items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isActive ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-md transition-colors',
                          // A student's own avatar needs no tile behind it.
                          entry.group !== 'Students' &&
                            (isActive
                              ? 'bg-primary-subtle text-primary dark:text-white'
                              : 'bg-muted text-muted-foreground'),
                        )}
                      >
                        {entry.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {splitOnMatches(entry.label, query).map((part, partIndex) => (
                          <span
                            key={partIndex}
                            className={part.match ? 'font-semibold text-foreground' : undefined}
                          >
                            {part.text}
                          </span>
                        ))}
                      </span>
                      {entry.hint && (
                        <span className="hidden min-w-0 max-w-[45%] shrink-0 truncate text-xs text-muted-foreground sm:block">
                          {entry.hint}
                        </span>
                      )}
                      {/* Always laid out, so the hint doesn't shift as the cursor moves. */}
                      <CornerDownLeft
                        className={cn(
                          'size-3.5 shrink-0 text-muted-foreground',
                          !isActive && 'invisible',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="hidden items-center justify-between gap-4 border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:flex"
          aria-hidden="true"
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              Open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </div>
          <span>{trimmed ? status : ''}</span>
        </div>
        {/* What the footer says, for anyone who can't see it. */}
        <span role="status" className="sr-only">
          {trimmed ? status : ''}
        </span>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'grid h-5 min-w-5 place-items-center rounded border border-border bg-card px-1 font-mono text-[10px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
