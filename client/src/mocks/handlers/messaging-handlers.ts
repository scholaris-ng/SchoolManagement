import { http, delay } from 'msw';
import { db, resolveContext, scoped, visibleStudentIds } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';

const base = '/api/v1';
let sequence = 900_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */

/** Messaging. */
export const messagingHandlers = [

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
];
