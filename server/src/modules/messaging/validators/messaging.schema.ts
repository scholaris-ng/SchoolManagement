import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { SMS_PURPOSES } from '../entities/smsMessage.entity';

export const fetchSmsLogSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    purpose: z.enum(SMS_PURPOSES).optional(),
    status: z.enum(['QUEUED', 'SENT', 'FAILED']).optional(),
    studentId: z.string().uuid().optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export type FetchSmsLogQuery = z.infer<typeof fetchSmsLogSchema>['query'];

/**
 * A test message to one number, so an administrator can confirm the sender
 * ID and credit are in order before the first birthday comes round. Capped at
 * two pages: this is a check, not a broadcast.
 */
export const sendTestSmsSchema = z.object({
  body: z
    .object({
      to: z.string().trim().min(6).max(40),
      message: z.string().trim().min(1).max(306),
    })
    .strict(),
});

export type SendTestSmsInput = z.infer<typeof sendTestSmsSchema>['body'];
