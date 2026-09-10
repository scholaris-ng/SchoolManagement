import { useState } from 'react';
import { useCurrentTerm, useTerms } from '@/features/academics/api';
import { useCurricula } from './api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';

/**
 * Pieces used by `schemes-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function GenerateSchemeDialog({
  open,
  onOpenChange,
  onGenerate,
  generating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (input: { curriculumId: string; classId: string; termId: string }) => Promise<void>;
  generating: boolean;
}) {
  const curricula = useCurricula();
  const terms = useTerms();
  const currentTerm = useCurrentTerm();

  const [curriculumId, setCurriculumId] = useState('');
  const [termId, setTermId] = useState('');

  // The class is the curriculum's own; asking again could only produce a
  // scheme for a class the plan was never written for.
  const curriculum = curricula.data?.find((entry) => entry.id === curriculumId);
  const effectiveTermId = termId || currentTerm.data?.id || '';
  const term = terms.data?.find((entry) => entry.id === effectiveTermId);
  const valid = Boolean(curriculum && effectiveTermId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Generate a draft scheme of work</DialogTitle>
          <DialogDescription>
            Objectives from the curriculum are spread across the term&rsquo;s teaching weeks. It is
            a starting point — you can reorder, merge and rewrite every week afterwards.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gen-curriculum" required>
              Curriculum
            </Label>
            <NativeSelect
              data-cy="gen-curriculum"
              id="gen-curriculum"
              value={curriculumId}
              onChange={(event) => setCurriculumId(event.target.value)}
            >
              <option value="">Select a curriculum</option>
              {(curricula.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.subjectName} · {entry.className} ({entry.objectiveCount} objectives)
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {curriculum
                ? `Written by ${curriculum.createdByName} for ${curriculum.className}.`
                : 'Each curriculum already names the class it was written for.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gen-term" required>
              Term
            </Label>
            <NativeSelect
              data-cy="gen-term"
              id="gen-term"
              value={effectiveTermId}
              onChange={(event) => setTermId(event.target.value)}
            >
              <option value="">Select a term</option>
              {(terms.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.sessionName} ({entry.teachingWeeks} weeks)
                </option>
              ))}
            </NativeSelect>
          </div>

          {term && (
            <Alert tone="info">
              {term.name} has {term.teachingWeeks} teaching weeks. The draft will use those dates,
              not a generic twelve-week assumption.
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button data-cy="curriculum-schemes-cancel" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-cy="curriculum-schemes-generate-draft"
            loading={generating}
            loadingLabel="Generating…"
            disabled={!valid}
            onClick={() =>
              void onGenerate({
                curriculumId,
                classId: curriculum?.classId ?? '',
                termId: effectiveTermId,
              })
            }
          >
            Generate draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
