import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, ok, paginate } from '../http-helpers';
import type { ScoreSheet } from '@/types/results';

const base = '/api/v1';
let sequence = 500_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Grading and score sheets. */
import { buildBroadsheet, recomputeSheetStats, buildReportCard } from './results-helpers';

export const resultshandlersHandlers = [

  http.get(`${base}/grading-schemes`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.gradingSchemes, context.schoolId));
  }),

  http.patch(`${base}/grading-schemes/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('grading.manage')) return errors.forbidden();

    const scheme = scoped(db.gradingSchemes, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!scheme) return errors.notFound('Grading scheme');

    const body = (await request.json()) as Partial<typeof scheme>;

    // Components must add up to 100 or every computed total is meaningless.
    if (body.components) {
      const totalMax = body.components.reduce((sum, component) => sum + component.maxScore, 0);
      if (totalMax !== 100) {
        return errors.validation(
          `Assessment components must add up to 100. They currently add up to ${totalMax}.`,
        );
      }
    }

    if (body.bands) {
      const sorted = [...body.bands].sort((a, b) => a.minScore - b.minScore);
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index].minScore <= sorted[index - 1].maxScore) {
          return errors.validation(
            `Grade boundaries overlap between ${sorted[index - 1].label} and ${sorted[index].label}.`,
          );
        }
      }
    }

    Object.assign(scheme, body, { version: scheme.version + 1 });
    return ok(scheme, 'Grading scheme saved');
  }),

  http.get(`${base}/score-sheets`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('result.read')) return errors.forbidden();

    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    const subjectId = url.searchParams.get('subjectId');
    const termId = url.searchParams.get('termId');
    const status = url.searchParams.get('status');
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25);

    const rows = scoped(db.scoreSheets, context.schoolId)
      .filter(
        (sheet) =>
          (!classId || sheet.classId === classId) &&
          (!subjectId || sheet.subjectId === subjectId) &&
          (!termId || sheet.termId === termId) &&
          (!status || sheet.status === status),
      )
      // The list view does not need every student's marks.
      .map(({ rows: _rows, ...rest }) => ({
        ...rest,
        rows: [],
        enteredCount: _rows.filter((row) => row.total !== null).length,
        totalCount: _rows.length,
      }));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/score-sheets/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('result.read')) return errors.forbidden();

    const sheet = scoped(db.scoreSheets, context.schoolId).find((entry) => entry.id === params.id);
    return sheet ? ok(sheet) : errors.notFound('Score sheet');
  }),

  http.patch(`${base}/score-sheets/:id/scores`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('result.enter')) return errors.forbidden();

    const sheet = scoped(db.scoreSheets, context.schoolId).find((entry) => entry.id === params.id);
    if (!sheet) return errors.notFound('Score sheet');

    // Published marks are not editable by ordinary entry. Amending them needs a
    // separate permission and is audited (spec section 19).
    if (sheet.status === 'PUBLISHED' && !context.can('result.amend')) {
      return errors.forbidden('These results are published. Amending them requires approval.');
    }

    const ifMatch = request.headers.get('if-match');
    if (ifMatch && Number(ifMatch) !== sheet.version) return errors.versionConflict();

    const body = (await request.json()) as {
      entries: { studentId: string; componentId: string; score: number | null }[];
    };

    const scheme = db.gradingSchemes.find((entry) => entry.id === sheet.gradingSchemeId)!;
    const changes: { studentId: string; before: number | null; after: number | null }[] = [];

    body.entries.forEach((entry) => {
      const row = sheet.rows.find((candidate) => candidate.studentId === entry.studentId);
      if (!row) return;
      const component = sheet.components.find((c) => c.id === entry.componentId);
      if (!component) return;

      if (entry.score !== null && (entry.score < 0 || entry.score > component.maxScore)) {
        return;
      }

      const cell = row.scores.find((candidate) => candidate.componentId === entry.componentId);
      if (cell) {
        if (sheet.status === 'PUBLISHED') {
          changes.push({ studentId: row.studentId, before: cell.score, after: entry.score });
        }
        cell.score = entry.score;
      }

      const complete = row.scores.every((candidate) => candidate.score !== null);
      row.total = complete ? row.scores.reduce((sum, c) => sum + (c.score ?? 0), 0) : null;
      const band =
        row.total === null
          ? null
          : scheme.bands.find((b) => (row.total ?? 0) >= b.minScore && (row.total ?? 0) <= b.maxScore);
      row.grade = band?.label ?? null;
      row.remark = band?.remark ?? null;
      row.version += 1;
    });

    recomputeSheetStats(sheet);
    sheet.version += 1;

    if (changes.length > 0) {
      db.auditLog.unshift({
        id: nextId('aud'),
        schoolId: context.schoolId,
        actorUserId: context.user.id,
        actorName: context.user.displayName,
        actorRole: context.membership.roles[0] ?? 'Member',
        action: 'result.amended',
        entityType: 'ScoreSheet',
        entityId: sheet.id,
        entityLabel: `${sheet.className} · ${sheet.subjectName}`,
        before: { changes: changes.map((c) => ({ studentId: c.studentId, score: c.before })) },
        after: { changes: changes.map((c) => ({ studentId: c.studentId, score: c.after })) },
        ipAddress: null,
        userAgent: null,
        requestId: request.headers.get('x-request-id'),
        occurredAt: new Date().toISOString(),
        severity: 'CRITICAL',
      });
    }

    return ok(sheet, 'Scores saved');
  }),

  http.post(`${base}/score-sheets/:id/transition`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const sheet = scoped(db.scoreSheets, context.schoolId).find((entry) => entry.id === params.id);
    if (!sheet) return errors.notFound('Score sheet');

    const body = (await request.json()) as { to: ScoreSheet['status']; note?: string };

    const rules: Record<string, { from: ScoreSheet['status'][]; permission: string }> = {
      SUBMITTED: { from: ['DRAFT'], permission: 'result.enter' },
      APPROVED: { from: ['SUBMITTED'], permission: 'result.approve' },
      PUBLISHED: { from: ['APPROVED'], permission: 'result.publish' },
      DRAFT: { from: ['SUBMITTED'], permission: 'result.approve' },
    };

    const rule = rules[body.to];
    if (!rule) return errors.validation('Unknown status.');
    if (!rule.from.includes(sheet.status)) {
      return errors.conflict(
        `A ${sheet.status.toLowerCase()} sheet cannot move straight to ${body.to.toLowerCase()}.`,
      );
    }
    if (!context.can(rule.permission as never)) return errors.forbidden();

    if (body.to === 'SUBMITTED') {
      const incomplete = sheet.rows.filter((row) => row.total === null && !row.isAbsent).length;
      if (incomplete > 0) {
        return errors.validation(
          `${incomplete} student${incomplete === 1 ? ' is' : 's are'} still missing scores. Mark them absent or complete their marks first.`,
        );
      }
      sheet.submittedByName = context.user.displayName;
      sheet.submittedAt = new Date().toISOString();
    }

    if (body.to === 'APPROVED') {
      sheet.approvedByName = context.user.displayName;
      sheet.approvedAt = new Date().toISOString();
    }

    if (body.to === 'PUBLISHED') {
      sheet.publishedAt = new Date().toISOString();
      db.notifications.unshift({
        id: nextId('ntf'),
        schoolId: context.schoolId,
        category: 'RESULT',
        title: `${sheet.subjectName} results published`,
        body: `Results for ${sheet.className} are now visible to parents.`,
        actionUrl: '/results',
        readAt: null,
        createdAt: new Date().toISOString(),
        severity: 'SUCCESS',
        entityType: 'ScoreSheet',
        entityId: sheet.id,
      });
      db.auditLog.unshift({
        id: nextId('aud'),
        schoolId: context.schoolId,
        actorUserId: context.user.id,
        actorName: context.user.displayName,
        actorRole: context.membership.roles[0] ?? 'Member',
        action: 'result.published',
        entityType: 'ScoreSheet',
        entityId: sheet.id,
        entityLabel: `${sheet.className} · ${sheet.subjectName}`,
        before: { status: 'APPROVED' },
        after: { status: 'PUBLISHED' },
        ipAddress: null,
        userAgent: null,
        requestId: request.headers.get('x-request-id'),
        occurredAt: new Date().toISOString(),
        severity: 'CRITICAL',
      });
    }

    if (body.to === 'DRAFT') {
      sheet.submittedByName = null;
      sheet.submittedAt = null;
    }

    sheet.status = body.to;
    sheet.version += 1;

    return ok(sheet, `Results ${body.to.toLowerCase()}`);
  }),

  http.get(`${base}/students/:id/results`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('result.read')) return errors.forbidden();

    const allowed = visibleStudentIds(context);
    if (allowed && !allowed.includes(String(params.id))) return errors.forbidden();

    const report = buildReportCard(context.schoolId, String(params.id), new URL(request.url).searchParams.get('termId'), Boolean(allowed));
    return report ? ok(report) : errors.notFound('Results');
  }),

  http.get(`${base}/broadsheet`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('result.read') && !context.can('reportcard.read')) return errors.forbidden();

    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    const termId = url.searchParams.get('termId');
    if (!classId || !termId) return errors.validation('A class and term are required.');

    const schoolClass = scoped(db.classes, context.schoolId).find((entry) => entry.id === classId);
    const term = scoped(db.terms, context.schoolId).find((entry) => entry.id === termId);
    if (!schoolClass || !term) return errors.notFound('Class or term');

    const broadsheet = buildBroadsheet(context.schoolId, schoolClass, term);
    return ok(broadsheet);
  }),

  http.get(`${base}/report-cards/:studentId/:termId`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('reportcard.read')) return errors.forbidden();

    const allowed = visibleStudentIds(context);
    if (allowed && !allowed.includes(String(params.studentId))) return errors.forbidden();

    const report = buildReportCard(
      context.schoolId,
      String(params.studentId),
      String(params.termId),
      Boolean(allowed),
    );
    return report ? ok(report) : errors.notFound('Report card');
  }),

  http.get(`${base}/comment-templates`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.commentTemplates, context.schoolId));
  }),

  http.post(`${base}/comment-templates`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('reportcard.generate')) return errors.forbidden();

    const body = (await request.json()) as { audience: string; band: string; text: string };
    const template = {
      id: nextId('cmt'),
      schoolId: context.schoolId,
      audience: body.audience as 'FORM_TEACHER' | 'PRINCIPAL',
      band: body.band as 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'GENERAL',
      text: body.text,
      usageCount: 0,
    };
    db.commentTemplates.push(template);
    return created(template, 'Comment template saved');
  }),
];
