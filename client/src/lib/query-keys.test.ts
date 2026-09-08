import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

/**
 * The client half of tenant isolation.
 *
 * The server is what actually prevents School A reading School B's records.
 * What the browser must guarantee is narrower but still essential: cached rows
 * fetched under one school can never be served under another, because the cache
 * key itself carries the tenant.
 */
describe('query keys are scoped to the active school', () => {
  it('never produces the same key for two different schools', () => {
    const a = JSON.stringify(queryKeys.students.list('sch_a', { page: 1 }));
    const b = JSON.stringify(queryKeys.students.list('sch_b', { page: 1 }));
    expect(a).not.toEqual(b);
  });

  it('scopes detail keys too, even for an identical record id', () => {
    // Ids are UUIDs in production, but a shared key here would still be a bug:
    // correctness must not depend on ids never colliding.
    const a = JSON.stringify(queryKeys.students.detail('sch_a', 'stu_1'));
    const b = JSON.stringify(queryKeys.students.detail('sch_b', 'stu_1'));
    expect(a).not.toEqual(b);
  });

  it('puts the school first so removing ["school", id] drops that tenant only', () => {
    const key = queryKeys.finance.invoices('sch_a', { page: 1 });
    expect(key[0]).toBe('school');
    expect(key[1]).toBe('sch_a');
  });

  it('distinguishes a missing school from a real one', () => {
    expect(queryKeys.students.list(null)[1]).toBe('none');
    expect(queryKeys.students.list(undefined)[1]).toBe('none');
    expect(queryKeys.students.list('none')[1]).toBe('none');
  });

  it('varies with the query so two filtered views do not share a cache entry', () => {
    const first = JSON.stringify(queryKeys.students.list('sch_a', { page: 1, classId: 'c1' }));
    const second = JSON.stringify(queryKeys.students.list('sch_a', { page: 1, classId: 'c2' }));
    expect(first).not.toEqual(second);
  });

  it('is stable for the same inputs', () => {
    expect(JSON.stringify(queryKeys.students.list('sch_a', { page: 2 }))).toEqual(
      JSON.stringify(queryKeys.students.list('sch_a', { page: 2 })),
    );
  });

  it('keeps the session key outside the tenant scope', () => {
    // The session answers "which schools may I act in?", so it cannot itself be
    // filed under one of them.
    expect(queryKeys.session()[0]).toBe('session');
  });

  it('scopes every tenant-bearing namespace', () => {
    const namespaces = [
      queryKeys.school.detail,
      queryKeys.academics.levels,
      queryKeys.guardians.list,
      queryKeys.staff.list,
      queryKeys.roles.list,
      queryKeys.admissions.list,
      queryKeys.results.schemes,
      queryKeys.finance.overview,
      queryKeys.curriculum.list,
      queryKeys.behaviour.traits,
      queryKeys.discipline.list,
      queryKeys.messaging.conversations,
      queryKeys.notifications.preferences,
      queryKeys.audit.list,
      queryKeys.dashboard.admin,
      queryKeys.dashboard.retention,
    ];

    for (const build of namespaces) {
      const key = (build as (schoolId: string) => unknown[])('sch_a');
      expect(key[0]).toBe('school');
      expect(key[1]).toBe('sch_a');
    }
  });

  /**
   * `queryKeys.all` is what a change with no fixed blast radius invalidates —
   * e.g. which term is current, which affects attendance, results, invoicing,
   * the timetable and every dashboard. React Query matches by prefix, so this
   * only works if `all` is genuinely a prefix of every other key; that is what
   * these two tests hold the line on.
   */
  it('is a prefix of every other scoped key for the same school', () => {
    const all = queryKeys.all('sch_a');
    const others = [
      queryKeys.academics.terms('sch_a'),
      queryKeys.students.list('sch_a'),
      queryKeys.finance.invoices('sch_a', {}),
      queryKeys.timetable.list('sch_a'),
      queryKeys.dashboard.admin('sch_a'),
    ];

    for (const key of others) {
      expect(key.slice(0, all.length)).toEqual(all);
    }
  });

  it('scopes to one school, not every school', () => {
    const all = queryKeys.all('sch_a');
    const otherSchool = queryKeys.students.list('sch_b');
    expect(otherSchool.slice(0, all.length)).not.toEqual(all);
  });

  it('actually marks every cached query for that school stale, not just in theory', async () => {
    const queryClient = new QueryClient();
    const schoolKeys = [
      queryKeys.academics.terms('sch_a'),
      queryKeys.timetable.list('sch_a'),
      queryKeys.dashboard.admin('sch_a'),
      queryKeys.finance.invoices('sch_a', {}),
    ];
    const otherSchoolKey = queryKeys.students.list('sch_b');

    for (const key of [...schoolKeys, otherSchoolKey]) {
      queryClient.setQueryData(key, { seeded: true });
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.all('sch_a') });

    for (const key of schoolKeys) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
    expect(queryClient.getQueryState(otherSchoolKey)?.isInvalidated).toBe(false);
  });
});
