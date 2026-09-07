import { describe, expect, it } from 'vitest';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  membershipLabel,
  resolvePersona,
  satisfies,
} from './permissions';
import type { Permission } from '@/types/rbac';
import type { SchoolMembership } from '@/types/tenant';

/**
 * These checks decide what a user is *shown*. The server repeats every one of
 * them, so a bug here is a usability failure rather than a security hole — but
 * a teacher who sees the bursar's navigation and then gets refused on every
 * click has been failed all the same.
 */

const membership = (over: Partial<SchoolMembership> = {}): SchoolMembership => ({
  id: 'mem_1',
  schoolId: 'sch_1',
  schoolName: 'Brightfield Academy',
  schoolShortName: 'Brightfield',
  schoolSlug: 'brightfield',
  roles: [],
  customRoleNames: [],
  permissions: [],
  branding: { primaryColor: '#4f46e5', accentColor: '#0ea5e9' },
  status: 'ACTIVE',
  ...over,
});

describe('hasPermission', () => {
  it('grants a permission the user holds', () => {
    expect(hasPermission(['student.read'], 'student.read')).toBe(true);
  });

  it('refuses one they do not', () => {
    expect(hasPermission(['student.read'], 'student.update')).toBe(false);
  });

  it('refuses everything when no permissions are granted', () => {
    expect(hasPermission([], 'student.read')).toBe(false);
    expect(hasPermission(undefined, 'student.read')).toBe(false);
  });

  it('treats platform.manage as implying every permission', () => {
    expect(hasPermission(['platform.manage'], 'result.publish')).toBe(true);
    expect(hasPermission(['platform.manage'], 'finance.read')).toBe(true);
  });

  it('does not let an unrelated permission imply another', () => {
    // A near-miss worth pinning: reading results must never imply publishing.
    expect(hasPermission(['result.read'], 'result.publish')).toBe(false);
  });
});

describe('hasAnyPermission / hasAllPermissions', () => {
  const granted: Permission[] = ['attendance.read', 'result.read'];

  it('anyOf passes when at least one is held', () => {
    expect(hasAnyPermission(granted, ['result.publish', 'result.read'])).toBe(true);
  });

  it('anyOf fails when none is held', () => {
    expect(hasAnyPermission(granted, ['finance.read', 'payment.manage'])).toBe(false);
  });

  it('allOf fails when one is missing', () => {
    expect(hasAllPermissions(granted, ['attendance.read', 'attendance.manage'])).toBe(false);
  });

  it('allOf passes when every one is held', () => {
    expect(hasAllPermissions(granted, ['attendance.read', 'result.read'])).toBe(true);
  });

  it('treats an empty requirement as satisfied', () => {
    expect(hasAnyPermission(granted, [])).toBe(true);
    expect(hasAllPermissions(granted, [])).toBe(true);
  });
});

describe('satisfies', () => {
  const granted: Permission[] = ['student.read', 'attendance.read'];

  it('accepts an undefined requirement (an unguarded route)', () => {
    expect(satisfies(granted, undefined)).toBe(true);
  });

  it('handles a bare permission', () => {
    expect(satisfies(granted, 'student.read')).toBe(true);
    expect(satisfies(granted, 'student.delete')).toBe(false);
  });

  it('treats a plain array as anyOf', () => {
    expect(satisfies(granted, ['student.delete', 'attendance.read'])).toBe(true);
  });

  it('handles explicit anyOf and allOf', () => {
    expect(satisfies(granted, { anyOf: ['student.delete', 'student.read'] })).toBe(true);
    expect(satisfies(granted, { allOf: ['student.read', 'student.delete'] })).toBe(false);
    expect(satisfies(granted, { allOf: ['student.read', 'attendance.read'] })).toBe(true);
  });

  it('refuses everything for a user with no permissions', () => {
    expect(satisfies([], { anyOf: ['student.read'] })).toBe(false);
    expect(satisfies([], 'student.read')).toBe(false);
  });
});

describe('resolvePersona', () => {
  it('defaults to parent when there is no membership', () => {
    expect(resolvePersona(null)).toBe('parent');
    expect(resolvePersona(membership({ roles: [] }))).toBe('parent');
  });

  it('maps each role family to its dashboard', () => {
    expect(resolvePersona(membership({ roles: ['SCHOOL_ADMIN'] }))).toBe('admin');
    expect(resolvePersona(membership({ roles: ['BURSAR'] }))).toBe('bursar');
    expect(resolvePersona(membership({ roles: ['TEACHER'] }))).toBe('teacher');
    expect(resolvePersona(membership({ roles: ['STUDENT'] }))).toBe('student');
  });

  it('prefers the staff dashboard when a teacher is also a parent', () => {
    // A teacher whose own child attends the school holds both roles; landing
    // them on the parent dashboard would hide their day's work.
    expect(resolvePersona(membership({ roles: ['PARENT', 'TEACHER'] }))).toBe('teacher');
    expect(resolvePersona(membership({ roles: ['PARENT', 'PRINCIPAL'] }))).toBe('admin');
  });
});

describe('membershipLabel', () => {
  it('is empty without a membership', () => {
    expect(membershipLabel(null)).toBe('');
  });

  it('reads a single role as a sentence', () => {
    expect(membershipLabel(membership({ roles: ['FORM_TEACHER'] }))).toBe('Form teacher');
  });

  it('summarises several roles rather than listing them all', () => {
    expect(membershipLabel(membership({ roles: ['TEACHER', 'FORM_TEACHER'] }))).toBe('Teacher +1');
  });

  it('includes school-defined roles', () => {
    expect(membershipLabel(membership({ customRoleNames: ['Head of Lower School'] }))).toBe(
      'Head of lower school',
    );
  });

  it('falls back when a membership carries no roles at all', () => {
    expect(membershipLabel(membership())).toBe('Member');
  });
});
