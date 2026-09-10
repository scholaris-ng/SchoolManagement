import { useState } from 'react';
import { Plus, Sparkles, Star } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import {
  useBehaviourObservations,
  useBehaviourScales,
  useBehaviourTraits,
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
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { RatingDots, ObservationDialog, TraitDialog } from './behaviour-page-parts';



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
              <Button data-cy="behaviour-new-trait" variant="outline" onClick={() => setTraitDialog({ open: true })}>
                <Plus />
                New trait
              </Button>
            )}
            {canRecord && (
              <Button data-cy="behaviour-record-an-observation" onClick={() => setObserveOpen(true)}>
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
                        data-cy="behaviour-edit"
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
                data-cy="behaviour-trait-id"
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
