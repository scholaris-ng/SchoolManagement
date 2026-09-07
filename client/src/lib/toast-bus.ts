/**
 * A tiny pub/sub so non-React modules (the query client, the offline queue)
 * can raise user feedback without importing React or a provider.
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs: number;
  action?: ToastAction;
}

export type ToastInput = Omit<ToastMessage, 'id' | 'durationMs' | 'variant'> & {
  durationMs?: number;
};

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();

function emit(variant: ToastVariant, title: string, options: Partial<ToastInput> = {}): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const message: ToastMessage = {
    id,
    variant,
    title,
    description: options.description,
    durationMs: options.durationMs ?? (variant === 'error' ? 7000 : 4500),
    action: options.action,
  };

  listeners.forEach((listener) => listener(message));
  return id;
}

export const toast = {
  success: (title: string, options?: Partial<ToastInput>) => emit('success', title, options),
  error: (title: string, options?: Partial<ToastInput>) => emit('error', title, options),
  warning: (title: string, options?: Partial<ToastInput>) => emit('warning', title, options),
  info: (title: string, options?: Partial<ToastInput>) => emit('info', title, options),
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
