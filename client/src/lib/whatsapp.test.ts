import { describe, expect, it } from 'vitest';
import { whatsAppUrl } from './whatsapp';

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

const message = 'Dear Mrs Chizea, it is ready.\n\nFile: https://res.cloudinary.com/x/raw/upload/a.pdf?x=1&y=2';

describe('whatsAppUrl', () => {
  it('goes straight to WhatsApp Web, chat and text ready, on a desktop with a number', () => {
    const url = whatsAppUrl({ phone: '2348031234567', message }, DESKTOP);

    expect(url.startsWith('https://web.whatsapp.com/send?phone=2348031234567&text=')).toBe(true);
    expect(decodeURIComponent(url.split('&text=')[1])).toBe(message);
  });

  it('uses the universal link on a phone, which opens the app', () => {
    for (const userAgent of [ANDROID, IPHONE]) {
      const url = whatsAppUrl({ phone: '2348031234567', message }, userAgent);
      expect(url.startsWith('https://wa.me/2348031234567?text=')).toBe(true);
    }
  });

  it('lets WhatsApp ask who to send it to when there is no number', () => {
    for (const userAgent of [DESKTOP, ANDROID]) {
      const url = whatsAppUrl({ phone: null, message }, userAgent);
      expect(url.startsWith('https://wa.me/?text=')).toBe(true);
      expect(decodeURIComponent(url.split('?text=')[1])).toBe(message);
    }
  });

  it('keeps a link with its own query string intact inside the text', () => {
    // An unencoded `&` in the message would end the `text` parameter early.
    const url = new URL(whatsAppUrl({ phone: null, message }, DESKTOP));
    expect(url.searchParams.get('text')).toBe(message);
  });
});
