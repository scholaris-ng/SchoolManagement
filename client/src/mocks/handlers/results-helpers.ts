import { db, scoped } from '../context';
import type {
  Broadsheet,
  BroadsheetRow,
  ReportCard,
  ScoreSheet,
  SubjectResultLine,
} from '@/types/results';


/** Grading and score sheets. */

/**
 * Derivations shared by the attendance and results handlers.
 *
 * They live here rather than in either handler file because a broadsheet and a
 * report card are both built from the same score sheets.
 */


/**
 * Every student in a class ranked against every subject for one term.
 *
 * Included as soon as a subject is submitted, the same bar `/analytics/results`
 * uses — a raw, untouched draft isn't ready to rank a class by, but a school
 * still wants to watch the picture come together before everything publishes.
 */
export function buildBroadsheet(
  schoolId: string,
  schoolClass: { id: string; name: string },
  term: { id: string; name: string; sessionName: string },
): Broadsheet {
  const sheets = db.scoreSheets.filter(
    (sheet) =>
      sheet.schoolId === schoolId &&
      sheet.classId === schoolClass.id &&
      sheet.termId === term.id &&
      sheet.status !== 'DRAFT',
  );

  const subjects = sheets.map((sheet) => ({
    subjectId: sheet.subjectId,
    subjectName: sheet.subjectName,
  }));

  const scoredStudentIds = new Set(
    sheets.flatMap((sheet) => sheet.rows.filter((row) => row.total !== null).map((row) => row.studentId)),
  );
  const roster = scoped(db.students, schoolId).filter(
    (student) => student.currentClassId === schoolClass.id && scoredStudentIds.has(student.id),
  );

  const scheme =
    scoped(db.gradingSchemes, schoolId).find((entry) => entry.isDefault) ??
    scoped(db.gradingSchemes, schoolId)[0];

  const rows: BroadsheetRow[] = roster.map((student) => {
    const subjectScores: Record<string, number | null> = {};
    let total = 0;
    let subjectCount = 0;

    sheets.forEach((sheet) => {
      const row = sheet.rows.find((entry) => entry.studentId === student.id);
      const score = row?.total ?? null;
      subjectScores[sheet.subjectId] = score;
      if (score !== null) {
        total += score;
        subjectCount += 1;
      }
    });

    const average = subjectCount ? Math.round((total / subjectCount) * 10) / 10 : 0;
    const band = scheme?.bands.find((entry) => average >= entry.minScore && average <= entry.maxScore);

    return {
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      subjects: subjectScores,
      total,
      average,
      grade: band?.label ?? '—',
      position: 0,
    };
  });

  rows
    .sort((a, b) => b.total - a.total)
    .forEach((row, index) => {
      row.position = index + 1;
    });

  const classAverage = rows.length
    ? Math.round((rows.reduce((sum, row) => sum + row.average, 0) / rows.length) * 10) / 10
    : 0;

  return {
    classId: schoolClass.id,
    className: schoolClass.name,
    termId: term.id,
    termName: term.name,
    sessionName: term.sessionName,
    subjects,
    rows,
    classAverage,
  };
}

export function recomputeSheetStats(sheet: ScoreSheet): void {
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
export function buildReportCard(
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
