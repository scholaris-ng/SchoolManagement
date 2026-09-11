import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.');

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time, such as 08:30');

const uuidParam = z.object({ id: z.string().uuid() });

/** `true` / `false` arrive as strings on the query string. */
const boolish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((value) => value === true || value === 'true');

// ─── Sessions and terms ──────────────────────────────────────────────────────

const termSeed = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: 'A term cannot end before it starts.',
    path: ['endDate'],
  });

export const createSessionSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'A session needs a name.').max(60),
      startDate: isoDate,
      endDate: isoDate,
      // A session may be created together with its terms in one call.
      terms: z.array(termSeed).max(6).optional(),
    })
    .strict()
    .refine((value) => value.endDate >= value.startDate, {
      message: 'A session cannot end before it starts.',
      path: ['endDate'],
    })
    .refine(
      (value) =>
        (value.terms ?? []).every((term) => !term.startDate || term.startDate >= value.startDate),
      {
        message: 'A term cannot start before its session does.',
        path: ['terms'],
      },
    )
    .refine(
      (value) => (value.terms ?? []).every((term) => !term.endDate || term.endDate <= value.endDate),
      {
        message: 'A term cannot end after its session does.',
        path: ['terms'],
      },
    )
    .refine(
      (value) =>
        (value.terms ?? []).every((term, index, terms) => {
          const previous = terms[index - 1];
          return !previous?.endDate || !term.startDate || term.startDate >= previous.endDate;
        }),
      {
        message: 'Terms cannot overlap — each must start on or after the previous term ends.',
        path: ['terms'],
      },
    ),
});

export const updateSessionSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(2).max(60).optional(),
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED']).optional(),
    })
    .strict(),
});

export const createTermSchema = z.object({
  body: z
    .object({
      sessionId: z.string().uuid('A term must belong to a session.'),
      name: z.string().trim().min(1, 'A term needs a name.').max(60),
      startDate: isoDate,
      endDate: isoDate,
    })
    .strict()
    .refine((value) => value.endDate >= value.startDate, {
      message: 'A term cannot end before it starts.',
      path: ['endDate'],
    }),
});

export const updateTermSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(60).optional(),
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED']).optional(),
    })
    .strict(),
});

export const fetchTermsSchema = z.object({
  query: z.object({ sessionId: z.string().uuid().optional() }),
});

// ─── Levels and classes ──────────────────────────────────────────────────────

export const createLevelSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'A level needs a name.').max(80),
      code: z.string().trim().max(20).optional(),
      sequence: z.coerce.number().int().min(1).max(100).optional(),
      gradingSchemeId: z.string().uuid().nullable().optional(),
    })
    .strict(),
});

export const updateLevelSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      code: z.string().trim().max(20).optional(),
      sequence: z.coerce.number().int().min(1).max(100).optional(),
      gradingSchemeId: z.string().uuid().nullable().optional(),
    })
    .strict(),
});

export const fetchClassesSchema = z.object({
  query: z.object({
    levelId: z.string().uuid().optional(),
    includeInactive: boolish,
    /** Narrows to classes the caller is form teacher of — the register's picker. */
    formTeacherOnly: boolish,
  }),
});

export const createClassSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'A class needs a name.').max(80),
      levelId: z.string().uuid('A class needs a level.'),
      arm: z.string().trim().max(40).nullable().optional(),
      capacity: z.coerce.number().int().min(1).max(500).optional(),
      formTeacherIds: z.array(z.string().uuid()).max(5).optional(),
      roomId: z.string().uuid().nullable().optional(),
    })
    .strict(),
});

export const updateClassSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      levelId: z.string().uuid().optional(),
      arm: z.string().trim().max(40).nullable().optional(),
      capacity: z.coerce.number().int().min(1).max(500).optional(),
      formTeacherIds: z.array(z.string().uuid()).max(5).optional(),
      roomId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

// ─── Subjects, rooms, houses, periods ────────────────────────────────────────

const scheduleSlot = z.object({
  day: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']),
  periodId: z.string().uuid(),
});

export const fetchSubjectsSchema = z.object({
  query: z.object({
    levelId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
  }),
});

export const createSubjectSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'A subject needs a name.').max(120),
      code: z.string().trim().min(1, 'A subject needs a code.').max(20),
      category: z.string().trim().max(80).nullable().optional(),
      isCore: z.boolean().optional(),
      levelIds: z.array(z.string().uuid()).max(50).optional(),
      schedule: z.array(scheduleSlot).max(40).optional(),
    })
    .strict(),
});

export const updateSubjectSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      code: z.string().trim().min(1).max(20).optional(),
      category: z.string().trim().max(80).nullable().optional(),
      isCore: z.boolean().optional(),
      isActive: z.boolean().optional(),
      levelIds: z.array(z.string().uuid()).max(50).optional(),
      schedule: z.array(scheduleSlot).max(40).optional(),
    })
    .strict(),
});

export const createRoomSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'A room needs a name.').max(120),
      code: z.string().trim().max(20).optional(),
      capacity: z.coerce.number().int().min(1).max(2000).optional(),
      type: z.enum(['CLASSROOM', 'LABORATORY', 'HALL', 'LIBRARY', 'OTHER']).optional(),
    })
    .strict(),
});

export const updateRoomSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      code: z.string().trim().max(20).optional(),
      capacity: z.coerce.number().int().min(1).max(2000).optional(),
      type: z.enum(['CLASSROOM', 'LABORATORY', 'HALL', 'LIBRARY', 'OTHER']).optional(),
    })
    .strict(),
});

export const createHouseSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'A house needs a name.').max(80),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour.')
        .optional(),
      motto: z.string().trim().max(200).nullable().optional(),
    })
    .strict(),
});

export const updateHouseSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      motto: z.string().trim().max(200).nullable().optional(),
      captainStudentId: z.string().uuid().nullable().optional(),
    })
    .strict(),
});

export const createPeriodSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'A period needs a name.').max(60),
      startTime: time,
      endTime: time,
      sequence: z.coerce.number().int().min(1).max(50).optional(),
      isBreak: z.boolean().optional(),
    })
    .strict()
    .refine((value) => value.endTime > value.startTime, {
      message: 'A period cannot end before it starts.',
      path: ['endTime'],
    }),
});

export const updatePeriodSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      name: z.string().trim().min(1).max(60).optional(),
      startTime: time.optional(),
      endTime: time.optional(),
      sequence: z.coerce.number().int().min(1).max(50).optional(),
      isBreak: z.boolean().optional(),
    })
    .strict(),
});

export const idParamSchema = z.object({ params: uuidParam });

export type CreateSessionInput = z.infer<typeof createSessionSchema>['body'];
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>['body'];
export type CreateTermInput = z.infer<typeof createTermSchema>['body'];
export type UpdateTermInput = z.infer<typeof updateTermSchema>['body'];
export type CreateLevelInput = z.infer<typeof createLevelSchema>['body'];
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>['body'];
export type FetchClassesQuery = z.infer<typeof fetchClassesSchema>['query'];
export type CreateClassInput = z.infer<typeof createClassSchema>['body'];
export type UpdateClassInput = z.infer<typeof updateClassSchema>['body'];
export type FetchSubjectsQuery = z.infer<typeof fetchSubjectsSchema>['query'];
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>['body'];
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>['body'];
export type CreateRoomInput = z.infer<typeof createRoomSchema>['body'];
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>['body'];
export type CreateHouseInput = z.infer<typeof createHouseSchema>['body'];
export type UpdateHouseInput = z.infer<typeof updateHouseSchema>['body'];
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>['body'];
export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>['body'];
