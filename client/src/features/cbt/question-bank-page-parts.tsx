import { useState } from 'react';
import type { Question, QuestionOption, QuestionType } from '@/types/assessment';
import { Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TYPE_OPTIONS, DIFFICULTY_OPTIONS, OPTION_LABELS } from './question-bank-page-constants';

/**
 * Pieces used by `question-bank-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function QuestionDialog({
  state,
  subjects,
  saving,
  onClose,
  onSave,
}: {
  state: { open: boolean; question?: Question };
  subjects: { value: string; label: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: Partial<Question>) => Promise<void>;
}) {
  const [text, setText] = useState(state.question?.text ?? '');
  const [subjectId, setSubjectId] = useState(state.question?.subjectId ?? '');
  const [type, setType] = useState<QuestionType>(state.question?.type ?? 'MULTIPLE_CHOICE');
  const [difficulty, setDifficulty] = useState(state.question?.difficulty ?? 'MEDIUM');
  const [marks, setMarks] = useState(String(state.question?.marks ?? 1));
  const [explanation, setExplanation] = useState(state.question?.explanation ?? '');
  const [shortAnswer, setShortAnswer] = useState(state.question?.correctAnswer ?? '');
  const [options, setOptions] = useState<QuestionOption[]>(
    state.question?.options.length
      ? state.question.options
      : [
          { id: 'opt-a', label: 'A', text: '', isCorrect: true },
          { id: 'opt-b', label: 'B', text: '', isCorrect: false },
          { id: 'opt-c', label: 'C', text: '', isCorrect: false },
          { id: 'opt-d', label: 'D', text: '', isCorrect: false },
        ],
  );

  const effectiveOptions: QuestionOption[] =
    type === 'TRUE_FALSE'
      ? [
          { id: 'opt-true', label: 'A', text: 'True', isCorrect: options[0]?.isCorrect ?? true },
          { id: 'opt-false', label: 'B', text: 'False', isCorrect: !(options[0]?.isCorrect ?? true) },
        ]
      : options;

  const valid =
    text.trim() &&
    subjectId &&
    (type === 'SHORT_ANSWER'
      ? shortAnswer.trim()
      : effectiveOptions.filter((option) => option.text.trim()).length >= 2 &&
        effectiveOptions.some((option) => option.isCorrect));

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{state.question ? 'Edit question' : 'New question'}</DialogTitle>
          <DialogDescription>
            Objective questions are marked automatically. Short answers are marked by a teacher.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-text" required>
              Question
            </Label>
            <Textarea
              data-cy="q-text"
              id="q-text"
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-subject" required>
                Subject
              </Label>
              <NativeSelect
                data-cy="q-subject"
                id="q-subject"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Select</option>
                {subjects.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-type">Type</Label>
              <NativeSelect
                data-cy="q-type"
                id="q-type"
                value={type}
                onChange={(event) => setType(event.target.value as QuestionType)}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-difficulty">Difficulty</Label>
              <NativeSelect
                data-cy="q-difficulty"
                id="q-difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as Question['difficulty'])}
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-marks">Marks</Label>
              <Input
                data-cy="q-marks"
                id="q-marks"
                type="number"
                min={1}
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
              />
            </div>
          </div>

          {type === 'SHORT_ANSWER' ? (
            <div className="space-y-1.5">
              <Label htmlFor="q-answer" required>
                Expected answer
              </Label>
              <Input
                data-cy="q-answer"
                id="q-answer"
                value={shortAnswer}
                onChange={(event) => setShortAnswer(event.target.value)}
                placeholder="What a correct answer should contain"
              />
            </div>
          ) : type === 'TRUE_FALSE' ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Correct answer</legend>
              {['True', 'False'].map((label, index) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    data-cy="cbt-question-bank-is-correct"
                    type="radio"
                    name="true-false"
                    checked={index === 0 ? (options[0]?.isCorrect ?? true) : !(options[0]?.isCorrect ?? true)}
                    onChange={() =>
                      setOptions([
                        { id: 'opt-true', label: 'A', text: 'True', isCorrect: index === 0 },
                        { id: 'opt-false', label: 'B', text: 'False', isCorrect: index !== 0 },
                      ])
                    }
                    className="size-4"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Options <span className="font-normal text-muted-foreground">(mark the correct one)</span>
              </legend>
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    data-cy="cbt-question-bank-is-correct-2"
                    type="radio"
                    name="correct-option"
                    checked={option.isCorrect}
                    aria-label={`Option ${OPTION_LABELS[index]} is correct`}
                    onChange={() =>
                      setOptions((current) =>
                        current.map((entry, i) => ({ ...entry, isCorrect: i === index })),
                      )
                    }
                    className="size-4 shrink-0"
                  />
                  <span className="w-5 shrink-0 text-sm font-medium text-muted-foreground">
                    {OPTION_LABELS[index]}
                  </span>
                  <Input
                    data-cy="cbt-question-bank-text"
                    value={option.text}
                    aria-label={`Option ${OPTION_LABELS[index]}`}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, text: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="q-explanation">Explanation</Label>
            <Textarea
              data-cy="q-explanation"
              id="q-explanation"
              rows={2}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="Shown to students after a practice attempt."
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button data-cy="cbt-question-bank-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="cbt-question-bank-save-question"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              void onSave({
                text: text.trim(),
                subjectId,
                type,
                difficulty: difficulty as Question['difficulty'],
                marks: Number(marks) || 1,
                explanation: explanation.trim() || null,
                correctAnswer: type === 'SHORT_ANSWER' ? shortAnswer.trim() : null,
                options: type === 'SHORT_ANSWER' ? [] : effectiveOptions,
              })
            }
          >
            Save question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
