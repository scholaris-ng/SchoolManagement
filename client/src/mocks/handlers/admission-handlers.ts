import { http, delay } from 'msw';
import { db, resolveContext, scoped } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';
import type { AdmissionApplication } from '@/types/admissions';

const base = '/api/v1';
let sequence = 900_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */

/** Admissions. */
export const admissionHandlers = [

  http.get(`${base}/admissions`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('admission.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const status = url.searchParams.get('status');
    const levelId = url.searchParams.get('levelId');

    const rows = scoped(db.admissions, context.schoolId)
      .filter(
        (application) =>
          (!status || application.status === status) &&
          (!levelId || application.levelId === levelId) &&
          matchesSearch(
            [
              application.applicationNo,
              `${application.applicant.firstName} ${application.applicant.lastName}`,
              application.guardians[0]?.email,
            ],
            search,
          ),
      )
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/admissions/funnel`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('admission.read')) return errors.forbidden();

    const applications = scoped(db.admissions, context.schoolId);
    const count = (status: AdmissionApplication['status']) =>
      applications.filter((application) => application.status === status).length;

    const received = applications.filter((application) => application.status !== 'DRAFT').length;
    const accepted = count('ACCEPTED');

    const levels = scoped(db.levels, context.schoolId);

    return ok({
      sessionName: scoped(db.sessions, context.schoolId).find((s) => s.isCurrent)?.name ?? '',
      received,
      screened: applications.filter((a) => a.screeningScore !== null).length,
      shortlisted: count('SHORTLISTED'),
      offered: count('OFFERED') + accepted,
      accepted,
      rejected: count('REJECTED'),
      withdrawn: count('WITHDRAWN'),
      conversionRate: received ? Math.round((accepted / received) * 1000) / 10 : 0,
      trend: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'].map((label, index) => ({
        label,
        applications: Math.round((received / 6) * (0.6 + index * 0.14)),
        accepted: Math.round((accepted / 6) * (0.4 + index * 0.2)),
      })),
      byLevel: levels.map((level) => {
        const forLevel = applications.filter((a) => a.levelId === level.id);
        return {
          levelName: level.name,
          applications: forLevel.length,
          offered: forLevel.filter((a) => ['OFFERED', 'ACCEPTED'].includes(a.status)).length,
          accepted: forLevel.filter((a) => a.status === 'ACCEPTED').length,
        };
      }),
    });
  }),

  http.get(`${base}/admissions/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const application = scoped(db.admissions, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    return application ? ok(application) : errors.notFound('Application');
  }),

  http.post(`${base}/admissions/:id/transition`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('admission.manage')) return errors.forbidden();

    const application = scoped(db.admissions, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!application) return errors.notFound('Application');

    const body = (await request.json()) as {
      status: AdmissionApplication['status'];
      note?: string;
      screeningScore?: number;
      offeredClassId?: string;
    };

    if (['OFFERED', 'REJECTED'].includes(body.status) && !context.can('admission.decide')) {
      return errors.forbidden('Only an admissions decision-maker can offer or reject a place.');
    }

    application.status = body.status;
    if (body.screeningScore !== undefined) application.screeningScore = body.screeningScore;
    if (body.offeredClassId) {
      const schoolClass = db.classes.find((entry) => entry.id === body.offeredClassId);
      application.offeredClassId = schoolClass?.id ?? null;
      application.offeredClassName = schoolClass?.name ?? null;
    }
    if (['OFFERED', 'REJECTED'].includes(body.status)) {
      application.decidedAt = new Date().toISOString();
      application.decisionNote = body.note ?? null;
    }
    if (body.status === 'ACCEPTED') application.acceptedAt = new Date().toISOString();

    application.timeline.push({
      id: nextId('ast'),
      status: body.status,
      actorName: context.user.displayName,
      occurredAt: new Date().toISOString(),
      note: body.note ?? null,
    });
    application.version += 1;

    return ok(application, `Application ${body.status.toLowerCase()}`);
  }),

  http.post(`${base}/admissions/:id/convert`, async ({ request, params }) => {
    await delay(latency() * 2);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('student.create')) return errors.forbidden();

    const application = scoped(db.admissions, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!application) return errors.notFound('Application');
    if (application.status !== 'ACCEPTED') {
      return errors.conflict('Only an accepted application can be converted into a student.');
    }
    if (application.convertedStudentId) {
      return errors.conflict('This applicant has already been enrolled.');
    }

    const body = (await request.json()) as { classId: string; admissionNo: string };

    if (
      scoped(db.students, context.schoolId).some(
        (student) => student.admissionNo.toLowerCase() === body.admissionNo.toLowerCase(),
      )
    ) {
      return errors.validation('That admission number is already in use.', [
        { field: 'admissionNo', message: 'Already used by another student.' },
      ]);
    }

    const schoolClass = db.classes.find((entry) => entry.id === body.classId);
    if (!schoolClass) return errors.validation('Select a class.');

    // Everything the family already typed carries across — nothing is re-keyed
    // (spec section 10).
    const applicant = application.applicant;
    const student = {
      id: nextId('std'),
      schoolId: context.schoolId,
      admissionNo: body.admissionNo,
      firstName: applicant.firstName,
      middleName: applicant.middleName,
      lastName: applicant.lastName,
      fullName: [applicant.firstName, applicant.middleName, applicant.lastName]
        .filter(Boolean)
        .join(' '),
      gender: applicant.gender,
      dateOfBirth: applicant.dateOfBirth,
      photoUrl: applicant.photoUrl ?? null,
      photoConsent: false,
      admissionDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE' as const,
      currentClassId: schoolClass.id,
      currentClassName: schoolClass.name,
      currentLevelName: schoolClass.levelName,
      houseId: null,
      houseName: null,
      bloodGroup: applicant.bloodGroup ?? null,
      medicalNotes: applicant.medicalNotes ?? null,
      emergencyContactName: application.guardians[0]
        ? `${application.guardians[0].firstName} ${application.guardians[0].lastName}`
        : null,
      emergencyContactPhone: application.guardians[0]?.phone ?? null,
      address: applicant.address ?? null,
      nationality: applicant.nationality ?? null,
      stateOfOrigin: applicant.stateOfOrigin ?? null,
      religion: null,
      guardianCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    db.students.unshift(student);
    schoolClass.enrolledCount += 1;

    application.guardians.forEach((guardianInput, index) => {
      let guardian = db.guardians.find(
        (entry) =>
          entry.schoolId === context.schoolId &&
          entry.email.toLowerCase() === guardianInput.email.toLowerCase(),
      );

      if (!guardian) {
        guardian = {
          id: nextId('gdn'),
          schoolId: context.schoolId,
          userId: null,
          title: guardianInput.title ?? null,
          firstName: guardianInput.firstName,
          lastName: guardianInput.lastName,
          fullName: `${guardianInput.firstName} ${guardianInput.lastName}`,
          email: guardianInput.email,
          phone: guardianInput.phone,
          altPhone: null,
          occupation: guardianInput.occupation ?? null,
          address: guardianInput.address ?? null,
          photoUrl: null,
          hasPortalAccess: true,
          lastLoginAt: null,
          studentCount: 0,
          createdAt: new Date().toISOString(),
          version: 1,
        };
        db.guardians.unshift(guardian);
      }

      guardian.studentCount += 1;
      student.guardianCount += 1;

      db.studentGuardians.push({
        id: nextId('sgl'),
        studentId: student.id,
        studentName: student.fullName,
        studentAdmissionNo: student.admissionNo,
        studentPhotoUrl: null,
        guardianId: guardian.id,
        guardianName: guardian.fullName,
        guardianPhone: guardian.phone,
        guardianEmail: guardian.email,
        relationship: guardianInput.relationship,
        isPrimaryContact: guardianInput.isPrimaryContact,
        isEmergencyContact: index === 0,
        isFinanciallyResponsible: guardianInput.isPrimaryContact,
        canPickUp: true,
      });
    });

    const session = scoped(db.sessions, context.schoolId).find((entry) => entry.isCurrent);
    if (session) {
      db.enrollments.push({
        id: nextId('enr'),
        schoolId: context.schoolId,
        studentId: student.id,
        studentName: student.fullName,
        sessionId: session.id,
        sessionName: session.name,
        termId: null,
        termName: null,
        levelId: schoolClass.levelId,
        levelName: schoolClass.levelName,
        classId: schoolClass.id,
        className: schoolClass.name,
        status: 'ACTIVE',
        enrolledOn: student.admissionDate,
        exitedOn: null,
        note: `Converted from application ${application.applicationNo}`,
      });
    }

    application.convertedStudentId = student.id;

    return created({ student, applicationId: application.id }, 'Applicant enrolled as a student');
  }),
];
