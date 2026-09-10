import { http, delay } from 'msw';
import { db, formTeacherClassIds, resolveContext, scoped, visibleStudentIds } from '../context';
import { errors, latency, ok } from '../http-helpers';
import type { AttendanceRecord, AttendanceStatus } from '@/types/attendance';

const base = '/api/v1';
let sequence = 500_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Attendance. */

export const attendancehandlersHandlers = [

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

    // A class outside the caller's remit is "not found" rather than
    // "forbidden": the register's existence is not theirs to learn either.
    const allowedClassIds = formTeacherClassIds(context);
    if (allowedClassIds && !allowedClassIds.includes(classId)) return errors.notFound('Class');

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

    const allowedClassIds = formTeacherClassIds(context);
    if (allowedClassIds && !allowedClassIds.includes(body.classId)) return errors.notFound('Class');

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

    const allowedClassIds = formTeacherClassIds(context);
    if (classId && allowedClassIds && !allowedClassIds.includes(classId)) {
      return errors.notFound('Class');
    }

    const records = scoped(db.attendance, context.schoolId).filter(
      (record) =>
        (!classId || record.classId === classId) &&
        (!allowedClassIds || allowedClassIds.includes(record.classId)),
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

    const allowedClassIds = formTeacherClassIds(context);
    if (classId && allowedClassIds && !allowedClassIds.includes(classId)) {
      return errors.notFound('Class');
    }

    const records = scoped(db.attendance, context.schoolId).filter(
      (record) =>
        (!classId || record.classId === classId) &&
        (!allowedClassIds || allowedClassIds.includes(record.classId)),
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
];
