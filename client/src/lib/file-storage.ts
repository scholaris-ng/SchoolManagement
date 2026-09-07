import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';
import { http } from './http';

/**
 * File storage abstraction (`IFileStorage` in ARCHITECTURE.md).
 *
 * Uploads go straight from the browser to Firebase Storage, but the *metadata*
 * and the authorisation to hold it are registered with the API, which is where
 * schoolId, uploader and access rules live (spec section 3).
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
    accept: '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxBytes: 20 * 1024 * 1024,
    label: 'CSV or XLSX up to 20 MB',
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
  const extensionOk =
    preset === 'spreadsheet' ? ['csv', 'xlsx', 'xls'].includes(extension) : mimeOk;
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

class FirebaseFileStorage implements FileStorage {
  async upload({
    file,
    purpose,
    entityId,
    preset,
    options,
  }: {
    file: File;
    purpose: string;
    entityId?: string;
    preset: FilePreset;
    options?: UploadOptions;
  }): Promise<UploadedFile> {
    validateFile(file, preset);

    // The API decides where the object may live and checks the caller is
    // allowed to write it for this school.
    const target = await http.post<UploadTarget>('/files/upload-target', {
      purpose,
      entityId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    const storage = getFirebaseStorage();
    if (!storage) throw new Error('Firebase Storage is not configured.');

    const objectRef = ref(storage, target.storagePath);
    const task = uploadBytesResumable(objectRef, file, {
      contentType: file.type,
      customMetadata: { purpose, originalName: file.name },
    });

    options?.signal?.addEventListener('abort', () => task.cancel(), { once: true });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          options?.onProgress?.(percent);
        },
        reject,
        () => resolve(),
      );
    });

    const downloadUrl = await getDownloadURL(objectRef);

    return {
      storagePath: target.storagePath,
      downloadUrl,
      mimeType: file.type,
      sizeBytes: file.size,
      originalName: file.name,
    };
  }
}

/**
 * Development stand-in: produces an object URL so upload previews and forms
 * behave normally without a Storage bucket. Never used in production builds.
 */
class LocalFileStorage implements FileStorage {
  async upload({
    file,
    purpose,
    preset,
    options,
  }: {
    file: File;
    purpose: string;
    entityId?: string;
    preset: FilePreset;
    options?: UploadOptions;
  }): Promise<UploadedFile> {
    validateFile(file, preset);
    for (const percent of [15, 45, 80, 100]) {
      await new Promise((resolve) => setTimeout(resolve, 90));
      options?.onProgress?.(percent);
    }
    return {
      storagePath: `local/${purpose}/${crypto.randomUUID()}-${file.name}`,
      downloadUrl: URL.createObjectURL(file),
      mimeType: file.type,
      sizeBytes: file.size,
      originalName: file.name,
    };
  }
}

export const fileStorage: FileStorage = getFirebaseStorage()
  ? new FirebaseFileStorage()
  : new LocalFileStorage();
