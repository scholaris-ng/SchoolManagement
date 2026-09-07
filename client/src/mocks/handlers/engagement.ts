import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';
import type { AdmissionApplication } from '@/types/admissions';

const base = '/api/v1';
let sequence = 900_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */
export const engagementHandlers = [
  /* ---------------------------------------------------------------------- */
  /* Notifications                                                           */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/notifications/unread-count`, async ({ request }) => {
    await delay(60);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    return ok({
      notifications: scoped(db.notifications, context.schoolId).filter((n) => !n.readAt).length,
      messages: scoped(db.conversations, context.schoolId).reduce(
        (sum, conversation) => sum + conversation.unreadCount,
        0,
      ),
    });
  }),

  http.get(`${base}/notifications`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const category = url.searchParams.get('category');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

    const rows = scoped(db.notifications, context.schoolId)
      .filter(
        (notification) =>
          (!category || notification.category === category) &&
          (!unreadOnly || !notification.readAt),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.patch(`${base}/notifications/:id/read`, async ({ request, params }) => {
    await delay(60);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const notification = scoped(db.notifications, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!notification) return errors.notFound('Notification');
    notification.readAt = new Date().toISOString();
    return ok(notification);
  }),

  http.post(`${base}/notifications/read-all`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    let updated = 0;
    scoped(db.notifications, context.schoolId).forEach((notification) => {
      if (!notification.readAt) {
        notification.readAt = new Date().toISOString();
        updated += 1;
      }
    });
    return ok({ updated });
  }),

  http.get(`${base}/notifications/preferences`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const categories = [
      'ATTENDANCE', 'RESULT', 'FEE', 'ADMISSION', 'CALENDAR', 'MESSAGE',
      'BEHAVIOUR', 'COLLECTION', 'ANNOUNCEMENT',
    ] as const;

    return ok(
      categories.map((category) => ({
        category,
        channels: {
          IN_APP: true,
          PUSH: category !== 'ANNOUNCEMENT',
          EMAIL: ['RESULT', 'FEE', 'ADMISSION'].includes(category),
          SMS: ['ATTENDANCE', 'RESULT', 'FEE', 'COLLECTION'].includes(category),
        },
      })),
    );
  }),

  http.patch(`${base}/notifications/preferences`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    await request.json();
    return ok([], 'Notification preferences saved');
  }),

  http.post(`${base}/notifications/push-tokens`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    await request.json();
    return ok({ registered: true });
  }),

  /* ---------------------------------------------------------------------- */
  /* Messaging                                                               */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/conversations`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('message.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.conversations, context.schoolId);
    // A parent sees only threads about their own children.
    if (allowed) {
      rows = rows.filter(
        (conversation) => !conversation.studentId || allowed.includes(conversation.studentId),
      );
    }

    rows = rows
      .filter((conversation) =>
        matchesSearch([conversation.subject, conversation.studentName], search),
      )
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.get(`${base}/conversations/:id/messages`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('message.read')) return errors.forbidden();

    const conversation = scoped(db.conversations, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!conversation) return errors.notFound('Conversation');

    const allowed = visibleStudentIds(context);
    if (allowed && conversation.studentId && !allowed.includes(conversation.studentId)) {
      return errors.forbidden();
    }

    conversation.unreadCount = 0;

    return ok(
      db.messages
        .filter((message) => message.conversationId === conversation.id)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    );
  }),

  http.post(`${base}/conversations/:id/messages`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('message.send')) return errors.forbidden();

    const conversation = scoped(db.conversations, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!conversation) return errors.notFound('Conversation');

    const body = (await request.json()) as { body: string };
    const message = {
      id: nextId('msg'),
      conversationId: conversation.id,
      senderId: context.user.id,
      senderName: context.user.displayName,
      senderRole: context.membership.roles[0] ?? 'Member',
      senderPhotoUrl: null,
      body: body.body,
      sentAt: new Date().toISOString(),
      readBy: [context.user.id],
      attachments: [],
    };

    db.messages.push(message);
    conversation.lastMessagePreview = body.body.slice(0, 90);
    conversation.lastMessageAt = message.sentAt;

    return created(message);
  }),

  http.post(`${base}/conversations`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('message.send')) return errors.forbidden();

    const body = (await request.json()) as {
      subject: string;
      studentId?: string;
      recipientId: string;
      body: string;
    };

    // A parent may only open a thread about a child of theirs.
    const allowed = visibleStudentIds(context);
    if (allowed && body.studentId && !allowed.includes(body.studentId)) {
      return errors.forbidden('You can only message staff about your own children.');
    }

    const student = body.studentId
      ? db.students.find((entry) => entry.id === body.studentId)
      : undefined;
    const recipient = db.staff.find((entry) => entry.id === body.recipientId);

    const conversation = {
      id: nextId('cnv'),
      schoolId: context.schoolId,
      subject: body.subject,
      studentId: student?.id ?? null,
      studentName: student?.fullName ?? null,
      participants: [
        {
          userId: context.user.id,
          name: context.user.displayName,
          role: context.membership.roles[0] ?? 'Member',
          photoUrl: null,
        },
        ...(recipient
          ? [{ userId: recipient.id, name: recipient.fullName, role: 'Teacher', photoUrl: null }]
          : []),
      ],
      lastMessagePreview: body.body.slice(0, 90),
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      status: 'OPEN' as const,
    };

    db.conversations.unshift(conversation);
    db.messages.push({
      id: nextId('msg'),
      conversationId: conversation.id,
      senderId: context.user.id,
      senderName: context.user.displayName,
      senderRole: context.membership.roles[0] ?? 'Member',
      senderPhotoUrl: null,
      body: body.body,
      sentAt: conversation.lastMessageAt,
      readBy: [context.user.id],
      attachments: [],
    });

    return created(conversation, 'Message sent');
  }),

  http.get(`${base}/message-contacts`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');

    // Parents may only reach staff connected to their own child — never the
    // whole staff directory (spec section 29).
    if (context.membership.guardianId) {
      const student = studentId ? db.students.find((entry) => entry.id === studentId) : null;
      const contacts = scoped(db.staff, context.schoolId).filter(
        (member) =>
          member.status === 'ACTIVE' &&
          (member.classIds.includes(student?.currentClassId ?? '') ||
            member.designation.includes('principal') ||
            member.isFormTeacher),
      );
      return ok(
        contacts.slice(0, 12).map((member) => ({
          id: member.id,
          name: member.fullName,
          role: member.designation,
          subjects: member.subjectNames,
        })),
      );
    }

    return ok(
      scoped(db.staff, context.schoolId)
        .filter((member) => member.status === 'ACTIVE')
        .map((member) => ({
          id: member.id,
          name: member.fullName,
          role: member.designation,
          subjects: member.subjectNames,
        })),
    );
  }),

  /* ---------------------------------------------------------------------- */
  /* Announcements and news                                                  */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/announcements`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);

    const rows = scoped(db.announcements, context.schoolId)
      .filter((announcement) => matchesSearch([announcement.title, announcement.body], search))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishAt.localeCompare(a.publishAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/announcements`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('announcement.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, unknown>;
    const announcement = {
      id: nextId('ann'),
      schoolId: context.schoolId,
      title: String(body.title),
      body: String(body.body),
      audience: body.audience as never,
      classIds: (body.classIds as string[]) ?? [],
      publishAt: String(body.publishAt ?? new Date().toISOString()),
      expiresAt: (body.expiresAt as string) ?? null,
      pinned: Boolean(body.pinned),
      authorName: context.user.displayName,
      channels: (body.channels as never) ?? ['IN_APP'],
      status: 'PUBLISHED' as const,
      readCount: 0,
      recipientCount: db.students.filter((s) => s.schoolId === context.schoolId).length,
    };

    db.announcements.unshift(announcement);
    return created(announcement, 'Announcement published');
  }),

  http.get(`${base}/news`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const category = url.searchParams.get('category');

    const rows = scoped(db.news, context.schoolId)
      .filter(
        (post) =>
          (!category || post.category === category) &&
          matchesSearch([post.title, post.excerpt], search),
      )
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/news`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('news.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, unknown>;
    const post = {
      id: nextId('nws'),
      schoolId: context.schoolId,
      title: String(body.title),
      slug: String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      excerpt: String(body.body).slice(0, 140),
      body: String(body.body),
      coverImageUrl: (body.coverImageUrl as string) ?? null,
      gallery: [],
      category: body.category as never,
      audience: body.audience as never,
      publishedAt: new Date().toISOString(),
      status: 'PUBLISHED' as const,
      authorName: context.user.displayName,
      containsStudentPhotos: Boolean(body.containsStudentPhotos),
      likeCount: 0,
      commentCount: 0,
    };

    db.news.unshift(post);
    return created(post, 'Post published');
  }),

  http.get(`${base}/website`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    const website = db.websites.find((entry) => entry.schoolId === context.schoolId);
    return website ? ok(website) : errors.notFound('Website');
  }),

  http.patch(`${base}/website`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('website.manage')) return errors.forbidden();

    const website = db.websites.find((entry) => entry.schoolId === context.schoolId);
    if (!website) return errors.notFound('Website');

    Object.assign(website, await request.json(), { updatedAt: new Date().toISOString() });
    return ok(website, 'Website updated');
  }),

  /* ---------------------------------------------------------------------- */
  /* Admissions                                                              */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* Behaviour, houses and discipline                                        */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* Collection                                                              */
  /* ---------------------------------------------------------------------- */

  http.get(`${base}/collection/events`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.read')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize, search } = readListParams(url);
    const date = url.searchParams.get('date');
    const allowed = visibleStudentIds(context);

    let rows = scoped(db.collectionEvents, context.schoolId);
    if (allowed) rows = rows.filter((event) => allowed.includes(event.studentId));

    rows = rows
      .filter(
        (event) =>
          (!date || event.releasedAt.slice(0, 10) === date) &&
          matchesSearch([event.studentName, event.pickupPersonName, event.studentAdmissionNo], search),
      )
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/collection/events`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.manage')) return errors.forbidden();

    const body = (await request.json()) as {
      studentId: string;
      pickupPersonId: string;
      method: string;
      note?: string;
    };

    const student = db.students.find((entry) => entry.id === body.studentId);
    const person = db.pickupPersons.find((entry) => entry.id === body.pickupPersonId);
    if (!student || !person) return errors.validation('Select a student and an authorised person.');

    // Releasing a child to somebody not on the authorised list is refused
    // outright — this is the safety guarantee the feature exists for.
    if (person.authorizationStatus !== 'AUTHORIZED') {
      return errors.forbidden(
        `${person.name} is not currently authorised to collect ${student.firstName}.`,
      );
    }

    const event = {
      id: nextId('col'),
      schoolId: context.schoolId,
      studentId: student.id,
      studentName: student.fullName,
      studentAdmissionNo: student.admissionNo,
      className: student.currentClassName,
      pickupPersonId: person.id,
      pickupPersonName: person.name,
      relationship: person.relationship,
      releasedByStaffId: context.membership.staffId ?? context.user.id,
      releasedByName: context.user.displayName,
      releasedAt: new Date().toISOString(),
      method: body.method as never,
      parentNotified: true,
      note: body.note ?? null,
    };

    db.collectionEvents.unshift(event);
    db.notifications.unshift({
      id: nextId('ntf'),
      schoolId: context.schoolId,
      category: 'COLLECTION',
      title: `${student.firstName} has been collected`,
      body: `Collected by ${person.name} and released by ${context.user.displayName}.`,
      actionUrl: `/students/${student.id}?tab=pickup`,
      readAt: null,
      createdAt: new Date().toISOString(),
      severity: 'INFO',
      entityType: 'Student',
      entityId: student.id,
    });

    return created(event, 'Collection recorded and the parent notified');
  }),

  http.post(`${base}/students/:id/pickup`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | null>;
    const person = {
      id: nextId('pkp'),
      schoolId: context.schoolId,
      studentId: String(params.id),
      name: String(body.name),
      relationship: String(body.relationship),
      phone: String(body.phone),
      photoUrl: body.photoUrl ?? null,
      authorizationStatus: (body.authorizationStatus as never) ?? 'AUTHORIZED',
      authorizedByName: context.user.displayName,
      authorizedAt: new Date().toISOString(),
      note: body.note ?? null,
    };
    db.pickupPersons.push(person);
    return created(person, 'Authorised person added');
  }),

  http.patch(`${base}/students/:studentId/pickup/:id`, async ({ request, params }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('collection.manage')) return errors.forbidden();

    const person = scoped(db.pickupPersons, context.schoolId).find(
      (entry) => entry.id === params.id,
    );
    if (!person) return errors.notFound('Authorised person');

    Object.assign(person, await request.json());
    return ok(person, 'Authorised person updated');
  }),
];
