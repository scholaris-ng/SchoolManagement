import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';

/**
 * The one place the Cloudinary SDK is configured (`server_arch.md` section 20).
 *
 * Configured on first use rather than at import: Cloudinary is optional in
 * local development, and the process must still start without its credentials.
 * Callers check `isCloudinaryConfigured()` first, for the same reason
 * `getFirebaseApp` guards Firebase — a clear refusal beats an SDK failure.
 */
let configured = false;

export function isCloudinaryConfigured(): boolean {
  return env.cloudinary.configured;
}

export function getCloudinary(): typeof cloudinary {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}
