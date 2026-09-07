import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, ok, paginate } from '../http-helpers';
import type { AttendanceRecord, AttendanceStatus } from '@/types/attendance';
import type { ReportCard, ScoreSheet, SubjectResultLine } from '@/types/results';

const base = '/api/v1';
let sequence = 500_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const attendanceResultsHandlers = [
  /* ---------------------------------------------------------------------- */
  /* Attendance                                                              */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/attendance/register`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('attendance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const classId = url.searchParams.get('classId') ?? '';
    const date = url.searchParams.get('date') ?? todayIso();

    const schoolClass = scoped(db.classes, context.schoolId).find((entry) => entry.id === classId);
    if (!schoolClass) return errors.notFound('Class');

    const roster = scoped(db.students, context.schoolId).filter(
      (student) => student.currentClassId === classId && student.status === 'ACTIVE',
    );

    const existing = scoped(db.attendance, context.schoolId).filter(
      (record) => record.classId === classId && record.date === date,
    );

    // A register that has never been taken still returns a full row per student,
    // defaulted to present — the fastest path for a teacher on a bad connection.
    const records: AttendanceRecord[] = roster.map((student) => {
      const record = existing.find((entry) => entry.studentId === student.id);
      return (
        record ?? {
          id: `pending_${student.id}_${date}`,
          schoolId: context.schoolId,
          studentId: student.id,
          studentName: student.fullName,
          admissionNo: student.admissionNo,
          photoUrl: student.photoUrl,
          classId,
          date,
          status: 'PRESENT',
          reason: null,
          note: null,
          markedByName: null,
          markedAt: null,
          guardianNotifiedAt: null,
        }
      );
    });

    const currentTerm = scoped(db.terms, context.schoolId).find((term) => term.isCurrent);

    return ok({
      schoolId: context.schoolId,
      classId,
      className: schoolClass.name,
      date,
      termId: currentTerm?.id ?? '',
      isLocked: date < (currentTerm?.startDate ?? ''),
      takenByName: existing[0]?.markedByName ?? null,
      takenAt: existing[0]?.markedAt ?? null,
      records,
    });
  }),

  http.post(`${base}/attendance/register`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('attendance.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      classId: string;
      date: string;
      marks: { studentId: string; status: AttendanceStatus; reason?: string | null; note?: string | null }[];
    };

    let notificationsSent = 0;

    body.marks.forEach((mark) => {
      const student = db.students.find((entry) => entry.id === mark.studentId);
      if (!student) return;

      const existing = db.attendance.find(
        (record) =>
          record.classId === body.classId &&
          record.date === body.date &&
          record.studentId === mark.studentId,
      );

      const record: AttendanceRecord = existing ?? {
        id: nextId('att'),
        schoolId: context.schoolId,
        studentId: student.id,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        photoUrl: student.photoUrl,
        classId: body.classId,
        date: body.date,
        status: 'PRESENT',
        reason: null,
        note: null,
        markedByName: null,
        markedAt: null,
        guardianNotifiedAt: null,
      };

      record.status = mark.status;
      record.reason = (mark.reason as AttendanceRecord['reason']) ?? null;
      record.note = mark.note ?? null;
      record.markedByName = context.user.displayName;
      record.markedAt = new Date().toISOString();

      // The alert fires once per student per day. Re-saving a corrected register
      // must not send the parent a second message (spec section 11).
      const shouldAlert =
        mark.status === 'ABSENT' &&
        (record.reason === 'UNEXPLAINED' || record.reason === null) &&
        !record.guardianNotifiedAt &&
        body.date === todayIso();

      if (shouldAlert) {
        record.guardianNotifiedAt = new Date().toISOString();
        notificationsSent += 1;
        db.notifications.unshift({
          id: nextId('ntf'),
          schoolId: context.schoolId,
          category: 'ATTENDANCE',
          title: `${student.firstName} was marked absent today`,
          body: 'No reason has been recorded. Please contact the school if this is unexpected.',
          actionUrl: `/students/${student.id}?tab=attendance`,
          readAt: null,
          createdAt: new Date().toISOString(),
          severity: 'WARNING',
          entityType: 'Student',
          entityId: student.id,
        });
      }

      if (!existing) db.attendance.push(record);
    });

    return ok(
      { saved: body.marks.length, notificationsSent },
      `Register saved${notificationsSent > 0 ? ` · ${notificationsSent} guardian alert${notificationsSent === 1 ? '' : 's'} sent` : ''}`,
    );
  }),

  http.get(`${base}/students/:id/attendance`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('attendance.read')) return errors.forbidden();

    const allowed = visibleStudentIds(context);
    if (allowed && !allowed.includes(String(params.id))) return errors.forbidden();

    const url = new URL(request.url);
    const termId = url.searchParams.get('termId');
    const term = termId
      ? db.terms.find((entry) => entry.id === termId)
      : scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);

    let records = scoped(db.attendance, context.schoolId).filter(
      (record) => record.studentId === params.id,
    );
    if (term) {
      records = records.filter(
        (record) => record.date >= term.startDate && record.date <= term.endDate,
      );
    }
    records.sort((a, b) => b.date.localeCompare(a.date));

    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const excused = records.filter((r) => r.status === 'EXCUSED').length;
    const total = records.length;

    return ok({
      summary: {
        studentId: String(params.id),
        from: records[records.length - 1]?.date ?? term?.startDate ?? todayIso(),
        to: records[0]?.date ?? term?.endDate ?? todayIso(),
        totalDays: total,
        present,
        absent,
        late,
        excused,
        attendanceRate: total ? Math.round(((present + late) / total) * 1000) / 10 : 0,
        unexplainedAbsences: records.filter(
          (r) => r.status === 'ABSENT' && r.reason === 'UNEXPLAINED',
        ).length,
      },
      records,
    });
  }),

  http.get(`${base}/attendance/summary`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('attendance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');

    const records = scoped(db.attendance, context.schoolId).filter(
      (record) => !classId || record.classId === classId,
    );

    const byClass = new Map<string, { present: number; total: number }>();
    records.forEach((record) => {
      const entry = byClass.get(record.classId) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (record.status === 'PRESENT' || record.status === 'LATE') entry.present += 1;
      byClass.set(record.classId, entry);
    });

    return ok(
      Array.from(byClass, ([id, value]) => ({
        classId: id,
        className: db.classes.find((entry) => entry.id === id)?.name ?? id,
        attendanceRate: value.total ? Math.round((value.present / value.total) * 1000) / 10 : 0,
        totalDays: value.total,
      })).sort((a, b) => a.attendanceRate - b.attendanceRate),
    );
  }),

  http.get(`${base}/attendance/trend`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('attendance.read')) return errors.forbidden();

    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days') ?? 14)));

    const records = scoped(db.attendance, context.schoolId).filter(
      (record) => !classId || record.classId === classId,
    );

    const byDate = new Map<string, { present: number; absent: number; total: number }>();
    records.forEach((record) => {
      const entry = byDate.get(record.date) ?? { present: 0, absent: 0, total: 0 };
      entry.total += 1;
      if (record.status === 'PRESENT' || record.status === 'LATE') entry.present += 1;
      else entry.absent += 1;
      byDate.set(record.date, entry);
    });

    const points = Array.from(byDate, ([date, value]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      rate: value.total ? Math.round((value.present / value.total) * 1000) / 10 : 0,
      present: value.present,
      absent: value.absent,
    }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);

    return ok(points);
  }),

  /* ---------------------------------------------------------------------- */
  /* Grading and score sheets                                                */
  /* ---------------------------------------------------------------------- */

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

function recomputeSheetStats(sheet: ScoreSheet): void {
  const scored = sheet.rows.filter((row) => row.total !== null);
  const totals = scored.map((row) => row.total ?? 0);

  scored
    .slice()
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .forEach((row, index) => {
      row.position = index + 1;
    });

  sheet.classAverage = totals.length
    ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
    : null;
  sheet.highest = totals.length ? Math.max(...totals) : null;
  sheet.lowest = totals.length ? Math.min(...totals) : null;
}

/**
 * Assembles a report card from the published score sheets, attendance and
 * behaviour observations — the same joins the server-side use case will do.
 */
function buildReportCard(
  schoolId: string,
  studentId: string,
  termIdParam: string | null,
  publishedOnly: boolean,
): ReportCard | null {
  const student = db.students.find(
    (entry) => entry.id === studentId && entry.schoolId === schoolId,
  );
  if (!student) return null;

  const term =
    (termIdParam ? db.terms.find((entry) => entry.id === termIdParam) : null) ??
    db.terms.find((entry) => entry.schoolId === schoolId && entry.isCurrent);
  if (!term) return null;

  const school = db.schools.find((entry) => entry.id === schoolId)!;

  const sheets = db.scoreSheets.filter(
    (sheet) =>
      sheet.schoolId === schoolId &&
      sheet.classId === student.currentClassId &&
      sheet.termId === term.id &&
      // A parent must never see marks that have not been published.
      (!publishedOnly || sheet.status === 'PUBLISHED'),
  );

  const subjects: SubjectResultLine[] = sheets
    .map((sheet): SubjectResultLine | null => {
      const row = sheet.rows.find((entry) => entry.studentId === studentId);
      if (!row) return null;
      return {
        subjectId: sheet.subjectId,
        subjectName: sheet.subjectName,
        components: sheet.components.map((component) => ({
          componentId: component.id,
          name: component.name,
          maxScore: component.maxScore,
          score: row.scores.find((cell) => cell.componentId === component.id)?.score ?? null,
        })),
        total: row.total,
        grade: row.grade,
        remark: row.remark,
        position: row.position,
        classAverage: sheet.classAverage,
        classHighest: sheet.highest,
        teacherName: null,
      };
    })
    .filter((line): line is SubjectResultLine => line !== null);

  const attendance = db.attendance.filter(
    (record) =>
      record.studentId === studentId &&
      record.date >= term.startDate &&
      record.date <= term.endDate,
  );
  const present = attendance.filter((record) => record.status === 'PRESENT').length;
  const late = attendance.filter((record) => record.status === 'LATE').length;
  const absent = attendance.filter((record) => record.status === 'ABSENT').length;

  const observations = db.observations.filter(
    (entry) => entry.studentId === studentId && entry.termId === term.id,
  );
  const behaviourByTrait = new Map<string, { name: string; category: string; sum: number; count: number; max: number }>();
  observations.forEach((observation) => {
    const trait = db.behaviourTraits.find((entry) => entry.id === observation.traitId);
    const bucket = behaviourByTrait.get(observation.traitId) ?? {
      name: observation.traitName,
      category: trait?.category ?? 'OTHER',
      sum: 0,
      count: 0,
      max: observation.scaleMax,
    };
    bucket.sum += observation.rating;
    bucket.count += 1;
    behaviourByTrait.set(observation.traitId, bucket);
  });

  const totalScore = subjects.reduce((sum, subject) => sum + (subject.total ?? 0), 0);
  const totalObtainable = subjects.length * 100;
  const average = totalObtainable ? Math.round((totalScore / totalObtainable) * 1000) / 10 : 0;
  const scheme = db.gradingSchemes.find((entry) => entry.schoolId === schoolId)!;
  const band = scheme.bands.find((b) => average >= b.minScore && average <= b.maxScore);

  const classmates = db.students.filter(
    (entry) => entry.currentClassId === student.currentClassId,
  );

  const anyPublished = sheets.some((sheet) => sheet.status === 'PUBLISHED');

  return {
    id: `${studentId}_${term.id}`,
    schoolId,
    studentId,
    studentName: student.fullName,
    admissionNo: student.admissionNo,
    photoUrl: student.photoUrl,
    photoConsent: student.photoConsent,
    className: student.currentClassName ?? '',
    levelName: student.currentLevelName ?? '',
    termId: term.id,
    termName: term.name,
    sessionName: term.sessionName,
    status: anyPublished ? 'PUBLISHED' : sheets[0]?.status ?? 'DRAFT',
    subjects,
    totalScore,
    totalObtainable,
    average,
    grade: band?.label ?? '—',
    position: subjects[0]?.position ?? null,
    classSize: classmates.length,
    attendance: {
      present,
      absent,
      late,
      total: attendance.length,
      rate: attendance.length
        ? Math.round(((present + late) / attendance.length) * 1000) / 10
        : 0,
    },
    behaviour: Array.from(behaviourByTrait, ([traitId, value]) => ({
      traitId,
      traitName: value.name,
      category: value.category,
      rating: Math.round((value.sum / value.count) * 10) / 10,
      scaleMax: value.max,
      label: '',
    })),
    formTeacherComment:
      average >= 70
        ? `${student.firstName} has had an excellent term and sets a good example for the class.`
        : average >= 50
          ? `${student.firstName} has worked steadily and should be pleased with this progress.`
          : `${student.firstName} is capable of more. More consistent effort with homework would lift these results.`,
    principalComment: average >= 60 ? 'A commendable result. Keep it up.' : 'More focus is required next term.',
    nextTermBegins: null,
    publishedAt: sheets.find((sheet) => sheet.publishedAt)?.publishedAt ?? null,
    verificationCode: anyPublished ? `${school.code}-${studentId.slice(-6).toUpperCase()}-${term.sequence}` : null,
    verifyUrl: anyPublished
      ? `${window.location.origin}/verify/${school.code}-${studentId.slice(-6).toUpperCase()}-${term.sequence}`
      : null,
    school: {
      name: school.name,
      logoUrl: school.branding.logoUrl,
      address: `${school.addressLine1}, ${school.city}, ${school.state}`,
      primaryColor: school.branding.primaryColor,
      motto: school.branding.motto,
    },
  };
}
