import { http, delay } from 'msw';
import { db, resolveContext, scoped } from '../context';
import { errors, latency, ok, paginate, readListParams } from '../http-helpers';

const base = '/api/v1';

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */

/** Notifications. */
export const notificationHandlers = [

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
];
