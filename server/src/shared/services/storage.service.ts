import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/AppError';
import { getCloudinary, isCloudinaryConfigured } from '../../infrastructure/storage/cloudinaryClient';

export interface StoredFile {
  /** The HTTPS CDN address — the only thing that leaves the server. */
  url: string;
  publicId: string;
}

/** An image uploads through Cloudinary's image pipeline; anything else goes through untouched. */
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg']);

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/** Cloudinary public ids allow letters, digits, `-` and `_`; anything else is folded to `-`. */
function slug(text: string): string {
  return text.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
}

/**
 * The only layer that talks to Cloudinary (`server_arch.md` section 20).
 *
 * A file is stored under a random, unguessable name. The link is public — it
 * has to be, to open from a WhatsApp message with no sign-in — so what keeps a
 * family's invoice (or a payment slip) from being found is that its address
 * cannot be worked out from an invoice number, not that anything checks who
 * is asking.
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
    return this.upload(buffer, { ...params, extension: 'pdf', resourceType: 'raw' });
  }

  /**
   * Stores a family's photo or PDF of a payment slip and returns its link.
   * Images go through Cloudinary's `image` pipeline, everything else (a
   * scanned PDF) through `raw` — same unguessable-public-id scheme as
   * `uploadPdf`.
   */
  async uploadReceipt(
    buffer: Buffer,
    params: { folder: string; name: string; mimeType: string },
  ): Promise<StoredFile> {
    return this.upload(buffer, {
      folder: params.folder,
      name: params.name,
      extension: EXTENSION_BY_MIME[params.mimeType] ?? 'bin',
      resourceType: IMAGE_MIME_TYPES.has(params.mimeType) ? 'image' : 'raw',
    });
  }

  private async upload(
    buffer: Buffer,
    params: { folder: string; name: string; extension: string; resourceType: 'raw' | 'image' },
  ): Promise<StoredFile> {
    if (!isCloudinaryConfigured()) {
      throw new AppError(
        'File uploads are not set up on this server. Ask whoever runs the system to add the Cloudinary settings.',
        503,
        'STORAGE_NOT_CONFIGURED',
      );
    }

    const publicId = `${params.folder}/${slug(params.name)}-${randomBytes(16).toString('hex')}.${params.extension}`;
    const cloudinary = getCloudinary();

    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: params.resourceType, public_id: publicId, overwrite: false, type: 'upload' },
        (error, result) => {
          if (error || !result) {
            console.error('[storage] Cloudinary upload failed:', error);
            reject(
              new AppError('The file could not be uploaded. Please try again.', 502, 'STORAGE_UPLOAD_FAILED'),
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
