import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/AppError';
import { getCloudinary, isCloudinaryConfigured } from '../../infrastructure/storage/cloudinaryClient';

export interface StoredFile {
  /** The HTTPS CDN address — the only thing that leaves the server. */
  url: string;
  publicId: string;
}

/** Cloudinary public ids allow letters, digits, `-` and `_`; anything else is folded to `-`. */
function slug(text: string): string {
  return text.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
}

/**
 * The only layer that talks to Cloudinary (`server_arch.md` section 20).
 *
 * A file is stored under a random, unguessable name. The link is public — it
 * has to be, to open from a WhatsApp message with no sign-in — so what keeps a
 * family's invoice from being found is that its address cannot be worked out
 * from an invoice number, not that anything checks who is asking.
 */
export class StorageService {
  static Instance = new StorageService();

  private constructor() {}

  /**
   * Stores a PDF and returns its public link.
   *
   * Uploaded as a `raw` asset: a PDF is delivered as-is, with no image
   * pipeline in front of it. The extension is part of a raw asset's public id,
   * which is also what makes the link end in `.pdf` and open in a viewer.
   */
  async uploadPdf(buffer: Buffer, params: { folder: string; name: string }): Promise<StoredFile> {
    if (!isCloudinaryConfigured()) {
      throw new AppError(
        'Sharing by link is not set up on this server, so nothing was uploaded. Ask whoever runs the system to add the Cloudinary settings.',
        503,
        'STORAGE_NOT_CONFIGURED',
      );
    }

    const publicId = `${params.folder}/${slug(params.name)}-${randomBytes(16).toString('hex')}.pdf`;
    const cloudinary = getCloudinary();

    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', public_id: publicId, overwrite: false, type: 'upload' },
        (error, result) => {
          if (error || !result) {
            console.error('[storage] Cloudinary upload failed:', error);
            reject(
              new AppError(
                'The document could not be uploaded. Please try again.',
                502,
                'STORAGE_UPLOAD_FAILED',
              ),
            );
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }
}
