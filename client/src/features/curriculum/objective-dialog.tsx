import { useState } from 'react';
import {
  useSaveObjective,
} from './api';
import {
  BLOOM_LEVELS,
  BLOOM_UNSET,
  bloom,
  type BloomLevel,
} from './bloom';
import type { LearningObjective } from '@/types/curriculum';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ObjectiveDialog({
  state,
  save,
  onClose,
}: {
  state: { open: boolean; topicId?: string; objective?: LearningObjective };
  save: ReturnType<typeof useSaveObjective>;
  onClose: () => void;
}) {
  const [statement, setStatement] = useState(state.objective?.statement ?? '');
  const [bloomLevel, setBloomLevel] = useState<string>(
    state.objective?.bloomLevel ?? BLOOM_UNSET,
  );

  const chosen = bloomLevel === BLOOM_UNSET ? null : bloom(bloomLevel as BloomLevel);

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.objective ? 'Edit objective' : 'New objective'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="objective-statement" required>
              Statement
            </Label>
            <Textarea
              data-cy="objective-statement"
              id="objective-statement"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="e.g. Define photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="objective-bloom">Thinking level</Label>
            <Select
              data-cy="objective-bloom"
              id="objective-bloom"
              value={bloomLevel}
              onValueChange={setBloomLevel}
              aria-label="Thinking level"
              options={[
                {
                  value: BLOOM_UNSET,
                  label: 'Not set',
                  description: 'Decide later',
                },
                ...BLOOM_LEVELS.map((level) => ({
                  value: level.value,
                  label: level.label,
                  description: level.hint,
                })),
              ]}
            />
            {/* The verbs are what a teacher actually recognises their own
                objective by, so they matter more here than the definition. */}
            <p className="text-xs text-muted-foreground">
              {chosen ? (
                <>
                  How hard this makes a child think. Usually written as{' '}
                  <span className="font-medium text-foreground">
                    {chosen.verbs.slice(0, 3).join(', ')}
                  </span>
                  . For example: {chosen.example}
                </>
              ) : (
                'Optional. Tagging how hard each objective makes a child think is what shows whether a syllabus trains recall or reasoning.'
              )}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="curriculum-detail-cancel-2" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="curriculum-detail-save-2"
            loading={save.isPending}
            disabled={!statement.trim() || !state.topicId}
            onClick={() =>
              state.topicId &&
              void save
                .mutateAsync({
                  topicId: state.topicId,
                  id: state.objective?.id,
                  values: {
                    statement: statement.trim(),
                    bloomLevel:
                      bloomLevel === BLOOM_UNSET
                        ? null
                        : (bloomLevel as LearningObjective['bloomLevel']),
                  },
                })
                .then(onClose)
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
