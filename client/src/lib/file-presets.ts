/**
 * What the product accepts for upload, and the check that runs before a byte
 * leaves the device. The server re-validates independently — this copy exists
 * to give the user an answer without a round trip, not to be the authority.
 */

export interface UploadTarget {
  /** Server-generated object path. The client never chooses the file name. */
  storagePath: string;
  uploadUrl?: string | null;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

export interface UploadedFile {
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export const FILE_PRESETS = {
  image: {
    accept: 'image/png,image/jpeg,image/webp',
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
    label: 'PNG, JPG or WebP up to 5 MB',
  },
  document: {
    accept: 'application/pdf,image/png,image/jpeg',
    mimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    maxBytes: DEFAULT_MAX_BYTES,
    label: 'PDF, PNG or JPG up to 10 MB',
  },
  spreadsheet: {
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxBytes: 20 * 1024 * 1024,
    label: 'Excel workbook (.xlsx) up to 20 MB',
  },
} as const;

export type FilePreset = keyof typeof FILE_PRESETS;

export class FileValidationError extends Error {}

/**
 * Client-side validation is a courtesy that saves a doomed upload; the server
 * re-checks MIME type, extension and size before it accepts the object.
 */
export function validateFile(file: File, preset: FilePreset): void {
  const { mimeTypes, maxBytes, label } = FILE_PRESETS[preset];
  if (file.size > maxBytes) {
    throw new FileValidationError(`"${file.name}" is too large. Accepted: ${label}.`);
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeOk = (mimeTypes as readonly string[]).includes(file.type);
  // Windows reports several MIME types for .xlsx depending on what is
  // installed, so the extension is the reliable signal for workbooks.
  const extensionOk = preset === 'spreadsheet' ? extension === 'xlsx' : mimeOk;
  if (!mimeOk && !extensionOk) {
    throw new FileValidationError(`"${file.name}" is not an accepted file type. Accepted: ${label}.`);
  }
}

export interface FileStorage {
  upload(params: {
    file: File;
    purpose: string;
    entityId?: string;
    preset: FilePreset;
    options?: UploadOptions;
  }): Promise<UploadedFile>;
}
