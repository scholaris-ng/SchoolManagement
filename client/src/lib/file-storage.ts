import { getFirebaseStorage } from './firebase';
import { FirebaseFileStorage } from './file-storage-firebase';
import { LocalFileStorage } from './file-storage-local';
import type { FileStorage } from './file-presets';

/**
 * File storage abstraction (`IFileStorage` in ARCHITECTURE.md).
 *
 * Split into the presets and the two implementations so no file outgrows the
 * limit in section 17 of the frontend guide; this barrel picks one and keeps a
 * single import path for callers.
 */
export {
  FILE_PRESETS,
  FileValidationError,
  validateFile,
  type FilePreset,
  type FileStorage,
  type UploadOptions,
  type UploadTarget,
  type UploadedFile,
} from './file-presets';

export const fileStorage: FileStorage = getFirebaseStorage()
  ? new FirebaseFileStorage()
  : new LocalFileStorage();
