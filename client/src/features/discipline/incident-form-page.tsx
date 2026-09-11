import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStudentSearch } from '@/features/students/api';
import { useReportIncident } from './api';
import type { DisciplineIncident } from '@/types/behaviour';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, SearchInput, Textarea } from '@/components/ui/input';
import { FileUpload } from '@/components/forms/file-upload';
import { Alert } from '@/components/ui/feedback';
import { FormError } from '@/components/forms/form-actions';

const CATEGORIES = [
  'Lateness',
  'Absence without permission',
  'Uniform',
  'Disruption in class',
  'Rudeness to staff',
  'Fighting',
  'Bullying',
  'Damage to property',
  'Examination misconduct',
  'Other',
];

const SEVERITIES: DisciplineIncident['severity'][] = ['MINOR', 'MODERATE', 'MAJOR', 'SEVERE'];

interface EvidenceFile {
  name: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
}

/**
 * Reporting an incident.
 *
 * Written to be filled in soon after the event by whoever saw it, so the fields
 * are the ones a person actually remembers: who, what, when, where — and any
 * evidence, before it disappears.
 */
export function IncidentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const report = useReportIncident();

  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(
    searchParams.get('studentId')
      ? { id: searchParams.get('studentId')!, name: 'Selected student' }
      : null,
  );
  const results = useStudentSearch(query, { enabled: query.length >= 2 });

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [severity, setSeverity] = useState<DisciplineIncident['severity']>('MINOR');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('');
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);

  const valid = Boolean(student && category && description.trim().length >= 10 && occurredAt);

  const submit = async () => {
    if (!student || !valid) return;
    const incident = await report.mutateAsync({
      studentId: student.id,
      category,
      severity,
      description: description.trim(),
      occurredAt: new Date(occurredAt).toISOString(),
      location: location.trim() || undefined,
      evidence,
    });
    navigate(`/discipline/${incident.id}`);
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Report an incident"
        description="Record what happened while it is fresh. A reviewer decides what action follows."
        breadcrumbs={[{ label: 'Discipline', to: '/discipline' }, { label: 'New incident' }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>What happened</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={report.error} />

          <div className="space-y-1.5">
            <Label htmlFor="incident-student" required>
              Student
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>
                <Button data-cy="discipline-incident-form-change" variant="ghost" size="sm" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  data-cy="discipline-incident-form-query"
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search by name or admission number…"
                  isSearching={results.isSearching}
                />
                {results.data && results.data.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {results.data.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          data-cy={`incident-student-result-${match.id}`}
                          onClick={() => setStudent({ id: match.id, name: match.fullName })}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {match.fullName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {match.admissionNo}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="incident-category" required>
                Category
              </Label>
              <NativeSelect
                data-cy="incident-category"
                id="incident-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="incident-severity" required>
                Severity
              </Label>
              <NativeSelect
                data-cy="incident-severity"
                id="incident-severity"
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value as DisciplineIncident['severity'])
                }
              >
                {SEVERITIES.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="incident-when" required>
                When it happened
              </Label>
              <Input
                data-cy="incident-when"
                id="incident-when"
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="incident-where">Where</Label>
              <Input
                data-cy="incident-where"
                id="incident-where"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Assembly ground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="incident-description" required>
              What happened
            </Label>
            <Textarea
              data-cy="incident-description"
              id="incident-description"
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Facts, not conclusions: what you saw or were told, and by whom."
            />
            <p className="text-xs text-muted-foreground">
              This becomes part of a child&rsquo;s permanent record. Write what happened, not what
              you assume about them.
            </p>
          </div>

          {severity === 'SEVERE' && (
            <Alert tone="warning" title="Severe incidents are escalated immediately">
              A senior member of staff is notified as soon as you submit, and the guardian is
              contacted according to your school&rsquo;s policy.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FileUpload
            preset="document"
            purpose="discipline-evidence"
            label="Attach a photograph or document"
            description="Optional. Anything that supports the report — a photograph of damage, a written statement."
            onUploaded={(file) =>
              setEvidence((current) => [
                ...current,
                {
                  name: file.originalName,
                  storagePath: file.storagePath,
                  downloadUrl: file.downloadUrl,
                  mimeType: file.mimeType,
                },
              ])
            }
          />
          {evidence.length > 0 && (
            <ul className="space-y-1 text-sm">
              {evidence.map((file, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="min-w-0 truncate">{file.name}</span>
                  <Button
                    data-cy="discipline-incident-form-remove"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEvidence((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button data-cy="discipline-incident-form-cancel" variant="outline" onClick={() => navigate('/discipline')}>
          Cancel
        </Button>
        <Button data-cy="discipline-incident-form-submit-report" onClick={() => void submit()} loading={report.isPending} disabled={!valid}>
          Submit report
        </Button>
      </div>
    </PageContainer>
  );
}
