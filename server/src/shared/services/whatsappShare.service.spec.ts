let mockConfigured = true;
let mockUploadFails = false;
const mockUploads: { options: Record<string, unknown>; bytes: Buffer }[] = [];

jest.mock('../../infrastructure/storage/cloudinaryClient', () => ({
  isCloudinaryConfigured: () => mockConfigured,
  getCloudinary: () => ({
    uploader: {
      upload_stream: (
        options: Record<string, unknown>,
        done: (error: unknown, result?: { secure_url: string; public_id: string }) => void,
      ) => ({
        end: (bytes: Buffer) => {
          mockUploads.push({ options, bytes });
          if (mockUploadFails) {
            done(new Error('Cloudinary is down'));
            return;
          }
          const publicId = String(options.public_id);
          done(null, {
            secure_url: `https://res.cloudinary.com/demo/raw/upload/v1/${publicId}`,
            public_id: publicId,
          });
        },
      }),
    },
  }),
}));

import { StorageService } from './storage.service';
import { WhatsAppShareService } from './whatsappShare.service';

const pdf = Buffer.from('%PDF-1.3 test');

beforeEach(() => {
  mockConfigured = true;
  mockUploadFails = false;
  mockUploads.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('StorageService.uploadPdf', () => {
  it('stores a PDF as a raw asset under a random, unguessable name', async () => {
    const first = await StorageService.Instance.uploadPdf(pdf, {
      folder: 'scholaris/finance/invoice',
      name: 'INV/2026-2027/00003',
    });
    const second = await StorageService.Instance.uploadPdf(pdf, {
      folder: 'scholaris/finance/invoice',
      name: 'INV/2026-2027/00003',
    });

    expect(mockUploads[0].options).toMatchObject({ resource_type: 'raw', overwrite: false });
    expect(mockUploads[0].bytes).toBe(pdf);
    // The invoice number reads in the name, but a random token follows it.
    expect(first.publicId).toMatch(/^scholaris\/finance\/invoice\/INV-2026-2027-00003-[0-9a-f]{32}\.pdf$/);
    expect(first.url).toBe(`https://res.cloudinary.com/demo/raw/upload/v1/${first.publicId}`);
    expect(second.publicId).not.toBe(first.publicId);
  });

  it('refuses, rather than failing inside the SDK, when Cloudinary is not configured', async () => {
    mockConfigured = false;
    await expect(
      StorageService.Instance.uploadPdf(pdf, { folder: 'scholaris/finance/bill', name: 'x' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'STORAGE_NOT_CONFIGURED' });
    expect(mockUploads).toHaveLength(0);
  });

  it('reports a failed upload instead of handing back a link to nothing', async () => {
    mockUploadFails = true;
    await expect(
      StorageService.Instance.uploadPdf(pdf, { folder: 'scholaris/finance/bill', name: 'x' }),
    ).rejects.toMatchObject({ statusCode: 502, code: 'STORAGE_UPLOAD_FAILED' });
  });
});

describe('WhatsAppShareService.shareDocument', () => {
  const params = {
    kind: 'invoice' as const,
    pdf,
    name: 'INV-3',
    greeting: 'Mrs Chizea',
    subject: "Ada's invoice for First Term",
    confidential: true,
    schoolName: 'AB.10 Schools',
    contactEmail: 'bursar@ab10.example',
  };

  it('returns the link, a normalised number, and a message that carries the link', async () => {
    const share = await WhatsAppShareService.Instance.shareDocument({ ...params, phone: '0803 123 4567' });

    expect(share.fileUrl).toMatch(/^https:\/\/res\.cloudinary\.com\/demo\/raw\/upload\/v1\/scholaris\/finance\/invoice\/INV-3-/);
    expect(share.phone).toBe('2348031234567');
    expect(share.message).toContain(`File: ${share.fileUrl}`);
    expect(share.message).toContain('Dear Mrs Chizea');
  });

  it('returns no number when there is none to use, so WhatsApp asks who to send it to', async () => {
    const share = await WhatsAppShareService.Instance.shareDocument({ ...params, phone: 'call me' });
    expect(share.phone).toBeNull();
  });

  it('passes on why there is no number, and has nothing to say when there is none to explain', async () => {
    const explained = await WhatsAppShareService.Instance.shareDocument({
      ...params,
      phone: null,
      notice: 'Ada Chizea has no phone number on file.',
    });
    expect(explained.notice).toBe('Ada Chizea has no phone number on file.');

    const plain = await WhatsAppShareService.Instance.shareDocument(params);
    expect(plain.notice).toBeNull();
  });

  it('keeps each kind of document in its own folder', async () => {
    await WhatsAppShareService.Instance.shareDocument({ ...params, kind: 'fee-schedule' });
    expect(String(mockUploads[0].options.public_id)).toMatch(/^scholaris\/finance\/fee-schedule\//);
  });

  it('does not build a message for a document that was not stored', async () => {
    mockUploadFails = true;
    await expect(WhatsAppShareService.Instance.shareDocument(params)).rejects.toMatchObject({
      code: 'STORAGE_UPLOAD_FAILED',
    });
  });
});
