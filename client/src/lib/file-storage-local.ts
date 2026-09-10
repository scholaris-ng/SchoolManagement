import { validateFile } from './file-presets';
import type { FilePreset, FileStorage, UploadOptions, UploadedFile } from './file-presets';


/**
 * Development stand-in: produces an object URL so upload previews and forms
 * behave normally without a Storage bucket. Never used in production builds.
 */
export class LocalFileStorage implements FileStorage {
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
