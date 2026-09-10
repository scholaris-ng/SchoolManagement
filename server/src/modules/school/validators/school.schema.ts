import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour, such as #2563eb');

const brandingSchema = z
  .object({
    primaryColor: hexColor.optional(),
    accentColor: hexColor.optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    faviconUrl: z.string().url().max(500).nullable().optional(),
    motto: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

const settingsSchema = z
  .object({
    timezone: z.string().trim().min(1).max(60).optional(),
    currency: z.string().trim().length(3, 'Use a three-letter currency code.').optional(),
    currencySymbol: z.string().trim().min(1).max(6).optional(),
    country: z.string().trim().min(1).max(60).optional(),
    locale: z.string().trim().min(2).max(20).optional(),
    requirePhotoConsent: z.boolean().optional(),
    absenceAlertEnabled: z.boolean().optional(),
    absenceAlertCutoff: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time, such as 09:30')
      .optional(),
    resultPublishNotification: z.boolean().optional(),
    allowParentTeacherMessaging: z.boolean().optional(),
    publicWebsiteEnabled: z.boolean().optional(),
  })
  .strict();

/**
 * `code`, `slug`, `status` and `version` are absent by design: identity and
 * lifecycle are not a school administrator's to edit from the settings screen.
 */
export const updateSchoolSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(200).optional(),
      shortName: z.string().trim().min(1).max(60).optional(),
      email: z.string().trim().email().max(160).optional(),
      phone: z.string().trim().min(6).max(40).optional(),
      website: z.string().trim().url().max(200).nullable().optional(),
      addressLine1: z.string().trim().min(1).max(200).optional(),
      addressLine2: z.string().trim().max(200).nullable().optional(),
      city: z.string().trim().min(1).max(80).optional(),
      state: z.string().trim().min(1).max(80).optional(),
      branding: brandingSchema.optional(),
      settings: settingsSchema.optional(),
    })
    .strict(),
});

export const updateWebsiteSchema = z.object({
  body: z
    .object({
      enabled: z.boolean().optional(),
      tagline: z.string().trim().max(200).optional(),
      about: z.string().trim().max(20_000).optional(),
      mission: z.string().trim().max(5_000).nullable().optional(),
      vision: z.string().trim().max(5_000).nullable().optional(),
      heroImageUrl: z.string().url().max(500).nullable().optional(),
      admissionsIntro: z.string().trim().max(5_000).nullable().optional(),
      admissionsOpen: z.boolean().optional(),
      contactEmail: z.string().trim().email().max(160).optional(),
      contactPhone: z.string().trim().max(40).optional(),
      address: z.string().trim().max(500).optional(),
      socialLinks: z
        .array(z.object({ platform: z.string().trim().min(1).max(40), url: z.string().url() }))
        .max(12)
        .optional(),
      testimonials: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(60),
            author: z.string().trim().min(1).max(120),
            role: z.string().trim().max(120),
            quote: z.string().trim().min(1).max(1_000),
          }),
        )
        .max(50)
        .optional(),
      gallery: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(60),
            url: z.string().url().max(500),
            caption: z.string().trim().max(200).nullable().optional(),
          }),
        )
        .max(100)
        .optional(),
    })
    .strict(),
});

export const schoolSlugParamSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1).max(120) }),
});

export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>['body'];
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>['body'];
