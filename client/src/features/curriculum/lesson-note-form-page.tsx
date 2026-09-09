import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Send, ShieldCheck, Undo2 } from 'lucide-react';
import { formatDateTime, toDateInputValue } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses, useCurrentTerm, useSubjects } from '@/features/academics/api';
import { useLessonNote, useSaveLessonNote } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, LoadingState } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { RichTextEditor } from '@/components/forms/rich-text-editor';

interface NoteDraft {
  classId: string;
  subjectId: string;
  termId: string;
  weekNumber: number;
  date: string;
  topic: string;
  content: string;
  resources: string;
  assignment: string;
  challenges: string;
  studentDifficulties: string;
}

const emptyDraft: NoteDraft = {
  classId: '',
  subjectId: '',
  termId: '',
  weekNumber: 1,
  date: toDateInputValue(new Date()),
  topic: '',
  content: '',
  resources: '',
  assignment: '',
  challenges: '',
  studentDifficulties: '',
};

/**
 * Writing and reviewing a lesson note.
 *
 * The two fields that make this worth anything to a head of department are
 * "what did not work" and "what students found hard" — so they are given the
 * same prominence as the lesson content itself, not buried at the bottom.
 */
export function LessonNoteFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const isEdit = Boolean(id) && id !== 'new';

  const existing = useLessonNote(isEdit ? id : undefined);
  const save = useSaveLessonNote(isEdit ? id : undefined);

  const classes = useClasses();
  const subjects = useSubjects();
  const currentTerm = useCurrentTerm();

  const [draft, setDraft] = useState<NoteDraft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  // RichTextEditor only reads its starting content once, on mount — see its
  // own doc comment. Loading an existing note is an async fetch that
  // resolves after that first mount, so the editor needs to be recreated
  // once it does; bumping this remounts it (via `key`) with the note's real
  // content instead of the empty draft it started with.
  const [contentKey, setContentKey] = useState(0);

  useEffect(() => {
    if (!existing.data) return;
    const note = existing.data;
    setDraft({
      classId: note.classId,
      subjectId: note.subjectId,
      termId: note.termId,
      weekNumber: note.weekNumber,
      date: toDateInputValue(note.date),
      topic: note.topic,
      content: note.content,
      resources: note.resources ?? '',
      assignment: note.assignment ?? '',
      challenges: note.challenges ?? '',
      studentDifficulties: note.studentDifficulties ?? '',
    });
    setReviewComment(note.reviewComment ?? '');
    setDirty(false);
    setContentKey((key) => key + 1);
  }, [existing.data]);

  useEffect(() => {
    if (!isEdit && currentTerm.data && !draft.termId) {
      setDraft((current) => ({ ...current, termId: currentTerm.data!.id }));
    }
  }, [currentTerm.data, isEdit, draft.termId]);

  const update = (patch: Partial<NoteDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const valid = Boolean(draft.classId && draft.subjectId && draft.topic.trim() && draft.content.trim());

  const submit = async (status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED') => {
    const note = await save.mutateAsync({
      values: {
        classId: draft.classId,
        subjectId: draft.subjectId,
        termId: draft.termId,
        weekNumber: draft.weekNumber,
        date: draft.date,
        topic: draft.topic.trim(),
        content: draft.content.trim(),
        resources: draft.resources.trim() || null,
        assignment: draft.assignment.trim() || null,
        challenges: draft.challenges.trim() || null,
        studentDifficulties: draft.studentDifficulties.trim() || null,
        ...(status ? { status } : {}),
        ...(status === 'APPROVED' || status === 'RETURNED'
          ? { reviewComment: reviewComment.trim() || null }
          : {}),
      },
      version: existing.data?.version,
    });
    setDirty(false);
    if (!isEdit) navigate(`/lesson-notes/${note.id}`);
  };

  if (isEdit && existing.isPending) {
    return (
      <PageContainer width="narrow">
        <LoadingState label="Loading lesson note…" />
      </PageContainer>
    );
  }

  const note = existing.data;
  const editable = !note || note.status === 'DRAFT' || note.status === 'RETURNED';
  const canReview = Boolean(note && note.status === 'SUBMITTED' && can('lessonnote.approve'));

  return (
    <PageContainer width="narrow">
      <UnsavedChangesGuard when={dirty && !save.isPending} />

      <PageHeader
        title={isEdit ? note?.topic || 'Lesson note' : 'New lesson note'}
        description={
          note ? `${note.subjectName} · ${note.className} · week ${note.weekNumber}` : undefined
        }
        breadcrumbs={[
          { label: 'Lesson notes', to: '/lesson-notes' },
          { label: isEdit ? (note?.topic ?? 'Note') : 'New' },
        ]}
        meta={
          note && (
            <>
              <StatusBadge status={note.status} />
              <span className="text-xs text-muted-foreground">{note.teacherName}</span>
              {note.reviewedAt && (
                <span className="text-xs text-muted-foreground">
                  Reviewed by {note.reviewerName} · {formatDateTime(note.reviewedAt)}
                </span>
              )}
            </>
          )
        }
        actions={
          <>
            {editable && can('lessonnote.manage') && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void submit()}
                  loading={save.isPending}
                  disabled={!valid}
                >
                  <Save />
                  Save draft
                </Button>
                <Button
                  onClick={() => void submit('SUBMITTED')}
                  loading={save.isPending}
                  disabled={!valid}
                >
                  <Send />
                  Submit
                </Button>
              </>
            )}
            {canReview && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void submit('RETURNED')}
                  loading={save.isPending}
                >
                  <Undo2 />
                  Return
                </Button>
                <Button onClick={() => void submit('APPROVED')} loading={save.isPending}>
                  <ShieldCheck />
                  Approve
                </Button>
              </>
            )}
          </>
        }
      />

      {note?.status === 'RETURNED' && note.reviewComment && (
        <Alert tone="warning" title="Returned for revision">
          {note.reviewComment}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>The lesson</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={save.error} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-class" required>
                Class
              </Label>
              <NativeSelect
                id="note-class"
                value={draft.classId}
                disabled={!editable}
                onChange={(event) => update({ classId: event.target.value })}
              >
                <option value="">Select a class</option>
                {(classes.data ?? []).map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-subject" required>
                Subject
              </Label>
              <NativeSelect
                id="note-subject"
                value={draft.subjectId}
                disabled={!editable}
                onChange={(event) => update({ subjectId: event.target.value })}
              >
                <option value="">Select a subject</option>
                {(subjects.data ?? []).map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-date" required>
                Date taught
              </Label>
              <Input
                id="note-date"
                type="date"
                value={draft.date}
                disabled={!editable}
                onChange={(event) => update({ date: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-week">Week</Label>
              <Input
                id="note-week"
                type="number"
                min={1}
                max={20}
                value={draft.weekNumber}
                disabled={!editable}
                onChange={(event) => update({ weekNumber: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-topic" required>
              Topic
            </Label>
            <Input
              id="note-topic"
              value={draft.topic}
              disabled={!editable}
              onChange={(event) => update({ topic: event.target.value })}
              placeholder="e.g. Photosynthesis — raw materials and word equation"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-content" required>
              What you taught
            </Label>
            <RichTextEditor
              key={contentKey}
              id="note-content"
              defaultValue={draft.content}
              readOnly={!editable}
              onChange={(html) => update({ content: html })}
              placeholder="The lesson itself: explanation, examples, board work, experiments."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-resources">Teaching resources</Label>
              <Textarea
                id="note-resources"
                rows={3}
                value={draft.resources}
                disabled={!editable}
                onChange={(event) => update({ resources: event.target.value })}
                placeholder="Textbook pages, charts, apparatus."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-assignment">Assignment set</Label>
              <Textarea
                id="note-assignment"
                rows={3}
                value={draft.assignment}
                disabled={!editable}
                onChange={(event) => update({ assignment: event.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What was hard</CardTitle>
          <p className="text-sm text-muted-foreground">
            The part a head of department cannot get from a timetable. Be honest — this is how a
            school spots a topic that needs reteaching before the exam.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="note-challenges">Challenges you met</Label>
            <Textarea
              id="note-challenges"
              rows={4}
              value={draft.challenges}
              disabled={!editable}
              onChange={(event) => update({ challenges: event.target.value })}
              placeholder="Not enough apparatus, class too large, power cut during the video…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-difficulties">Where students struggled</Label>
            <Textarea
              id="note-difficulties"
              rows={4}
              value={draft.studentDifficulties}
              disabled={!editable}
              onChange={(event) => update({ studentDifficulties: event.target.value })}
              placeholder="Which concept, and roughly how many of the class."
            />
          </div>
        </CardContent>
      </Card>

      {canReview && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label htmlFor="note-review">Comment to the teacher</Label>
            <Textarea
              id="note-review"
              rows={3}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Required when returning a note, optional when approving."
            />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
