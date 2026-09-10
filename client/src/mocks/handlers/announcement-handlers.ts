import { http, delay } from 'msw';
import { db, resolveContext, scoped } from '../context';
import { created, errors, latency, matchesSearch, ok, paginate, readListParams } from '../http-helpers';

const base = '/api/v1';
let sequence = 900_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

/** Notifications, messaging, announcements, news, admissions, behaviour, discipline. */

/** Announcements and news. */
export const announcementHandlers = [

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
];
