import multer from 'multer';
import { AppError } from '../errors/AppError';

/**
 * A single in-memory file upload, size- and type-checked before a route ever
 * sees it. Kept in memory rather than written to disk: every caller so far
 * hands the buffer straight to object storage and never needs it again.
 */
export function singleFileUpload(field: string, allowedMimeTypes: readonly string[], maxSizeBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(AppError.validation('That file type is not accepted.'));
        return;
      }
      cb(null, true);
    },
  }).single(field);
}
