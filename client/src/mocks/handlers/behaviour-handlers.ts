import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';

const base = '/api/v1';
let sequence = 900_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */

/** Behaviour, houses and discipline. */
export const behaviourHandlers = [

  http.get(`${base}/behaviour/traits`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('behaviour.read')) return errors.forbidden();
    return ok(scoped(db.behaviourTraits, context.schoolId));
  }),

  http.get(`${base}/behaviour/scales`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    return ok(scoped(db.behaviourScales, context.schoolId));
  }),

  http.get(`${base}/behaviour/observations`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('behaviour.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const studentId = url.searchParams.get('studentId');
    const classId = url.searchParams.get('classId');

    const rows = scoped(db.observations, context.schoolId)
      .filter((observation) => {
        if (studentId && observation.studentId !== studentId) return false;
        if (classId) {
          const student = db.students.find((entry) => entry.id === observation.studentId);
          if (student?.currentClassId !== classId) return false;
        }
        return true;
      })
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/behaviour/observations`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('behaviour.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      entries: { studentId: string; traitId: string; rating: number; note?: string }[];
    };
    const term = scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);

    const created_ = body.entries.map((entry) => {
      const student = db.students.find((candidate) => candidate.id === entry.studentId);
      const trait = db.behaviourTraits.find((candidate) => candidate.id === entry.traitId);
      const observation = {
        id: nextId('obs'),
        schoolId: context.schoolId,
        studentId: entry.studentId,
        studentName: student?.fullName ?? '',
        admissionNo: student?.admissionNo ?? '',
        traitId: entry.traitId,
        traitName: trait?.name ?? '',
        termId: term?.id ?? '',
        rating: entry.rating,
        scaleMax: 5,
        note: entry.note ?? null,
        observedByName: context.user.displayName,
        observedAt: new Date().toISOString(),
      };
      db.observations.push(observation);
      return observation;
    });

    return created(created_, `${created_.length} observations recorded`);
  }),

  http.get(`${base}/students/:id/behaviour`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('behaviour.read')) return errors.forbidden();

    const allowed = visibleStudentIds(context);
    if (allowed && !allowed.includes(String(params.id))) return errors.forbidden();

    const termId =
      new URL(request.url).searchParams.get('termId') ??
      scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent)?.id;

    const observations = scoped(db.observations, context.schoolId).filter(
      (entry) => entry.studentId === params.id && (!termId || entry.termId === termId),
    );

    const grouped = new Map<string, typeof observations>();
    observations.forEach((observation) => {
      grouped.set(observation.traitId, [...(grouped.get(observation.traitId) ?? []), observation]);
    });

    const scale = scoped(db.behaviourScales, context.schoolId)[0];

    return ok(
      Array.from(grouped, ([traitId, entries]) => {
        const trait = db.behaviourTraits.find((candidate) => candidate.id === traitId);
        const average = entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length;
        return {
          traitId,
          traitName: trait?.name ?? '',
          category: trait?.category ?? 'OTHER',
          observationCount: entries.length,
          averageRating: Math.round(average * 10) / 10,
          scaleMax: 5,
          label: scale?.points.find((point) => point.value === Math.round(average))?.label ?? '',
          trend: entries
            .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
            .map((entry) => ({ date: entry.observedAt.slice(0, 10), rating: entry.rating })),
        };
      }),
    );
  }),

  http.get(`${base}/house-points`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('house.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const rows = scoped(db.housePoints, context.schoolId).sort((a, b) =>
      b.awardedAt.localeCompare(a.awardedAt),
    );
    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/house-points`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('behaviour.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      studentIds: string[];
      points: number;
      reason: string;
      note?: string;
    };
    const term = scoped(db.terms, context.schoolId).find((entry) => entry.isCurrent);

    const awards = body.studentIds.map((studentId) => {
      const student = db.students.find((entry) => entry.id === studentId)!;
      const house = db.houses.find((entry) => entry.id === student.houseId);
      if (house) house.points += body.points;

      const award = {
        id: nextId('hpt'),
        schoolId: context.schoolId,
        studentId,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        houseId: house?.id ?? '',
        houseName: house?.name ?? '',
        houseColor: house?.color ?? '#64748b',
        points: body.points,
        reason: body.reason as never,
        note: body.note ?? null,
        awardedByName: context.user.displayName,
        awardedAt: new Date().toISOString(),
        termId: term?.id ?? '',
      };
      db.housePoints.unshift(award);
      return award;
    });

    return created(awards, `${awards.length} award${awards.length === 1 ? '' : 's'} recorded`);
  }),

  http.get(`${base}/house-leaderboard`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('house.read')) return errors.forbidden();

    const houses = scoped(db.houses, context.schoolId)
      .map((house) => ({
        houseId: house.id,
        houseName: house.name,
        color: house.color,
        points: house.points,
        memberCount: house.memberCount,
        averagePerStudent: house.memberCount
          ? Math.round((house.points / house.memberCount) * 10) / 10
          : 0,
        rank: 0,
      }))
      .sort((a, b) => b.points - a.points)
      .map((house, index) => ({ ...house, rank: index + 1 }));

    const studentTotals = new Map<string, number>();
    scoped(db.housePoints, context.schoolId).forEach((award) => {
      studentTotals.set(award.studentId, (studentTotals.get(award.studentId) ?? 0) + award.points);
    });

    const students = Array.from(studentTotals, ([studentId, points]) => {
      const student = db.students.find((entry) => entry.id === studentId)!;
      return {
        studentId,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        className: student.currentClassName,
        houseName: student.houseName,
        houseColor: db.houses.find((h) => h.id === student.houseId)?.color ?? null,
        points,
        rank: 0,
      };
    })
      .sort((a, b) => b.points - a.points)
      .slice(0, 20)
      .map((student, index) => ({ ...student, rank: index + 1 }));

    return ok({ houses, students });
  }),

  http.get(`${base}/discipline`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('discipline.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');

    const rows = scoped(db.incidents, context.schoolId)
      .filter(
        (incident) =>
          (!status || incident.status === status) &&
          (!severity || incident.severity === severity) &&
          matchesSearch([incident.referenceNo, incident.studentName, incident.category], search),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/discipline/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const incident = scoped(db.incidents, context.schoolId).find((entry) => entry.id === params.id);
    return incident ? ok(incident) : errors.notFound('Incident');
  }),

  http.post(`${base}/discipline/:id/transition`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const incident = scoped(db.incidents, context.schoolId).find((entry) => entry.id === params.id);
    if (!incident) return errors.notFound('Incident');

    const body = (await request.json()) as { status: typeof incident.status; note?: string };

    if (['UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'DISMISSED'].includes(body.status)) {
      if (!context.can('discipline.review')) {
        return errors.forbidden('Only a reviewer can take this step.');
      }
      incident.reviewerName = context.user.displayName;
    }

    incident.status = body.status;
    if (body.status === 'RESOLVED') {
      incident.resolution = body.note ?? null;
      incident.resolvedAt = new Date().toISOString();
    }
    incident.timeline.push({
      id: nextId('dtl'),
      status: body.status,
      actorName: context.user.displayName,
      occurredAt: new Date().toISOString(),
      note: body.note ?? null,
    });
    incident.version += 1;

    db.auditLog.unshift({
      id: nextId('aud'),
      schoolId: context.schoolId,
      actorUserId: context.user.id,
      actorName: context.user.displayName,
      actorRole: context.membership.roles[0] ?? 'Member',
      action: `discipline.${body.status.toLowerCase()}`,
      entityType: 'DisciplineIncident',
      entityId: incident.id,
      entityLabel: incident.referenceNo,
      before: null,
      after: { status: body.status },
      ipAddress: null,
      userAgent: null,
      requestId: request.headers.get('x-request-id'),
      occurredAt: new Date().toISOString(),
      severity: 'WARNING',
    });

    return ok(incident, 'Incident updated');
  }),

  http.post(`${base}/discipline`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('discipline.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string>;
    const student = db.students.find((entry) => entry.id === body.studentId);
    if (!student) return errors.validation('Select a student.');

    const incident = {
      id: nextId('inc'),
      schoolId: context.schoolId,
      referenceNo: `DSC/${new Date().getFullYear()}/${String(db.incidents.length + 1).padStart(4, '0')}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      className: student.currentClassName,
      category: body.category,
      severity: body.severity as never,
      description: body.description,
      occurredAt: new Date(body.occurredAt).toISOString(),
      location: body.location || null,
      reportedByName: context.user.displayName,
      reportedById: context.membership.staffId ?? context.user.id,
      status: 'REPORTED' as const,
      referredToName: null,
      reviewerName: null,
      reviewNote: null,
      resolution: null,
      resolvedAt: null,
      evidence: [],
      actions: [],
      timeline: [
        {
          id: nextId('dtl'),
          status: 'REPORTED' as const,
          actorName: context.user.displayName,
          occurredAt: new Date().toISOString(),
          note: 'Incident reported.',
        },
      ],
      guardianNotified: false,
      version: 1,
    };

    db.incidents.unshift(incident);
    return created(incident, 'Incident recorded');
  }),
];
