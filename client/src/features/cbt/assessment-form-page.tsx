import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toDateTimeInputValue } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { useClassOptions, useSubjectOptions, useTermOptions } from '@/features/academics/api';
import { useAssessment, useQuestions, useSaveAssessment } from './api';
import { assessmentFormSchema, type AssessmentFormValues } from './schema';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/primitives';
import { FormActions, FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import {
  DateTimeField,
  FormSection,
  MultiSelectField,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
} from '@/components/forms/form-field';
import { Alert, LoadingState } from '@/components/ui/feedback';

const MODE_OPTIONS = [
  { value: 'PRACTICE', label: 'Practice' },
  { value: 'EXAM', label: 'Examination' },
];

const emptyValues: AssessmentFormValues = {
  title: '',
  mode: 'PRACTICE',
  subjectId: '',
  classIds: [],
  termId: '',
  questionIds: [],
  durationMinutes: 30,
  attemptsAllowed: 1,
  startsAt: '',
  endsAt: '',
  shuffleQuestions: true,
  shuffleOptions: true,
  showResultImmediately: true,
  passScore: 50,
};

/** Building a paper from the question bank, or changing one nobody has sat yet. */
export function AssessmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const existing = useAssessment(id);
  const saveAssessment = useSaveAssessment();

  const subjectOptions = useSubjectOptions();
  const classOptions = useClassOptions();
  const termOptions = useTermOptions();

  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!existing.data) return;
    const paper = existing.data;
    form.reset({
      title: paper.title,
      mode: paper.mode,
      subjectId: paper.subjectId,
      classIds: paper.classIds,
      termId: paper.termId,
      questionIds: paper.questionIds,
      durationMinutes: paper.durationMinutes,
      attemptsAllowed: paper.attemptsAllowed,
      startsAt: toDateTimeInputValue(paper.startsAt),
      endsAt: toDateTimeInputValue(paper.endsAt),
      shuffleQuestions: paper.shuffleQuestions,
      shuffleOptions: paper.shuffleOptions,
      showResultImmediately: paper.showResultImmediately,
      passScore: paper.passScore,
    });
  }, [existing.data, form]);

  // A paper's questions all come from one subject, so the picker below is
  // scoped to whichever one is chosen, and its selections are dropped the
  // moment that changes rather than silently carrying over questions from a
  // different subject.
  const subjectId = form.watch('subjectId');
  const questions = useQuestions({ subjectId: subjectId || undefined, pageSize: 200 });
  const questionOptions = (questions.data?.items ?? []).map((question) => ({
    value: question.id,
    label: question.text,
    description: `${humanizeEnum(question.type)} · ${question.marks} mark${question.marks === 1 ? '' : 's'} · ${humanizeEnum(question.difficulty)}`,
  }));

  const locked = isEdit && (existing.data?.submissionCount ?? 0) > 0;

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      title: values.title.trim(),
      mode: values.mode,
      subjectId: values.subjectId,
      classIds: values.classIds,
      termId: values.termId,
      questionIds: values.questionIds,
      durationMinutes: values.durationMinutes,
      attemptsAllowed: values.attemptsAllowed,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
      shuffleQuestions: values.shuffleQuestions,
      shuffleOptions: values.shuffleOptions,
      showResultImmediately: values.showResultImmediately,
      passScore: values.passScore,
    };
    try {
      const assessment = isEdit
        ? await saveAssessment.mutateAsync({ id, values: payload, version: existing.data?.version })
        : await saveAssessment.mutateAsync({ values: payload });
      navigate(`/cbt/${assessment.id}`);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          form.setError(field as keyof AssessmentFormValues, { message });
        }
      }
    }
  });

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={isEdit ? `Edit ${existing.data?.title ?? 'assessment'}` : 'New assessment'}
        description="Build a paper from the question bank, then open it to a class."
        breadcrumbs={[
          { label: 'CBT', to: '/cbt' },
          ...(isEdit && existing.data
            ? [{ label: existing.data.title, to: `/cbt/${id}` }, { label: 'Edit' }]
            : [{ label: 'New assessment' }]),
        ]}
      />

      {isEdit && existing.isPending ? (
        <LoadingState label="Loading assessment…" />
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <UnsavedChangesGuard when={form.formState.isDirty && !saveAssessment.isPending} />

          <Card>
            <CardContent className="space-y-8 pt-5">
              <FormError error={saveAssessment.error} />

              {locked && (
                <Alert tone="warning" title="Questions and timing are locked">
                  {existing.data?.submissionCount} pupil
                  {existing.data?.submissionCount === 1 ? ' has' : 's have'} already sat this paper,
                  so its questions and timing can no longer change. Saving below will fail until
                  that stops being true.
                </Alert>
              )}

              <FormSection title="Paper" columns={2}>
                <TextField
                  control={form.control}
                  name="title"
                  label="Title"
                  required
                  placeholder="e.g. Mid-term test — Algebra"
                />
                <SelectField
                  control={form.control}
                  name="mode"
                  label="Mode"
                  required
                  options={MODE_OPTIONS}
                  native
                />
                <SelectField
                  control={form.control}
                  name="subjectId"
                  label="Subject"
                  required
                  options={subjectOptions}
                  onValueChange={() => form.setValue('questionIds', [], { shouldDirty: true })}
                />
                <SelectField
                  control={form.control}
                  name="termId"
                  label="Term"
                  required
                  options={termOptions}
                />
              </FormSection>

              <FormSection title="Who can sit it" columns={1}>
                <MultiSelectField
                  control={form.control}
                  name="classIds"
                  label="Classes"
                  required
                  options={classOptions}
                  emptyLabel="No classes defined yet — add them under Academic setup."
                />
              </FormSection>

              <FormSection
                title="Questions"
                description="Pulled from the question bank for the subject chosen above."
                columns={1}
              >
                {subjectId ? (
                  <MultiSelectField
                    control={form.control}
                    name="questionIds"
                    label="Questions"
                    required
                    columns={1}
                    options={questionOptions}
                    emptyLabel="No questions for this subject yet — add some to the question bank first."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Choose a subject above to pick its questions.
                  </p>
                )}
              </FormSection>

              <FormSection title="Timing" columns={2}>
                <NumberField
                  control={form.control}
                  name="durationMinutes"
                  label="Time allowed"
                  required
                  min={1}
                  max={600}
                  hint="Minutes"
                />
                <NumberField
                  control={form.control}
                  name="attemptsAllowed"
                  label="Attempts allowed"
                  required
                  min={1}
                  max={20}
                />
                <DateTimeField
                  control={form.control}
                  name="startsAt"
                  label="Opens"
                  hint="Leave blank to open as soon as it's published."
                />
                <DateTimeField
                  control={form.control}
                  name="endsAt"
                  label="Closes"
                  hint="Leave blank for no deadline."
                />
              </FormSection>

              <FormSection title="Marking" columns={2}>
                <NumberField
                  control={form.control}
                  name="passScore"
                  label="Pass mark"
                  required
                  min={0}
                  max={100}
                  hint="Percent"
                />
              </FormSection>

              <FormSection title="Behaviour" columns={1}>
                <SwitchField
                  control={form.control}
                  name="shuffleQuestions"
                  label="Shuffle question order"
                  description="Each student sees the questions in a different order."
                />
                <SwitchField
                  control={form.control}
                  name="shuffleOptions"
                  label="Shuffle answer options"
                  description="Each student sees multiple-choice options in a different order."
                />
                <SwitchField
                  control={form.control}
                  name="showResultImmediately"
                  label="Show result immediately"
                  description="Students see their score and the correct answers as soon as they submit."
                />
              </FormSection>
            </CardContent>

            <FormActions
              onCancel={() => navigate(isEdit ? `/cbt/${id}` : '/cbt')}
              submitLabel={isEdit ? 'Save changes' : 'Create assessment'}
              loading={saveAssessment.isPending}
              dirty={form.formState.isDirty}
            />
          </Card>
        </form>
      )}
    </PageContainer>
  );
}
