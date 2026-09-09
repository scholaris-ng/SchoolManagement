import { useState } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import { formatDate, formatFileSize } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAddStudentDocument, useDeleteStudentDocument, useStudentDocuments } from '../api';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { FileUpload } from '@/components/forms/file-upload';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';
import type { StudentDocument } from '@/types/people';

const CATEGORIES: { value: StudentDocument['category']; label: string }[] = [
  { value: 'BIRTH_CERTIFICATE', label: 'Birth certificate' },
  { value: 'PREVIOUS_RESULT', label: 'Previous result' },
  { value: 'MEDICAL', label: 'Medical record' },
  { value: 'PHOTO', label: 'Photograph' },
  { value: 'TRANSFER', label: 'Transfer certificate' },
  { value: 'OTHER', label: 'Other' },
];

export function StudentDocumentsTab({ studentId }: { studentId: string }) {
  const documents = useStudentDocuments(studentId);
  const addDocument = useAddStudentDocument(studentId);
  const deleteDocument = useDeleteStudentDocument(studentId);
  const [category, setCategory] = useState<StudentDocument['category']>('BIRTH_CERTIFICATE');
  const [pendingDelete, setPendingDelete] = useState<StudentDocument | null>(null);

  if (documents.isPending) return <LoadingState label="Loading documents…" />;
  if (documents.isError) {
    return <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />;
  }

  const rows = documents.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText />}
              title="No documents on file"
              description="Birth certificates, previous results and medical records can be stored here."
            />
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Documents on file</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {rows.map((document) => (
                  <li key={document.id} className="flex items-center gap-3 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{document.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatFileSize(document.sizeBytes)} · uploaded by {document.uploadedByName}{' '}
                        on {formatDate(document.uploadedAt)}
                      </p>
                    </div>
                    <Badge tone="neutral" className="hidden sm:inline-flex">
                      {humanizeEnum(document.category)}
                    </Badge>
                    {document.downloadUrl && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        data-cy={`student-document-open-${document.id}`}
                      >
                        <a
                          href={document.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${document.name}`}
                        >
                          <Download />
                        </a>
                      </Button>
                    )}
                    <PermissionGate require="student.update">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-cy={`student-document-delete-${document.id}`}
                        onClick={() => setPendingDelete(document)}
                        aria-label={`Delete ${document.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </PermissionGate>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <PermissionGate require="student.update">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add a document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="document-category">Category</Label>
              <NativeSelect
                data-cy="document-category"
                id="document-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as StudentDocument['category'])
                }
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <FileUpload
              preset="document"
              purpose="student-document"
              entityId={studentId}
              label="Upload a document"
              onUploaded={(file) =>
                addDocument.mutate({
                  name: file.originalName,
                  category,
                  storagePath: file.storagePath,
                  downloadUrl: file.downloadUrl,
                  mimeType: file.mimeType,
                  sizeBytes: file.sizeBytes,
                })
              }
            />
          </CardContent>
        </Card>
      </PermissionGate>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this document?"
        description={`"${pendingDelete?.name}" will be permanently removed from the student's file.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteDocument.isPending}
        onConfirm={async () => {
          if (pendingDelete) await deleteDocument.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
