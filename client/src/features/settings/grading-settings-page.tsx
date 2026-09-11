import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLevels } from '@/features/academics/api';
import { useGradingSchemes, useSaveGradingScheme } from '@/features/results/api';
import type { AssessmentComponent, GradeBand, GradingScheme } from '@/types/results';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Alert, EmptyState, LoadingState } from '@/components/ui/feedback';
import { SettingsTabs } from './settings-tabs';

/**
 * Grading, defined per school.
 *
 * One school weights CA 40 / exam 60, another 30 / 70, another runs a different
 * scheme for its primary section entirely. None of that is baked in: components,
 * maxima, boundaries and remarks all live here (spec section 19).
 */
export function GradingSettingsPage() {
  const schemes = useGradingSchemes();
  const levels = useLevels();
  const save = useSaveGradingScheme();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GradingScheme | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!schemes.data || schemes.data.length === 0) return;
    const scheme = schemes.data.find((entry) => entry.id === selectedId) ?? schemes.data[0];
    setSelectedId(scheme.id);
    setDraft(structuredClone(scheme));
    setDirty(false);
  }, [schemes.data, selectedId]);

  const componentTotal = (draft?.components ?? []).reduce(
    (sum, component) => sum + component.maxScore,
    0,
  );
  const caTotal = (draft?.components ?? [])
    .filter((component) => component.type === 'CONTINUOUS_ASSESSMENT')
    .reduce((sum, component) => sum + component.maxScore, 0);

  const bandsCoverRange = () => {
    if (!draft) return true;
    const sorted = [...draft.bands].sort((a, b) => a.minScore - b.minScore);
    if (sorted.length === 0) return false;
    if (sorted[0].minScore !== 0) return false;
    if (sorted[sorted.length - 1].maxScore < componentTotal) return false;
    return sorted.every(
      (band, index) => index === 0 || band.minScore === sorted[index - 1].maxScore + 1,
    );
  };

  const update = (patch: Partial<GradingScheme>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  const updateComponent = (index: number, patch: Partial<AssessmentComponent>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            components: current.components.map((component, i) =>
              i === index ? { ...component, ...patch } : component,
            ),
          }
        : current,
    );
    setDirty(true);
  };

  const updateBand = (index: number, patch: Partial<GradeBand>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            bands: current.bands.map((band, i) => (i === index ? { ...band, ...patch } : band)),
          }
        : current,
    );
    setDirty(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Grading"
        description="Assessment components, weighting and grade boundaries — your school's, not ours."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Grading' }]}
        actions={
          <Button
            data-cy="settings-grading-settings-save-scheme"
            onClick={() =>
              draft && void save.mutateAsync({ id: draft.id, values: draft }).then(() => setDirty(false))
            }
            loading={save.isPending}
            disabled={!dirty || !bandsCoverRange()}
          >
            <Save />
            Save scheme
          </Button>
        }
      />

      <SettingsTabs />

      {schemes.isPending ? (
        <LoadingState label="Loading grading schemes…" />
      ) : (schemes.data?.length ?? 0) === 0 || !draft ? (
        <Card>
          <EmptyState
            icon={<Plus />}
            title="No grading scheme yet"
            description="A grading scheme defines how scores add up to a grade. Create one before entering results."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scheme-picker">Scheme</Label>
              <NativeSelect
                data-cy="scheme-picker"
                id="scheme-picker"
                value={selectedId ?? ''}
                onChange={(event) => setSelectedId(event.target.value)}
                className="w-auto"
              >
                {schemes.data?.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.name}
                    {scheme.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {draft.levelNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {draft.levelNames.map((levelName) => (
                  <Badge key={levelName} tone="neutral">
                    {levelName}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Assessment components</CardTitle>
              <CardDescription>
                What a term&rsquo;s total is made of. Continuous assessment and the exam add up to{' '}
                <strong>{componentTotal}</strong> marks — CA is {caTotal}, the exam is{' '}
                {componentTotal - caTotal}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.components.map((component, index) => (
                <div
                  key={component.id}
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr,8rem,10rem,auto] sm:items-end"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`component-name-${component.id}`}>Name</Label>
                    <Input
                      data-cy="grading-settings-name"
                      id={`component-name-${component.id}`}
                      value={component.name}
                      onChange={(event) => updateComponent(index, { name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`component-max-${component.id}`}>Max score</Label>
                    <Input
                      data-cy="grading-settings-max-score"
                      id={`component-max-${component.id}`}
                      type="number"
                      min={1}
                      value={component.maxScore}
                      onChange={(event) =>
                        updateComponent(index, { maxScore: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`component-type-${component.id}`}>Type</Label>
                    <NativeSelect
                      data-cy="grading-settings-type"
                      id={`component-type-${component.id}`}
                      value={component.type}
                      onChange={(event) =>
                        updateComponent(index, {
                          type: event.target.value as AssessmentComponent['type'],
                        })
                      }
                    >
                      <option value="CONTINUOUS_ASSESSMENT">Continuous assessment</option>
                      <option value="EXAM">Examination</option>
                    </NativeSelect>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-cy={`grading-component-remove-${index}`}
                    aria-label={`Remove ${component.name}`}
                    onClick={() => {
                      update({
                        components: draft.components.filter((_, i) => i !== index),
                      });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}

              <Button
                data-cy="settings-grading-settings-add-a-component"
                variant="outline"
                onClick={() =>
                  update({
                    components: [
                      ...draft.components,
                      {
                        id: `new-${Date.now()}`,
                        schoolId: draft.schoolId,
                        schemeId: draft.id,
                        name: 'New component',
                        code: 'NEW',
                        maxScore: 10,
                        sequence: draft.components.length + 1,
                        type: 'CONTINUOUS_ASSESSMENT',
                      },
                    ],
                  })
                }
              >
                <Plus />
                Add a component
              </Button>

              {componentTotal !== 100 && (
                <Alert tone="info">
                  Components total {componentTotal}, not 100. That is fine — grade boundaries below
                  are checked against {componentTotal}, not a percentage.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grade boundaries</CardTitle>
              <CardDescription>
                Every score from 0 to {componentTotal} must fall in exactly one band.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...draft.bands]
                .sort((a, b) => b.minScore - a.minScore)
                .map((band) => {
                  const index = draft.bands.findIndex((entry) => entry.id === band.id);
                  return (
                    <div
                      key={band.id}
                      className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[5rem,6rem,6rem,1fr,auto,auto] sm:items-end"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`band-label-${band.id}`}>Grade</Label>
                        <Input
                          data-cy="grading-settings-label"
                          id={`band-label-${band.id}`}
                          value={band.label}
                          onChange={(event) => updateBand(index, { label: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`band-min-${band.id}`}>From</Label>
                        <Input
                          data-cy="grading-settings-min-score"
                          id={`band-min-${band.id}`}
                          type="number"
                          min={0}
                          value={band.minScore}
                          onChange={(event) =>
                            updateBand(index, { minScore: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`band-max-${band.id}`}>To</Label>
                        <Input
                          data-cy="grading-settings-max-score-2"
                          id={`band-max-${band.id}`}
                          type="number"
                          value={band.maxScore}
                          onChange={(event) =>
                            updateBand(index, { maxScore: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`band-remark-${band.id}`}>Remark</Label>
                        <Input
                          data-cy="grading-settings-remark"
                          id={`band-remark-${band.id}`}
                          value={band.remark}
                          onChange={(event) => updateBand(index, { remark: event.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-sm">
                        <input
                          data-cy="grading-settings-is-pass"
                          type="checkbox"
                          checked={band.isPass}
                          onChange={(event) => updateBand(index, { isPass: event.target.checked })}
                          className="size-4 rounded border-input"
                        />
                        Pass
                      </label>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-cy={`grading-band-remove-${band.id}`}
                        aria-label={`Remove grade ${band.label}`}
                        onClick={() =>
                          update({ bands: draft.bands.filter((entry) => entry.id !== band.id) })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}

              <Button
                data-cy="settings-grading-settings-add-a-grade"
                variant="outline"
                onClick={() =>
                  update({
                    bands: [
                      ...draft.bands,
                      {
                        id: `band-${Date.now()}`,
                        label: 'X',
                        minScore: 0,
                        maxScore: 0,
                        remark: '',
                        isPass: false,
                        gradePoint: null,
                        color: null,
                      },
                    ],
                  })
                }
              >
                <Plus />
                Add a grade
              </Button>

              {!bandsCoverRange() && (
                <Alert tone="danger" title="The bands do not cover every score">
                  Bands must start at 0, reach {componentTotal}, and not leave gaps or overlap. A
                  score that falls between two bands would have no grade at all.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheme options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="scheme-name">Scheme name</Label>
                  <Input
                    data-cy="scheme-name"
                    id="scheme-name"
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheme-pass">Pass mark</Label>
                  <Input
                    data-cy="scheme-pass"
                    id="scheme-pass"
                    type="number"
                    min={0}
                    max={componentTotal}
                    value={draft.passMark}
                    onChange={(event) => update({ passMark: Number(event.target.value) })}
                  />
                </div>
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Applies to levels</legend>
                <div className="scrollbar-thin grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-2">
                  {(levels.data ?? []).map((level) => (
                    <label key={level.id} className="flex items-center gap-2 text-sm">
                      <input
                        data-cy="grading-settings-id"
                        type="checkbox"
                        checked={draft.levelIds.includes(level.id)}
                        onChange={() =>
                          update({
                            levelIds: draft.levelIds.includes(level.id)
                              ? draft.levelIds.filter((entry) => entry !== level.id)
                              : [...draft.levelIds, level.id],
                          })
                        }
                        className="size-4 rounded border-input"
                      />
                      {level.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-start justify-between gap-4 py-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Show class position on report cards</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Some schools deliberately hide ranking for younger children.
                  </p>
                </div>
                <Switch
                  data-cy="grading-settings-show-position"
                  checked={draft.showPosition}
                  onCheckedChange={(value) => update({ showPosition: value })}
                  aria-label="Show class position"
                />
              </div>
            </CardContent>
          </Card>

          <div
            className={cn(
              'rounded-lg border p-4 text-sm',
              bandsCoverRange() ? 'border-border bg-muted/40' : 'border-danger/40 bg-danger-subtle',
            )}
          >
            <p className="font-medium">Worked example</p>
            <p className="mt-1 text-muted-foreground">
              A student scoring {Math.round(componentTotal * 0.72)} out of {componentTotal} gets{' '}
              <strong>
                {draft.bands.find(
                  (band) =>
                    Math.round(componentTotal * 0.72) >= band.minScore &&
                    Math.round(componentTotal * 0.72) <= band.maxScore,
                )?.label ?? 'no grade — check your bands'}
              </strong>
              .
            </p>
          </div>
        </>
      )}
    </PageContainer>
  );
}
