import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, Send, ShieldCheck, Trash2, Undo2 } from 'lucide-react';
import { formatDateTime, toDateInputValue } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useDeleteLessonNote, useLessonNote, useSaveLessonNote, useScheme, useSchemes } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, LoadingState } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { RichTextEditor } from '@/components/forms/rich-text-editor';

const SCHEME_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
};

interface NoteDraft {
  schemeId: string;
  schemeWeekId: string;
  date: string;
  content: string;
  assignment: string;
  challenges: string;
  studentDifficulties: string;
}

const emptyDraft: NoteDraft = {
  schemeId: '',
  schemeWeekId: '',
  date: toDateInputValue(new Date()),
  content: '',
  assignment: '',
  challenges: '',
  studentDifficulties: '',
};

function SummaryField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );
}

/**
 * Writing and reviewing a lesson note.
 *
 * A note documents one week of a scheme of work someone already wrote — class,
 * subject, topic and teaching resources all come from that week rather than
 * being typed again, so a note can never drift from the plan it claims to
 * follow. The two fields that make a note worth anything to a head of
 * department are "what did not work" and "what students found hard" — so they
 * are given the same prominence as the lesson content itself, not buried at
 * the bottom.
 */
export function LessonNoteFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, membership } = useAuth();
  const isEdit = Boolean(id) && id !== 'new';

  const existing = useLessonNote(isEdit ? id : undefined);
  const save = useSaveLessonNote(isEdit ? id : undefined);
  const deleteNote = useDeleteLessonNote();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [draft, setDraft] = useState<NoteDraft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  // RichTextEditor only reads its starting content once, on mount — see its
  // own doc comment. Loading an existing note is an async fetch that
  // resolves after that first mount, so the editor needs to be recreated
  // once it does; bumping this remounts it (via `key`) with the note's real
  // content instead of the empty draft it started with.
  const [contentKey, setContentKey] = useState(0);

  // Only a new note needs the scheme picker — an existing one already carries
  // its own class, subject, topic and resources, snapshotted at creation.
  const schemes = useSchemes({ pageSize: 100 });
  const scheme = useScheme(!isEdit ? draft.schemeId || undefined : undefined);
  const weekOptions = (scheme.data?.weeks ?? []).filter((week) => !week.isBreak);
  const selectedWeek = weekOptions.find((week) => week.id === draft.schemeWeekId);

  useEffect(() => {
    if (!existing.data) return;
    const note = existing.data;
    setDraft({
      schemeId: note.schemeId,
      schemeWeekId: note.schemeWeekId,
      date: toDateInputValue(note.date),
      content: note.content,
      assignment: note.assignment ?? '',
      challenges: note.challenges ?? '',
      studentDifficulties: note.studentDifficulties ?? '',
    });
    setReviewComment(note.reviewComment ?? '');
    setDirty(false);
    setContentKey((key) => key + 1);
  }, [existing.data]);

  const update = (patch: Partial<NoteDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const valid = Boolean(draft.schemeId && draft.schemeWeekId && draft.content.trim());

  const submit = async (status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED') => {
    const note = await save.mutateAsync({
      values: {
        schemeId: draft.schemeId,
        schemeWeekId: draft.schemeWeekId,
        date: draft.date,
        content: draft.content.trim(),
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
        <PageHeader loading title="" breadcrumbs={[{ label: 'Lesson notes', to: '/lesson-notes' }]} />
        <LoadingState label="Loading lesson note…" />
      </PageContainer>
    );
  }

  const note = existing.data;
  const editable = !note || note.status === 'DRAFT' || note.status === 'RETURNED';
  const canReview = Boolean(note && note.status === 'SUBMITTED' && can('lessonnote.approve'));
  // Stricter than editing: the author, or a coordinator — the same line
  // curricula draw between "may change it" and "may remove it outright".
  const canDelete = Boolean(
    note &&
      can('lessonnote.manage') &&
      (can('academics.manage') || note.teacherId === membership?.staffId),
  );

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
            {canDelete && (
              <Button
                data-cy="curriculum-lesson-note-form-delete"
                variant="outline"
                className="text-danger hover:text-danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Delete
              </Button>
            )}
            {editable && can('lessonnote.manage') && (
              <>
                <Button
                  data-cy="curriculum-lesson-note-form-save-draft"
                  variant="outline"
                  onClick={() => void submit()}
                  loading={save.isPending}
                  disabled={!valid}
                >
                  <Save />
                  Save draft
                </Button>
                <Button
                  data-cy="curriculum-lesson-note-form-submit"
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
                  data-cy="curriculum-lesson-note-form-return"
                  variant="outline"
                  onClick={() => void submit('RETURNED')}
                  loading={save.isPending}
                >
                  <Undo2 />
                  Return
                </Button>
                <Button data-cy="curriculum-lesson-note-form-approve" onClick={() => void submit('APPROVED')} loading={save.isPending}>
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

          {isEdit ? (
            <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-2">
              <SummaryField label="Class" value={note?.className} />
              <SummaryField label="Subject" value={note?.subjectName} />
              <SummaryField label="Topic" value={note?.topic} />
              <SummaryField label="Week" value={note ? `Week ${note.weekNumber}` : undefined} />
              {note?.resources && (
                <div className="sm:col-span-2">
                  <SummaryField label="Teaching resources" value={note.resources} />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="note-scheme" required>
                    Scheme of work
                  </Label>
                  <NativeSelect
                    data-cy="note-scheme"
                    id="note-scheme"
                    value={draft.schemeId}
                    onChange={(event) => update({ schemeId: event.target.value, schemeWeekId: '' })}
                  >
                    <option value="">Select a scheme</option>
                    {(schemes.data?.items ?? []).map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.className} · {entry.subjectName} · {entry.termName} (
                        {SCHEME_STATUS_LABEL[entry.status] ?? entry.status})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note-week" required>
                    Week
                  </Label>
                  <NativeSelect
                    data-cy="note-week"
                    id="note-week"
                    value={draft.schemeWeekId}
                    disabled={!draft.schemeId || scheme.isPending}
                    onChange={(event) => update({ schemeWeekId: event.target.value })}
                  >
                    <option value="">{draft.schemeId ? 'Select a week' : 'Pick a scheme first'}</option>
                    {weekOptions.map((week) => (
                      <option key={week.id} value={week.id}>
                        Week {week.weekNumber} — {week.topicTitle}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {!schemes.isPending && (schemes.data?.items.length ?? 0) === 0 && (
                <Alert
                  tone="warning"
                  title="No schemes of work yet"
                  action={
                    <Button data-cy="curriculum-lesson-note-form-view-schemes" asChild variant="outline" size="sm">
                      <Link to="/schemes">View schemes</Link>
                    </Button>
                  }
                >
                  A lesson note documents a week from a scheme of work. Generate or open one first.
                </Alert>
              )}

              {selectedWeek && (
                <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-2">
                  <SummaryField label="Class" value={scheme.data?.className} />
                  <SummaryField label="Subject" value={scheme.data?.subjectName} />
                  <SummaryField label="Topic" value={selectedWeek.topicTitle} />
                  {selectedWeek.resources && (
                    <div className="sm:col-span-2">
                      <SummaryField label="Teaching resources" value={selectedWeek.resources} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="note-date" required>
              Date taught
            </Label>
            <Input
              data-cy="note-date"
              id="note-date"
              type="date"
              className="max-w-xs"
              value={draft.date}
              disabled={!editable}
              onChange={(event) => update({ date: event.target.value })}
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

          <div className="space-y-1.5">
            <Label htmlFor="note-assignment">Assignment set</Label>
            <RichTextEditor
              key={contentKey}
              id="note-assignment"
              defaultValue={draft.assignment}
              readOnly={!editable}
              onChange={(html) => update({ assignment: html })}
              placeholder="What you're asking students to do before the next lesson."
            />
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
            <RichTextEditor
              key={contentKey}
              id="note-challenges"
              defaultValue={draft.challenges}
              readOnly={!editable}
              onChange={(html) => update({ challenges: html })}
              placeholder="Not enough apparatus, class too large, power cut during the video…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-difficulties">Where students struggled</Label>
            <RichTextEditor
              key={contentKey}
              id="note-difficulties"
              defaultValue={draft.studentDifficulties}
              readOnly={!editable}
              onChange={(html) => update({ studentDifficulties: html })}
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
              data-cy="note-review"
              id="note-review"
              rows={3}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Required when returning a note, optional when approving."
            />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this lesson note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteNote.isPending}
        onConfirm={async () => {
          if (!note) return;
          await deleteNote.mutateAsync(note.id);
          setDirty(false);
          navigate('/lesson-notes');
        }}
      />
    </PageContainer>
  );
}
