import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';
import { http } from './http';
import { validateFile } from './file-presets';
import type {
  FilePreset,
  FileStorage,
  UploadOptions,
  UploadTarget,
  UploadedFile,
} from './file-presets';

/**
 * Uploads go straight from the browser to Firebase Storage, but the *metadata*
 * and the authorisation to hold it are registered with the API, which is where
 * schoolId, uploader and access rules live (spec section 3).
 */

export class FirebaseFileStorage implements FileStorage {
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
