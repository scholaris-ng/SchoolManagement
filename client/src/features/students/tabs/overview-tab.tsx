import { AlertTriangle, GraduationCap } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { Student } from '@/types/people';
import { useStudentEnrollments } from '../api';
import { DetailRow } from '../student-detail-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, EmptyState, LoadingState } from '@/components/ui/feedback';

export function StudentOverviewTab({ student }: { student: Student }) {
  const enrollments = useStudentEnrollments(student.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <DetailRow label="Full name" value={student.fullName} />
              <DetailRow label="Admission number" value={student.admissionNo} />
              <DetailRow label="Gender" value={student.gender === 'MALE' ? 'Male' : 'Female'} />
              <DetailRow label="Date of birth" value={formatDate(student.dateOfBirth)} />
              <DetailRow label="Nationality" value={student.nationality} />
              <DetailRow label="State of origin" value={student.stateOfOrigin} />
              <DetailRow label="Religion" value={student.religion} />
              <DetailRow label="Home address" value={student.address} className="sm:col-span-2" />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrolment history</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollments.isPending ? (
              <LoadingState label="Loading enrolment history…" />
            ) : (enrollments.data?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<GraduationCap />}
                title="No enrolment records yet"
                description="Each session the student is enrolled in appears here, preserving their academic history."
              />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {enrollments.data?.map((enrollment) => (
                  <li key={enrollment.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{enrollment.className}</p>
                      <StatusBadge status={enrollment.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {enrollment.sessionName}
                      {enrollment.termName ? ` · ${enrollment.termName}` : ''} ·{' '}
                      {enrollment.levelName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Enrolled {formatDate(enrollment.enrolledOn)}
                      {enrollment.exitedOn ? ` — left ${formatDate(enrollment.exitedOn)}` : ''}
                    </p>
                    {enrollment.note && (
                      <p className="mt-1 text-xs text-muted-foreground">{enrollment.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Placement</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label="Class" value={student.currentClassName} />
              <DetailRow label="Level" value={student.currentLevelName} />
              <DetailRow label="House" value={student.houseName} />
              <DetailRow label="Admission date" value={formatDate(student.admissionDate)} />
              <DetailRow label="Status" value={<StatusBadge status={student.status} />} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health and emergency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl>
              <DetailRow label="Blood group" value={student.bloodGroup} />
              <DetailRow label="Emergency contact" value={student.emergencyContactName} />
              <DetailRow label="Emergency phone" value={student.emergencyContactPhone} />
            </dl>
            {student.medicalNotes ? (
              <Alert tone="warning" title="Medical notes" icon={<AlertTriangle />}>
                {student.medicalNotes}
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">No medical notes recorded.</p>
            )}
          </CardContent>
        </Card>

        {!student.photoConsent && student.photoUrl && (
          <Alert tone="info" title="Photo consent not given">
            The photograph on file is hidden from the public website, the news feed and printed
            documents.
          </Alert>
        )}
      </div>
    </div>
  );
}
