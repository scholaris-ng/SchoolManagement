import { z } from 'zod';
import { WEEKDAYS } from '../entities/timetableEntry.entity';

/** Mirrors `client/src/features/timetable/timetable.endpoints.ts`. */

/** A timetable is addressed by its term — see `TimetableEntry`. */
const timetableParams = z.object({ timetableId: z.string().uuid() });

export const fetchCurrentTimetableSchema = z.object({
  query: z
    .object({
      classId: z.string().uuid().optional(),
      teacherId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
    })
    .strict(),
});

/**
 * `entryId` present means "move this lesson" — the same shape as placing a
 * new one, so the drag-and-drop and the dialog share one endpoint and one set
 * of clash rules.
 */
export const saveEntrySchema = z.object({
  params: timetableParams,
  body: z
    .object({
      entryId: z.string().uuid().optional(),
      classId: z.string().uuid('Select a class.'),
      subjectId: z.string().uuid('Select a subject.'),
      teacherId: z.string().uuid('Select a teacher.'),
      roomId: z.string().uuid().nullish().default(null),
      periodId: z.string().uuid('Select a period.'),
      day: z.enum(WEEKDAYS),
    })
    .strict(),
});

export const entryParamSchema = z.object({
  params: timetableParams.extend({ entryId: z.string().uuid() }),
});

export const timetableParamSchema = z.object({ params: timetableParams });

export type SaveEntryInput = z.infer<typeof saveEntrySchema>['body'];
