import { useState } from 'react';
import { Plus, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudentSearch } from '@/features/students/api';
import {
  useBehaviourObservations,
  useBehaviourScales,
  useBehaviourTraits,
  useRecordObservation,
  useSaveBehaviourTrait,
} from './api';
import type { BehaviourTrait } from '@/types/behaviour';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, SearchInput, Textarea, Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/ui/feedback';

const CATEGORIES: BehaviourTrait['category'][] = ['AFFECTIVE', 'PSYCHOMOTOR', 'SKILL', 'OTHER'];

/**
 * Behaviour and skills.
 *
 * Nothing here is fixed by the software: a school defines its own traits —
 * punctuality, neatness, leadership, whatever it values — and its own rating
 * scale (spec section 23).
 */
export function BehaviourPage() {
  const { can } = useAuth();
  const traits = useBehaviourTraits();
  const scales = useBehaviourScales();
  const list = useListQuery({ filterKeys: ['traitId', 'classId'], defaultPageSize: 20 });
  const observations = useBehaviourObservations(list.query);

  const [observeOpen, setObserveOpen] = useState(false);
  const [traitDialog, setTraitDialog] = useState<{ open: boolean; trait?: BehaviourTrait }>({
    open: false,
  });

  const canRecord = can('behaviour.manage');
  const canConfigure = can('behaviour.configure');

  return (
    <PageContainer>
      <PageHeader
        title="Behaviour"
        description="The traits your school assesses, and the observations that build up a picture through the term."
        breadcrumbs={[{ label: 'Behaviour & safety' }, { label: 'Behaviour' }]}
        actions={
          <>
            {canConfigure && (
              <Button variant="outline" onClick={() => setTraitDialog({ open: true })}>
                <Plus />
                New trait
              </Button>
            )}
            {canRecord && (
              <Button onClick={() => setObserveOpen(true)}>
                <Star />
                Record an observation
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Traits assessed</CardTitle>
            <CardDescription>
              What appears on a report card, and which levels each trait applies to.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {traits.isPending ? (
              <LoadingState label="Loading traits…" />
            ) : (traits.data?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<Sparkles />}
                title="No traits defined"
                description="Add the qualities your school reports on."
              />
            ) : (
              <ul className="divide-y divide-border">
                {traits.data?.map((trait) => (
                  <li key={trait.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{trait.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {humanizeEnum(trait.category)} · {trait.scaleName}
                      </p>
                    </div>
                    {trait.appearsOnReportCard && <Badge tone="primary">On report card</Badge>}
                    {!trait.isActive && <Badge tone="warning">Inactive</Badge>}
                    {canConfigure && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTraitDialog({ open: true, trait })}
                      >
                        Edit
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Recent observations</CardTitle>
                <CardDescription>
                  Every rating is attributed and timestamped, so a report-card comment can be traced
                  back to the day it was earned.
                </CardDescription>
              </div>
              <NativeSelect
                aria-label="Filter by trait"
                value={list.filters.traitId ?? ''}
                onChange={(event) => list.setFilter('traitId', event.target.value || undefined)}
                className="h-9 w-auto text-sm"
              >
                <option value="">All traits</option>
                {(traits.data ?? []).map((trait) => (
                  <option key={trait.id} value={trait.id}>
                    {trait.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {observations.isPending ? (
              <LoadingState label="Loading observations…" />
            ) : (observations.data?.items.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Star />} title="No observations recorded yet" />
            ) : (
              <ul className="divide-y divide-border">
                {observations.data?.items.map((observation) => (
                  <li key={observation.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{observation.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {observation.traitName} · {observation.observedByName} ·{' '}
                        {formatDateTime(observation.observedAt)}
                      </p>
                      {observation.note && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{observation.note}</p>
                      )}
                    </div>
                    <RatingDots rating={observation.rating} max={observation.scaleMax} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ObservationDialog
        open={observeOpen}
        onOpenChange={setObserveOpen}
        traits={traits.data ?? []}
      />

      <TraitDialog
        key={traitDialog.trait?.id ?? 'new-trait'}
        state={traitDialog}
        scales={(scales.data ?? []).map((scale) => ({ value: scale.id, label: scale.name }))}
        onClose={() => setTraitDialog({ open: false })}
      />
    </PageContainer>
  );
}

function RatingDots({ rating, max }: { rating: number; max: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of ${max}`}
    >
      {Array.from({ length: max }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'size-2.5 rounded-full',
            index < rating ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
      <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
        {rating}/{max}
      </span>
    </span>
  );
}

function ObservationDialog({
  open,
  onOpenChange,
  traits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traits: BehaviourTrait[];
}) {
  const record = useRecordObservation();
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const results = useStudentSearch(query, { enabled: query.length >= 2 });

  const [traitId, setTraitId] = useState('');
  const [rating, setRating] = useState(3);
  const [note, setNote] = useState('');

  const valid = Boolean(student && traitId && rating > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record an observation</DialogTitle>
          <DialogDescription>
            A short note now is worth more than a guess at the end of term.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="obs-student" required>
              Student
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search by name or admission number…"
                />
                {results.data && results.data.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {results.data.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => setStudent({ id: match.id, name: match.fullName })}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {match.fullName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {match.admissionNo}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-trait" required>
              Trait
            </Label>
            <NativeSelect
              id="obs-trait"
              value={traitId}
              onChange={(event) => setTraitId(event.target.value)}
            >
              <option value="">Select a trait</option>
              {traits.map((trait) => (
                <option key={trait.id} value={trait.id}>
                  {trait.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Rating</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-pressed={rating === value}
                  className={cn(
                    'size-10 rounded-md border text-sm font-medium transition-colors',
                    rating === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="obs-note">Note</Label>
            <Textarea
              id="obs-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What happened? One sentence is enough."
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={record.isPending}
            disabled={!valid}
            onClick={() =>
              student &&
              void record
                .mutateAsync({
                  studentId: student.id,
                  traitId,
                  rating,
                  note: note.trim() || undefined,
                })
                .then(() => {
                  onOpenChange(false);
                  setStudent(null);
                  setNote('');
                })
            }
          >
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TraitDialog({
  state,
  scales,
  onClose,
}: {
  state: { open: boolean; trait?: BehaviourTrait };
  scales: { value: string; label: string }[];
  onClose: () => void;
}) {
  const save = useSaveBehaviourTrait();
  const [name, setName] = useState(state.trait?.name ?? '');
  const [category, setCategory] = useState<BehaviourTrait['category']>(
    state.trait?.category ?? 'AFFECTIVE',
  );
  const [scaleId, setScaleId] = useState(state.trait?.scaleId ?? scales[0]?.value ?? '');
  const [description, setDescription] = useState(state.trait?.description ?? '');
  const [appearsOnReportCard, setAppears] = useState(state.trait?.appearsOnReportCard ?? true);
  const [isActive, setIsActive] = useState(state.trait?.isActive ?? true);

  const valid = name.trim() && scaleId;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.trait ? 'Edit trait' : 'New behaviour trait'}</DialogTitle>
          <DialogDescription>
            Traits are yours to define. Nothing about punctuality or neatness is built into the
            software.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="trait-name" required>
              Name
            </Label>
            <Input
              id="trait-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Punctuality"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="trait-category">Category</Label>
              <NativeSelect
                id="trait-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as BehaviourTrait['category'])
                }
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {humanizeEnum(option)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trait-scale" required>
                Rating scale
              </Label>
              <NativeSelect
                id="trait-scale"
                value={scaleId}
                onChange={(event) => setScaleId(event.target.value)}
              >
                {scales.map((scale) => (
                  <option key={scale.value} value={scale.value}>
                    {scale.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trait-description">Description</Label>
            <Textarea
              id="trait-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={appearsOnReportCard}
                onChange={(event) => setAppears(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Show this trait on report cards
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Active
            </label>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.trait?.id,
                  values: {
                    name: name.trim(),
                    category,
                    scaleId,
                    description: description.trim() || null,
                    appearsOnReportCard,
                    isActive,
                  },
                })
                .then(onClose)
            }
          >
            Save trait
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
