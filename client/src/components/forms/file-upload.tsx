import { useCallback, useRef, useState } from 'react';
import { File as FileIcon, Image as ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/format';
import {
  FILE_PRESETS,
  FileValidationError,
  fileStorage,
  validateFile,
  type FilePreset,
  type UploadedFile,
} from '@/lib/file-storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/primitives';

export interface FileUploadProps {
  preset: FilePreset;
  /** Groups the object server-side and drives the storage path, e.g. `student-photo`. */
  purpose: string;
  entityId?: string;
  label?: string;
  description?: string;
  value?: { url: string; name?: string } | null;
  onUploaded: (file: UploadedFile) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
  /** Renders a round preview suitable for a photograph. */
  variant?: 'dropzone' | 'avatar';
}

/**
 * Upload control used for student photographs, admission documents, evidence
 * and school branding. Validation happens before a byte leaves the device, and
 * the server independently re-validates and names the object.
 */
export function FileUpload({
  preset,
  purpose,
  entityId,
  label = 'Upload a file',
  description,
  value,
  onUploaded,
  onRemove,
  disabled,
  className,
  variant = 'dropzone',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const config = FILE_PRESETS[preset];

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        validateFile(file, preset);
        setProgress(0);
        const uploaded = await fileStorage.upload({
          file,
          purpose,
          entityId,
          preset,
          options: { onProgress: setProgress },
        });
        onUploaded(uploaded);
      } catch (cause) {
        setError(
          cause instanceof FileValidationError
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : 'Upload failed. Please try again.',
        );
      } finally {
        setProgress(null);
      }
    },
    [preset, purpose, entityId, onUploaded],
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void upload(file);
  };

  if (variant === 'avatar') {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {value?.url ? (
            <img src={value.url} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-muted-foreground">
              <ImageIcon className="size-6" aria-hidden="true" />
            </span>
          )}
          {progress !== null && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/60 text-xs font-semibold text-white">
              {progress}%
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || progress !== null}
            >
              <UploadCloud />
              {value?.url ? 'Replace' : 'Upload'}
            </Button>
            {value?.url && onRemove && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description ?? config.label}</p>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-subtle' : 'border-border bg-muted/30',
          disabled && 'opacity-60',
        )}
      >
        {value?.url ? (
          <div className="flex items-center gap-3 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-card text-muted-foreground">
              <FileIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{value.name ?? 'Uploaded file'}</p>
              <a
                href={value.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Open
              </a>
            </div>
            {onRemove && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove file">
                <Trash2 />
              </Button>
            )}
          </div>
        ) : progress !== null ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Uploading…</p>
            <Progress value={progress} showLabel />
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description ?? config.label}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              Choose file
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
        disabled={disabled}
      />
    </div>
  );
}

export { formatFileSize };
