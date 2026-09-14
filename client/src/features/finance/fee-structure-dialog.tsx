import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAcademicSessions, useClasses, useLevels, useTerms } from '@/features/academics/api';
import { useFeeItems } from './use-fees';
import { Toggle } from './fees-page-parts';
import type { FeeStructure } from '@/types/finance';
import type { FeeStructureInput } from './finance.endpoints';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** A fee item the bursar has ticked, with the price this structure charges. */
interface LineDraft {
  feeItemId: string;
  amount: string;
  isOptional: boolean;
}

/**
 * Defining what a term costs a cohort.
 *
 * The shape of the sheet mirrors the decision: who it applies to (session,
 * term, levels, optionally particular classes), then what they are charged.
 * Amounts default to the fee item's own so a bursar who charges the standard
 * price only has to tick a box, and can still overwrite one where senior
 * secondary pays more than primary.
 *
 * Leaving every level unticked means "all levels", which is stated on screen
 * rather than left to be discovered: an empty selection reading as "everyone"
 * is the kind of thing that bills a whole school by accident.
 */
export function FeeStructureDialog({
  state,
  onOpenChange,
  onSave,
  saving,
}: {
  /**
   * `mode: 'duplicate'` prefills every field from `structure` exactly like
   * editing does, but the dialog reads as making a new one — `fees-page.tsx`
   * is what actually sends it to `create` rather than `update`.
   */
  state: { open: boolean; structure?: FeeStructure; mode?: 'edit' | 'duplicate' };
  onOpenChange: (open: boolean) => void;
  onSave: (values: FeeStructureInput) => Promise<unknown>;
  saving: boolean;
}) {
  const existing = state.structure;
  const isDuplicate = state.mode === 'duplicate';

  const sessions = useAcademicSessions();
  const levels = useLevels();
  const feeItems = useFeeItems();

  const [name, setName] = useState(existing?.name ?? '');
  const [sessionId, setSessionId] = useState(existing?.sessionId ?? '');
  const [termId, setTermId] = useState(existing?.termId ?? '');
  const [levelIds, setLevelIds] = useState<string[]>(existing?.levelIds ?? []);
  const [classIds, setClassIds] = useState<string[]>(existing?.classIds ?? []);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [lines, setLines] = useState<LineDraft[]>(
    (existing?.lines ?? []).map((line) => ({
      feeItemId: line.feeItemId,
      amount: String(line.amount),
      isOptional: line.isOptional,
    })),
  );

  // The session is not chosen until the sessions have loaded, so default to
  // the current one the moment it is known rather than in an effect.
  const effectiveSessionId =
    sessionId || sessions.data?.find((session) => session.isCurrent)?.id || '';

  const terms = useTerms(effectiveSessionId || undefined);
  const classes = useClasses();

  const items = useMemo(
    () => (feeItems.data?.items ?? []).filter((item) => item.isActive),
    [feeItems.data],
  );
  const byId = useMemo(() => new Map(lines.map((line) => [line.feeItemId, line])), [lines]);

  const currency = 'NGN';
  const mandatoryTotal = lines
    .filter((line) => !line.isOptional)
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  const toggleItem = (itemId: string, checked: boolean) => {
    setLines((current) => {
      if (!checked) return current.filter((line) => line.feeItemId !== itemId);
      const item = items.find((entry) => entry.id === itemId);
      return [
        ...current,
        { feeItemId: itemId, amount: String(item?.amount ?? 0), isOptional: item?.isOptional ?? false },
      ];
    });
  };

  const patchLine = (itemId: string, patch: Partial<LineDraft>) =>
    setLines((current) =>
      current.map((line) => (line.feeItemId === itemId ? { ...line, ...patch } : line)),
    );

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

  const allLevelIds = useMemo(() => (levels.data ?? []).map((level) => level.id), [levels.data]);
  const allLevelsSelected = allLevelIds.length > 0 && levelIds.length === allLevelIds.length;

  const allClassIds = useMemo(() => (classes.data ?? []).map((schoolClass) => schoolClass.id), [classes.data]);
  const allClassesSelected = allClassIds.length > 0 && classIds.length === allClassIds.length;

  const allItemsSelected = items.length > 0 && items.every((item) => byId.has(item.id));
  const toggleAllItems = () => {
    if (allItemsSelected) {
      setLines([]);
      return;
    }
    // Keeps a price the bursar already typed in rather than resetting it back
    // to the fee item's default the moment "Select all" sweeps up the rest.
    setLines((current) => {
      const existingIds = new Set(current.map((line) => line.feeItemId));
      const additions = items
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          feeItemId: item.id,
          amount: String(item.amount ?? 0),
          isOptional: item.isOptional ?? false,
        }));
      return [...current, ...additions];
    });
  };

  const valid = Boolean(name.trim() && effectiveSessionId && lines.length > 0);

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isDuplicate ? 'Duplicate fee structure' : existing ? 'Edit fee structure' : 'New fee structure'}
          </DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? 'A copy of an existing structure, ready to adjust — the term or levels, say — before saving it as a new one. The original is untouched.'
              : 'What a term costs, for one group of pupils. Invoices generated from this copy the amounts, so editing it later never changes a bill already sent.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="structure-name" required>
                Name
              </Label>
              <Input
                data-cy="structure-name"
                id="structure-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Junior secondary, second term"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="structure-session" required>
                Session
              </Label>
              <NativeSelect
                data-cy="structure-session"
                id="structure-session"
                value={effectiveSessionId}
                onChange={(event) => {
                  setSessionId(event.target.value);
                  // A term belongs to one session, so it cannot survive the move.
                  setTermId('');
                }}
              >
                {(sessions.data ?? []).map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="structure-term">Term</Label>
              <NativeSelect
                data-cy="structure-term"
                id="structure-term"
                value={termId ?? ''}
                onChange={(event) => setTermId(event.target.value)}
              >
                <option value="">Any term in this session</option>
                {(terms.data ?? []).map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <span>
                Levels{' '}
                <span className="font-normal text-muted-foreground">
                  {levelIds.length === 0 ? '· all levels' : `· ${levelIds.length} selected`}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-cy="structure-levels-toggle-all"
                disabled={allLevelIds.length === 0}
                onClick={() => setLevelIds(allLevelsSelected ? [] : allLevelIds)}
              >
                {allLevelsSelected ? 'Clear all' : 'Select all'}
              </Button>
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {(levels.data ?? []).map((level) => (
                <label key={level.id} className="flex items-center gap-2 text-sm">
                  <input
                    data-cy="structure-level"
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={levelIds.includes(level.id)}
                    onChange={() => setLevelIds((current) => toggleId(current, level.id))}
                  />
                  {level.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <span>
                Classes{' '}
                <span className="font-normal text-muted-foreground">
                  {classIds.length === 0
                    ? '· every class in those levels'
                    : `· ${classIds.length} selected`}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-cy="structure-classes-toggle-all"
                disabled={allClassIds.length === 0}
                onClick={() => setClassIds(allClassesSelected ? [] : allClassIds)}
              >
                {allClassesSelected ? 'Clear all' : 'Select all'}
              </Button>
            </legend>
            <div className="scrollbar-thin flex max-h-28 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
              {(classes.data ?? []).map((schoolClass) => (
                <label key={schoolClass.id} className="flex items-center gap-2 text-sm">
                  <input
                    data-cy="structure-class"
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={classIds.includes(schoolClass.id)}
                    onChange={() => setClassIds((current) => toggleId(current, schoolClass.id))}
                  />
                  {schoolClass.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium">
              Charges
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-cy="structure-charges-toggle-all"
                disabled={items.length === 0}
                onClick={toggleAllItems}
              >
                {allItemsSelected ? 'Clear all' : 'Select all'}
              </Button>
            </legend>
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((item) => {
                const line = byId.get(item.id);
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        data-cy="structure-item"
                        type="checkbox"
                        className="size-4 shrink-0 rounded border-input"
                        checked={Boolean(line)}
                        onChange={(event) => toggleItem(item.id, event.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">
                          {item.name}
                          <span className="text-muted-foreground">
                            {' '}
                            · {humanizeEnum(item.category)}
                          </span>
                        </span>
                        {/* Set once on the fee item itself (`fee-item-dialog.tsx`),
                            not per structure — shown here only so a bursar
                            composing this sheet can see where each charge routes. */}
                        {item.bankName && item.accountNumber && (
                          <span className="block truncate text-xs text-muted-foreground">
                            Pay into {item.bankName} · {item.accountNumber}
                          </span>
                        )}
                      </span>
                    </label>
                    {line && (
                      <>
                        <Input
                          data-cy="structure-item-amount"
                          type="number"
                          min={0}
                          className="w-32"
                          aria-label={`Amount for ${item.name}`}
                          value={line.amount}
                          onChange={(event) => patchLine(item.id, { amount: event.target.value })}
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            data-cy="structure-item-optional"
                            type="checkbox"
                            className="size-3.5 rounded border-input"
                            checked={line.isOptional}
                            onChange={(event) =>
                              patchLine(item.id, { isOptional: event.target.checked })
                            }
                          />
                          Optional
                        </label>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-right text-sm text-muted-foreground">
              Every pupil in scope:{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(mandatoryTotal, currency, { showDecimals: false })}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Optional charges are billed on top. Boarding is only billed to boarders; other
              optional charges go to everyone the structure covers.
            </p>
          </fieldset>

          <Toggle label="Active" checked={isActive} onChange={setIsActive} />
        </DialogBody>

        <DialogFooter>
          <Button data-cy="structure-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="structure-save"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                name: name.trim(),
                sessionId: effectiveSessionId,
                termId: termId || null,
                levelIds,
                classIds,
                lines: lines.map((line) => ({
                  feeItemId: line.feeItemId,
                  amount: Number(line.amount) || 0,
                  isOptional: line.isOptional,
                })),
                isActive,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
