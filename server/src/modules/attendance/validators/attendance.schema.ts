import { z } from 'zod';
import { ABSENCE_REASONS, ATTENDANCE_STATUSES } from '../entities/attendanceRecord.entity';

/**
 * Mirrors `client/src/features/attendance/attendance.endpoints.ts`. Shape only:
 * whether the day may be written to at all is a school-calendar rule, and that
 * lives in `AttendanceService` where the term dates are.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.');

/** Generous enough for the largest class a school could sit in one room. */
const MAX_MARKS_PER_REGISTER = 300;

export const fetchRegisterSchema = z.object({
  query: z
    .object({
      classId: z.string().uuid('Select a class.'),
      date: isoDate,
    })
    .strict(),
});

const markInput = z
  .object({
    studentId: z.string().uuid(),
    status: z.enum(ATTENDANCE_STATUSES),
    reason: z.enum(ABSENCE_REASONS).nullish().default(null),
    note: z.string().trim().max(500).nullish().default(null),
  })
  .strict()
  /**
   * A reason describes an absence. The screen already clears it when a pupil is
   * switched back to present, and dropping it here too means a stale one cannot
   * arrive from a replayed offline queue and be stored against a child who was
   * in class all day.
   */
  .transform((mark) => (mark.status === 'ABSENT' ? mark : { ...mark, reason: null }));

export const saveRegisterSchema = z.object({
  body: z
    .object({
      classId: z.string().uuid('Select a class.'),
      date: isoDate,
      marks: z
        .array(markInput)
        .min(1, 'A register needs at least one pupil.')
        .max(MAX_MARKS_PER_REGISTER),
    })
    .strict()
    .refine(
      (value) => new Set(value.marks.map((mark) => mark.studentId)).size === value.marks.length,
      {
        message: 'Each pupil may only be marked once.',
        path: ['marks'],
      },
    ),
});

/**
 * `from`/`to` together stand in for a term the caller cannot yet name (an
 * exported statement, say); `termId` alone is what the portal's own tab
 * sends. Neither is required — an absent window falls back to the current
 * term in `AttendanceService`.
 */
export const fetchStudentAttendanceSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
  query: z
    .object({
      termId: z.string().uuid().optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
    })
    .strict()
    .refine((value) => Boolean(value.from) === Boolean(value.to), {
      message: 'Provide both a start and an end date, or neither.',
      path: ['to'],
    }),
});

export type FetchRegisterQuery = z.infer<typeof fetchRegisterSchema>['query'];
export type SaveRegisterInput = z.infer<typeof saveRegisterSchema>['body'];
export type FetchStudentAttendanceQuery = z.infer<typeof fetchStudentAttendanceSchema>['query'];
