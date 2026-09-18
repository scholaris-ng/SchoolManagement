import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WhatsAppShare } from '@/types/finance';

const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/toast-bus', () => ({ toast }));

import { WhatsAppShareButton } from './whatsapp-share-buttons';

const share: WhatsAppShare = {
  fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/scholaris/finance/invoice/x.pdf',
  message: 'Dear Mrs Chizea, it is ready.\nFile: https://res.cloudinary.com/demo/raw/upload/v1/x.pdf',
  phone: '2348031234567',
  notice: null,
};

function fakeTab() {
  return {
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    location: { href: '' },
    opener: {} as unknown,
    close: vi.fn(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('WhatsAppShareButton', () => {
  beforeEach(() => {
    toast.warning.mockClear();
    toast.error.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens its tab inside the click, then points it at WhatsApp once the message is ready', async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const request = deferred<WhatsAppShare>();

    render(<WhatsAppShareButton data-cy="x" share={() => request.promise} />);
    await userEvent.click(screen.getByRole('button', { name: /send to whatsapp/i }));

    // Before the request has answered: the tab exists (so it is not blocked as a
    // pop-up) but has nowhere to go yet, and a second click cannot start another.
    expect(open).toHaveBeenCalledTimes(1);
    // The empty tab is not left blank while it waits.
    expect(tab.document.write).toHaveBeenCalledWith(expect.stringContaining('Preparing your message'));
    expect(tab.document.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
    expect(screen.getByRole('button')).toBeDisabled();

    request.resolve(share);
    await waitFor(() => expect(tab.location.href).not.toBe(''));

    expect(tab.location.href.startsWith('https://web.whatsapp.com/send?phone=2348031234567&text=')).toBe(true);
    expect(new URL(tab.location.href).searchParams.get('text')).toBe(share.message);
    // WhatsApp gets no handle back to this page.
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });

  it('lets WhatsApp ask who to send it to when there is no number', async () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    render(<WhatsAppShareButton data-cy="x" share={async () => ({ ...share, phone: null })} />);
    await userEvent.click(screen.getByRole('button', { name: /send to whatsapp/i }));

    await waitFor(() => expect(tab.location.href.startsWith('https://wa.me/?text=')).toBe(true));
  });

  it('says why WhatsApp is asking who to send it to, rather than looking as if the lookup failed', async () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const notice = "Ada Chizea's number is not a complete phone number.";

    render(<WhatsAppShareButton data-cy="x" share={async () => ({ ...share, phone: null, notice })} />);
    await userEvent.click(screen.getByRole('button', { name: /send to whatsapp/i }));

    await waitFor(() => expect(tab.location.href.startsWith('https://wa.me/?text=')).toBe(true));
    expect(toast.warning).toHaveBeenCalledWith('Choose who to send it to', {
      description: notice,
      durationMs: 30_000,
    });
  });

  it('stays quiet when the number was found', async () => {
    vi.spyOn(window, 'open').mockReturnValue(fakeTab() as unknown as Window);

    render(<WhatsAppShareButton data-cy="x" share={async () => share} />);
    await userEvent.click(screen.getByRole('button', { name: /send to whatsapp/i }));

    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('closes the empty tab and says why when the message could not be prepared', async () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const request = deferred<WhatsAppShare>();

    render(<WhatsAppShareButton data-cy="x" share={() => request.promise} />);
    await userEvent.click(screen.getByRole('button', { name: /send to whatsapp/i }));
    request.reject(new Error('Sharing by link is not set up on this server.'));

    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe('');
    expect(toast.error).toHaveBeenCalledWith('Could not prepare the WhatsApp message', {
      description: 'Sharing by link is not set up on this server.',
    });
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });

  it('offers a way in from the toast when the browser blocks the tab anyway', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    render(<WhatsAppShareButton data-cy="x" share={async () => share} />);
    await userEvent.click(screen.getByRole('button', { name: /send to whatsapp/i }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    const [title, options] = toast.warning.mock.calls[0];
    expect(title).toMatch(/blocked/i);

    // Clicking the toast is a fresh gesture, so this second attempt is allowed.
    open.mockClear();
    options.action.onClick();
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://web.whatsapp.com/send?phone=2348031234567'),
      '_blank',
      'noopener',
    );
  });
});
