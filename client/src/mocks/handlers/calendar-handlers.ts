import { http, delay } from 'msw';
import {
  db,
  resolveContext,
  scoped,
} from '../context';
import {
  created,
  errors,
  latency,
  ok,
} from '../http-helpers';
import {
  base,
  nextId,
} from './academics-helpers';

/** Curriculum, schemes of work, lesson notes, timetable, calendar and CBT. */

/** Calendar. */
export const calendarHandlers = [

  http.get(`${base}/calendar`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('calendar.read')) return errors.forbidden();

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const category = url.searchParams.get('category');

    return ok(
      scoped(db.calendarEvents, context.schoolId).filter(
        (event) =>
          (!category || event.category === category) &&
          (!from || event.endDate >= from) &&
          (!to || event.startDate <= to),
      ),
    );
  }),

  http.post(`${base}/calendar`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('calendar.manage')) return errors.forbidden();

    const body = (await request.json()) as Record<string, string | string[] | boolean>;

    // Warn about a clash rather than refusing it — two events on one day is
    // sometimes intentional, but it should never be accidental.
    const clashes = scoped(db.calendarEvents, context.schoolId).filter(
      (event) =>
        event.startDate <= String(body.endDate) &&
        event.endDate >= String(body.startDate) &&
        (event.audience === body.audience || event.audience === 'EVERYONE'),
    );

    const event = {
      id: nextId('cal'),
      schoolId: context.schoolId,
      title: String(body.title),
      description: (body.description as string) || null,
      category: body.category as never,
      startDate: String(body.startDate),
      endDate: String(body.endDate),
      allDay: Boolean(body.allDay),
      location: (body.location as string) || null,
      audience: body.audience as never,
      classIds: (body.classIds as string[]) ?? [],
      roleNames: (body.roleNames as string[]) ?? [],
      color: null,
      createdByName: context.user.displayName,
    };

    db.calendarEvents.push(event);

    return created(
      { event, conflicts: clashes.map((clash) => ({ eventId: clash.id, title: clash.title, overlapStart: clash.startDate, overlapEnd: clash.endDate, reason: 'Same audience and overlapping dates' })) },
      clashes.length > 0
        ? `Event created — note ${clashes.length} other event${clashes.length === 1 ? '' : 's'} on those dates`
        : 'Event created',
    );
  }),
];
