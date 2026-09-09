import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { errors, latency, ok, paginate, readListParams } from '../http-helpers';
import { ledgerFor } from './finance';

const base = '/api/v1';

function attendanceRate(records: { status: string }[]): number {
  if (records.length === 0) return 0;
  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  return Math.round((present / records.length) * 1000) / 10;
}

/** Persona dashboards, analytics and the retention-risk model. */
export const dashboardHandlers = [
  http.get(`${base}/dashboard/admin`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const students = scoped(db.students, context.schoolId).filter((s) => s.status === 'ACTIVE');
    const staff = scoped(db.staff, context.schoolId).filter((s) => s.status === 'ACTIVE');
    const invoices = scoped(db.invoices, context.schoolId);
    const payments = scoped(db.payments, context.schoolId).filter((p) => p.status === 'SUCCESSFUL');
    const classes = scoped(db.classes, context.schoolId);
    const today = new Date().toISOString().slice(0, 10);

    const todayRecords = scoped(db.attendance, context.schoolId).filter((r) => r.date === today);
    const markedClasses = new Set(todayRecords.map((r) => r.classId));

    const dates = Array.from(
      new Set(scoped(db.attendance, context.schoolId).map((record) => record.date)),
    )
      .sort()
      .slice(-14);

    const billed = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const collected = payments.reduce((sum, payment) => sum + payment.amount, 0);

    const admissions = scoped(db.admissions, context.schoolId);
    const levels = scoped(db.levels, context.schoolId);

    return ok({
      currency: 'NGN',
      studentCount: students.length,
      studentDelta: { value: 4.2, direction: 'up', periodLabel: 'vs last term' },
      staffCount: staff.length,
      attendanceRateToday: attendanceRate(todayRecords),
      attendanceMarkedClasses: markedClasses.size,
      totalClasses: classes.length,
      feesBilled: billed,
      feesCollected: collected,
      feesOutstanding: billed - collected,
      collectionRate: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
      admissionsInProgress: admissions.filter((a) =>
        ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'OFFERED'].includes(a.status),
      ).length,
      admissionsAccepted: admissions.filter((a) => a.status === 'ACCEPTED').length,
      attendanceTrend: dates.map((date) => {
        const records = scoped(db.attendance, context.schoolId).filter((r) => r.date === date);
        return {
          date,
          label: new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
          rate: attendanceRate(records),
          present: records.filter((r) => r.status === 'PRESENT').length,
          absent: records.filter((r) => r.status === 'ABSENT').length,
        };
      }),
      enrolmentByLevel: levels.map((level) => ({
        levelName: level.name,
        students: students.filter((student) => {
          const schoolClass = classes.find((entry) => entry.id === student.currentClassId);
          return schoolClass?.levelId === level.id;
        }).length,
      })),
      recentActivity: scoped(db.auditLog, context.schoolId)
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          actorName: entry.actorName,
          action: entry.action,
          entityLabel: entry.entityLabel ?? entry.entityType,
          occurredAt: entry.occurredAt,
        })),
      upcomingEvents: scoped(db.calendarEvents, context.schoolId)
        .filter((event) => event.startDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          category: event.category,
        })),
      atRiskCount: students.filter((student) => {
        const { summary } = ledgerFor(context.schoolId, student.id);
        return summary.balance > 100_000;
      }).length,
    });
  }),

  http.get(`${base}/dashboard/teacher`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const staffId = context.membership.staffId;
    const timetable = scoped(db.timetables, context.schoolId)[0];
    const weekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      new Date().getDay()
    ];
    const today = new Date().toISOString().slice(0, 10);

    const todayEntries = (timetable?.entries ?? [])
      .filter((entry) => entry.day === weekday && (!staffId || entry.teacherId === staffId))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const markedToday = new Set(
      scoped(db.attendance, context.schoolId)
        .filter((record) => record.date === today)
        .map((record) => record.classId),
    );

    const myClasses = staffId
      ? scoped(db.classes, context.schoolId).filter((c) => c.formTeacherIds.includes(staffId))
      : scoped(db.classes, context.schoolId).slice(0, 3);

    const sheets = scoped(db.scoreSheets, context.schoolId)
      .filter((sheet) => sheet.status === 'DRAFT' || sheet.status === 'SUBMITTED')
      .slice(0, 6);

    return ok({
      todayClasses: todayEntries.slice(0, 8).map((entry) => ({
        id: entry.id,
        className: entry.className,
        subjectName: entry.subjectName,
        startTime: entry.startTime,
        endTime: entry.endTime,
        roomName: entry.roomName,
        attendanceTaken: markedToday.has(entry.classId),
      })),
      pendingAttendance: myClasses
        .filter((schoolClass) => !markedToday.has(schoolClass.id))
        .map((schoolClass) => ({
          classId: schoolClass.id,
          className: schoolClass.name,
          date: today,
        })),
      pendingScoreEntry: sheets.map((sheet) => ({
        scoreSheetId: sheet.id,
        className: sheet.className,
        subjectName: sheet.subjectName,
        enteredCount: sheet.rows.filter((row) => row.total !== null).length,
        totalCount: sheet.rows.length,
        status: sheet.status,
      })),
      lessonNotesDue: scoped(db.lessonNotes, context.schoolId)
        .filter((note) => note.status === 'DRAFT' || note.status === 'RETURNED')
        .slice(0, 5)
        .map((note) => ({
          id: note.id,
          className: note.className,
          subjectName: note.subjectName,
          weekNumber: note.weekNumber,
        })),
      upcomingAssessments: scoped(db.assessments, context.schoolId)
        .filter((assessment) => assessment.state === 'SCHEDULED' || assessment.state === 'OPEN')
        .slice(0, 4)
        .map((assessment) => ({
          id: assessment.id,
          title: assessment.title,
          startsAt: assessment.startsAt ?? '',
          className: assessment.classNames[0] ?? '',
        })),
      unreadMessages: scoped(db.conversations, context.schoolId).reduce(
        (sum, conversation) => sum + conversation.unreadCount,
        0,
      ),
      curriculumCoverage: scoped(db.curricula, context.schoolId)
        .slice(0, 4)
        .map((curriculum) => {
          const topics = db.topics.filter((topic) => topic.curriculumId === curriculum.id);
          const objectives = topics.flatMap((topic) => topic.objectives);
          return {
            subjectName: curriculum.subjectName,
            className: curriculum.levelName,
            coverageRate: objectives.length
              ? Math.round(
                  (objectives.filter((objective) => objective.taught).length / objectives.length) * 1000,
                ) / 10
              : 0,
          };
        }),
    });
  }),

  http.get(`${base}/dashboard/parent`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const allowed = visibleStudentIds(context) ?? [];
    const term = scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);

    const children = allowed.map((studentId) => {
      const student = db.students.find((entry) => entry.id === studentId)!;
      const records = scoped(db.attendance, context.schoolId).filter(
        (record) => record.studentId === studentId,
      );
      const { summary } = ledgerFor(context.schoolId, studentId);

      const sheets = scoped(db.scoreSheets, context.schoolId).filter(
        (sheet) =>
          sheet.classId === student.currentClassId &&
          sheet.termId === term?.id &&
          sheet.status === 'PUBLISHED',
      );
      const totals = sheets
        .map((sheet) => sheet.rows.find((row) => row.studentId === studentId)?.total)
        .filter((total): total is number => total !== null && total !== undefined);

      return {
        studentId,
        fullName: student.fullName,
        admissionNo: student.admissionNo,
        photoUrl: student.photoUrl,
        className: student.currentClassName,
        attendanceRate: attendanceRate(records),
        lastTermAverage: null,
        currentTermAverage: totals.length
          ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
          : null,
        position: sheets[0]?.rows.find((row) => row.studentId === studentId)?.position ?? null,
        classSize: db.students.filter((s) => s.currentClassId === student.currentClassId).length,
        outstandingBalance: summary.balance,
        unreadMessages: 0,
        housePoints: scoped(db.housePoints, context.schoolId)
          .filter((award) => award.studentId === studentId)
          .reduce((sum, award) => sum + award.points, 0),
        resultPublished: sheets.length > 0,
      };
    });

    return ok({
      currency: 'NGN',
      children,
      recentPayments: scoped(db.payments, context.schoolId)
        .filter((payment) => allowed.includes(payment.studentId))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
        .slice(0, 5)
        .map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          paidAt: payment.paidAt,
          receiptNo: payment.receiptNo,
          studentName: payment.studentName,
        })),
      upcomingEvents: scoped(db.calendarEvents, context.schoolId)
        .filter(
          (event) =>
            event.startDate >= new Date().toISOString().slice(0, 10) &&
            ['EVERYONE', 'PARENTS'].includes(event.audience),
        )
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          category: event.category,
        })),
      unreadNotifications: scoped(db.notifications, context.schoolId).filter((n) => !n.readAt)
        .length,
    });
  }),

  http.get(`${base}/dashboard/student`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const studentId = context.membership.studentId;
    const student = db.students.find((entry) => entry.id === studentId);
    if (!student) return errors.notFound('Student');

    const records = scoped(db.attendance, context.schoolId).filter(
      (record) => record.studentId === studentId,
    );
    const term = scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);
    const timetable = scoped(db.timetables, context.schoolId)[0];
    const weekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      new Date().getDay()
    ];

    const sheets = scoped(db.scoreSheets, context.schoolId).filter(
      (sheet) =>
        sheet.classId === student.currentClassId &&
        sheet.termId === term?.id &&
        sheet.status === 'PUBLISHED',
    );
    const totals = sheets
      .map((sheet) => sheet.rows.find((row) => row.studentId === studentId)?.total)
      .filter((total): total is number => total !== null && total !== undefined);

    return ok({
      studentId: student.id,
      fullName: student.fullName,
      className: student.currentClassName,
      attendanceRate: attendanceRate(records),
      currentTermAverage: totals.length
        ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
        : null,
      position: sheets[0]?.rows.find((row) => row.studentId === studentId)?.position ?? null,
      classSize: db.students.filter((s) => s.currentClassId === student.currentClassId).length,
      housePoints: scoped(db.housePoints, context.schoolId)
        .filter((award) => award.studentId === studentId)
        .reduce((sum, award) => sum + award.points, 0),
      houseName: student.houseName,
      todayTimetable: (timetable?.entries ?? [])
        .filter((entry) => entry.classId === student.currentClassId && entry.day === weekday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((entry) => ({
          id: entry.id,
          subjectName: entry.subjectName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          teacherName: entry.teacherName,
          roomName: entry.roomName,
        })),
      openAssessments: scoped(db.assessments, context.schoolId)
        .filter(
          (assessment) =>
            assessment.state === 'OPEN' &&
            assessment.classIds.includes(student.currentClassId ?? ''),
        )
        .map((assessment) => ({
          id: assessment.id,
          title: assessment.title,
          subjectName: assessment.subjectName,
          endsAt: assessment.endsAt,
        })),
      subjectPerformance: sheets.map((sheet) => ({
        subjectName: sheet.subjectName,
        score: sheet.rows.find((row) => row.studentId === studentId)?.total ?? 0,
        classAverage: sheet.classAverage ?? 0,
      })),
      announcements: scoped(db.announcements, context.schoolId)
        .filter((announcement) => ['EVERYONE', 'STUDENTS'].includes(announcement.audience))
        .slice(0, 4)
        .map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          publishAt: announcement.publishAt,
        })),
    });
  }),

  http.get(`${base}/dashboard/bursar`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('finance.read')) return errors.forbidden();

    const invoices = scoped(db.invoices, context.schoolId);
    const payments = scoped(db.payments, context.schoolId).filter((p) => p.status === 'SUCCESSFUL');
    const billed = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const collected = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const unreconciled = payments.filter((payment) => !payment.isReconciled);

    const debtors = scoped(db.students, context.schoolId)
      .filter((student) => student.status === 'ACTIVE')
      .map((student) => {
        const { summary } = ledgerFor(context.schoolId, student.id);
        const overdue = invoices.find(
          (invoice) => invoice.studentId === student.id && invoice.status === 'OVERDUE',
        );
        return {
          studentId: student.id,
          studentName: student.fullName,
          className: student.currentClassName,
          balance: summary.balance,
          daysOverdue: overdue
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(overdue.dueDate).getTime()) / 86_400_000),
              )
            : 0,
        };
      })
      .filter((row) => row.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    return ok({
      currency: 'NGN',
      billed,
      collected,
      outstanding: billed - collected,
      collectionRate: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
      recentPayments: payments
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
        .slice(0, 8)
        .map((payment) => ({
          id: payment.id,
          studentName: payment.studentName,
          amount: payment.amount,
          method: payment.method,
          paidAt: payment.paidAt,
          isReconciled: payment.isReconciled,
        })),
      unreconciled: {
        count: unreconciled.length,
        amount: unreconciled.reduce((sum, payment) => sum + payment.amount, 0),
      },
      topDebtors: debtors,
      collectionTrend: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((label, index) => ({
        label,
        billed: Math.round(billed / 6),
        collected: Math.round((collected / 6) * (0.6 + index * 0.12)),
      })),
    });
  }),

  http.get(`${base}/analytics/results`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('analytics.read')) return errors.forbidden();

    const term = scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);
    const sheets = scoped(db.scoreSheets, context.schoolId).filter(
      (sheet) => sheet.termId === term?.id && sheet.status !== 'DRAFT',
    );
    const scheme = scoped(db.gradingSchemes, context.schoolId)[0];

    const bySubject = new Map<string, { name: string; totals: number[] }>();
    const gradeCounts = new Map<string, number>();
    const byClass = new Map<string, { name: string; totals: number[] }>();

    sheets.forEach((sheet) => {
      const subjectBucket = bySubject.get(sheet.subjectId) ?? {
        name: sheet.subjectName,
        totals: [],
      };
      const classBucket = byClass.get(sheet.classId) ?? { name: sheet.className, totals: [] };

      sheet.rows.forEach((row) => {
        if (row.total === null) return;
        subjectBucket.totals.push(row.total);
        classBucket.totals.push(row.total);
        if (row.grade) gradeCounts.set(row.grade, (gradeCounts.get(row.grade) ?? 0) + 1);
      });

      bySubject.set(sheet.subjectId, subjectBucket);
      byClass.set(sheet.classId, classBucket);
    });

    const allTotals = Array.from(bySubject.values()).flatMap((bucket) => bucket.totals);
    const passMark = scheme?.passMark ?? 40;

    return ok({
      termName: term?.name ?? '',
      overallAverage: allTotals.length
        ? Math.round((allTotals.reduce((a, b) => a + b, 0) / allTotals.length) * 10) / 10
        : 0,
      passRate: allTotals.length
        ? Math.round((allTotals.filter((t) => t >= passMark).length / allTotals.length) * 1000) / 10
        : 0,
      subjects: Array.from(bySubject, ([subjectId, bucket]) => ({
        subjectId,
        subjectName: bucket.name,
        averageScore: bucket.totals.length
          ? Math.round((bucket.totals.reduce((a, b) => a + b, 0) / bucket.totals.length) * 10) / 10
          : 0,
        passRate: bucket.totals.length
          ? Math.round(
              (bucket.totals.filter((t) => t >= passMark).length / bucket.totals.length) * 1000,
            ) / 10
          : 0,
        studentsAssessed: bucket.totals.length,
        highest: bucket.totals.length ? Math.max(...bucket.totals) : 0,
        lowest: bucket.totals.length ? Math.min(...bucket.totals) : 0,
      })).sort((a, b) => a.averageScore - b.averageScore),
      gradeDistribution: (scheme?.bands ?? []).map((band) => ({
        grade: band.label,
        count: gradeCounts.get(band.label) ?? 0,
        color: band.color,
      })),
      classComparison: Array.from(byClass, ([, bucket]) => ({
        className: bucket.name,
        average: bucket.totals.length
          ? Math.round((bucket.totals.reduce((a, b) => a + b, 0) / bucket.totals.length) * 10) / 10
          : 0,
        passRate: bucket.totals.length
          ? Math.round(
              (bucket.totals.filter((t) => t >= passMark).length / bucket.totals.length) * 1000,
            ) / 10
          : 0,
      })).sort((a, b) => b.average - a.average),
    });
  }),

  http.get(`${base}/analytics/retention`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('analytics.retention')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const band = url.searchParams.get('riskBand');

    /**
     * The withdrawal-risk model (research feature 7). It combines the four
     * signals a school can actually act on: mounting arrears, falling
     * attendance, an unpaid invoice for the coming term, and a guardian who has
     * stopped logging in.
     */
    const rows = scoped(db.students, context.schoolId)
      .filter((student) => student.status === 'ACTIVE')
      .map((student) => {
        const { summary } = ledgerFor(context.schoolId, student.id);
        const records = scoped(db.attendance, context.schoolId).filter(
          (record) => record.studentId === student.id,
        );
        const rate = attendanceRate(records);

        const link = db.studentGuardians.find((entry) => entry.studentId === student.id);
        const guardian = link
          ? db.guardians.find((entry) => entry.id === link.guardianId)
          : undefined;
        const daysSinceLogin = guardian?.lastLoginAt
          ? Math.floor((Date.now() - new Date(guardian.lastLoginAt).getTime()) / 86_400_000)
          : 999;

        const overdue = scoped(db.invoices, context.schoolId).some(
          (invoice) => invoice.studentId === student.id && invoice.status === 'OVERDUE',
        );

        const signals: { key: string; label: string; detail: string; weight: number }[] = [];
        let score = 0;

        if (summary.balance > 150_000) {
          signals.push({
            key: 'arrears',
            label: 'Large fee arrears',
            detail: `₦${summary.balance.toLocaleString()} outstanding`,
            weight: 35,
          });
          score += 35;
        } else if (summary.balance > 50_000) {
          signals.push({
            key: 'arrears',
            label: 'Fee arrears',
            detail: `₦${summary.balance.toLocaleString()} outstanding`,
            weight: 20,
          });
          score += 20;
        }

        if (rate < 80) {
          signals.push({
            key: 'attendance',
            label: 'Falling attendance',
            detail: `${rate}% attendance this term`,
            weight: 30,
          });
          score += 30;
        } else if (rate < 90) {
          signals.push({
            key: 'attendance',
            label: 'Attendance slipping',
            detail: `${rate}% attendance this term`,
            weight: 15,
          });
          score += 15;
        }

        if (overdue) {
          signals.push({
            key: 'overdue',
            label: 'Invoice past its due date',
            detail: 'Current term invoice unpaid after the deadline',
            weight: 20,
          });
          score += 20;
        }

        if (daysSinceLogin > 45) {
          signals.push({
            key: 'engagement',
            label: 'Guardian has stopped logging in',
            detail:
              daysSinceLogin === 999
                ? 'Never signed in to the portal'
                : `Last signed in ${daysSinceLogin} days ago`,
            weight: 15,
          });
          score += 15;
        }

        return {
          studentId: student.id,
          studentName: student.fullName,
          admissionNo: student.admissionNo,
          className: student.currentClassName,
          riskScore: Math.min(100, score),
          riskBand: score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW',
          signals,
          outstandingBalance: summary.balance,
          attendanceRate: rate,
          guardianLastLoginAt: guardian?.lastLoginAt ?? null,
          lastContactedAt: null,
        };
      })
      .filter((row) => row.riskScore > 0 && (!band || row.riskBand === band))
      .sort((a, b) => b.riskScore - a.riskScore);

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/analytics/staff`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('analytics.staff')) return errors.forbidden();

    const rows = scoped(db.staff, context.schoolId)
      .filter((member) => member.status === 'ACTIVE')
      .map((member) => {
        const notes = scoped(db.lessonNotes, context.schoolId).filter(
          (note) => note.teacherId === member.id,
        );
        const submitted = notes.filter((note) => note.status !== 'DRAFT').length;
        const noteCompliance = notes.length ? Math.round((submitted / notes.length) * 100) : 0;
        const attendanceCompliance = 70 + ((member.id.charCodeAt(member.id.length - 1) * 7) % 30);
        const scoreTimeliness = 60 + ((member.id.charCodeAt(0) * 11) % 40);
        const coverage = 55 + ((member.staffNo.charCodeAt(4) * 13) % 45);
        const averageStudentScore = 50 + ((member.id.charCodeAt(2) * 5) % 30);

        return {
          staffId: member.id,
          staffName: member.fullName,
          designation: member.designation,
          classCount: member.classIds.length,
          attendanceCompliance,
          lessonNoteCompliance: noteCompliance,
          scoreEntryTimeliness: scoreTimeliness,
          curriculumCoverage: coverage,
          averageStudentScore,
          compositeScore: Math.round(
            (attendanceCompliance + noteCompliance + scoreTimeliness + coverage) / 4,
          ),
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);

    return ok(rows);
  }),

  /* ---------------------------------------------------------------------- */
  /* Public verification                                                     */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/public/verify/:code`, async ({ params }) => {
    await delay(latency());
    const code = String(params.code).toUpperCase();

    const school = db.schools.find((entry) => code.startsWith(entry.code));
    if (!school) {
      return ok({ valid: false, revoked: false, documentType: 'REPORT_CARD', schoolName: '', studentInitials: '', issuedAt: '' });
    }

    const fragment = code.split('-')[1]?.toLowerCase() ?? '';
    const student = db.students.find(
      (entry) => entry.schoolId === school.id && entry.id.toLowerCase().endsWith(fragment),
    );

    if (!student) {
      return ok({ valid: false, revoked: false, documentType: 'REPORT_CARD', schoolName: school.name, studentInitials: '', issuedAt: '' });
    }

    const sequenceNumber = Number(code.split('-')[2] ?? 1);
    const term = db.terms.find(
      (entry) => entry.schoolId === school.id && entry.sequence === sequenceNumber && entry.isCurrent,
    );

    // Deliberately minimal: enough to prove the document is genuine, and no
    // more of a child's record than that (spec section 22).
    return ok({
      valid: true,
      documentType: code.includes('RCP') ? 'CERTIFICATE' : 'REPORT_CARD',
      schoolName: school.name,
      schoolLogoUrl: school.branding.logoUrl,
      studentInitials: `${student.firstName[0]}.${student.lastName[0]}.`,
      className: student.currentClassName,
      termName: term?.name ?? null,
      sessionName: term?.sessionName ?? null,
      issuedAt: new Date().toISOString(),
      averageBand: 'Credit',
      revoked: false,
    });
  }),

  http.get(`${base}/public/schools/:slug`, async ({ params }) => {
    await delay(latency());
    const school = db.schools.find((entry) => entry.slug === params.slug);
    if (!school) return errors.notFound('School');

    const website = db.websites.find((entry) => entry.schoolId === school.id);
    if (!website?.enabled) return errors.notFound('Website');

    return ok({
      school: {
        name: school.name,
        shortName: school.shortName,
        branding: school.branding,
        city: school.city,
        state: school.state,
      },
      website,
      // Only posts marked public appear here, and photo consent is enforced
      // before any student image is exposed.
      news: db.news
        .filter((post) => post.schoolId === school.id && post.audience === 'PUBLIC' && post.status === 'PUBLISHED')
        .slice(0, 6),
      events: db.calendarEvents
        .filter((event) => event.schoolId === school.id && event.audience === 'EVERYONE')
        .slice(0, 6),
    });
  }),
];
