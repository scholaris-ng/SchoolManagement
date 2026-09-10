import { useState } from 'react';
import {
  useSaveTopic,
} from './api';
import type { CurriculumTopic } from '@/types/curriculum';
import {
  Label,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Pieces used by `curriculum-detail-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function TopicDialog({
  state,
  save,
  nextSequence,
  onClose,
}: {
  state: { open: boolean; topic?: CurriculumTopic };
  save: ReturnType<typeof useSaveTopic>;
  nextSequence: number;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(state.topic?.title ?? '');
  const [description, setDescription] = useState(state.topic?.description ?? '');
  const [sequence, setSequence] = useState(String(state.topic?.sequence ?? nextSequence));
  const [suggestedWeeks, setSuggestedWeeks] = useState(String(state.topic?.suggestedWeeks ?? 1));

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.topic ? 'Edit topic' : 'New topic'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic-title" required>
              Title
            </Label>
            <Input
              data-cy="topic-title"
              id="topic-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Photosynthesis"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-description">Description</Label>
            <Textarea
              data-cy="topic-description"
              id="topic-description"
              value={description ?? ''}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic-sequence" required>
                Sequence
              </Label>
              <Input
                data-cy="topic-sequence"
                id="topic-sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(event) => setSequence(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-weeks">Suggested weeks</Label>
              <Input
                data-cy="topic-weeks"
                id="topic-weeks"
                type="number"
                min={1}
                value={suggestedWeeks}
                onChange={(event) => setSuggestedWeeks(event.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-cy="curriculum-detail-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="curriculum-detail-save"
            loading={save.isPending}
            disabled={!title.trim()}
            onClick={() =>
              void save
                .mutateAsync({
                  id: state.topic?.id,
                  values: {
                    title: title.trim(),
                    description: description.trim() || null,
                    sequence: Number(sequence) || nextSequence,
                    suggestedWeeks: Number(suggestedWeeks) || 1,
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

/**
 * How the objectives are spread across the six Bloom levels.
 *
 * Coverage answers "did we teach it?". This answers the question a coverage
 * percentage cannot: "what were we asking them to do?" A syllabus fully taught
 * but written entirely at Remember and Understand looks finished and is not,
 * and the exam is the wrong place to discover that.
 */
