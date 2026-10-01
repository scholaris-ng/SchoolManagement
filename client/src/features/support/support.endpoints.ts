import { http } from '@/lib/http';
import type { PlatformSupportSettings } from '@/types/platform';

export const SupportEndpoints = {
  /** The WhatsApp number the widget sends to, or null until a platform administrator sets one. */
  fetchSettings: () => http.get<PlatformSupportSettings>('/platform/support-settings'),
};
