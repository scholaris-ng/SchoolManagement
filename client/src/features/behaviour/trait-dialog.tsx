import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import {
  useSaveBehaviourTrait,
} from './api';
import type { BehaviourTrait } from '@/types/behaviour';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea, Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CATEGORIES } from './behaviour-page-constants';

export function TraitDialog({
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
              data-cy="trait-name"
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
                data-cy="trait-category"
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
                data-cy="trait-scale"
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
              data-cy="trait-description"
              id="trait-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                data-cy="behaviour-appears-on-report-card"
                type="checkbox"
                checked={appearsOnReportCard}
                onChange={(event) => setAppears(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Show this trait on report cards
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                data-cy="behaviour-is-active"
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
          <Button data-cy="behaviour-cancel-2" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="behaviour-save-trait"
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
