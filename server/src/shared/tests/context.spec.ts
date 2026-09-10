import { buildRequestContext, type MembershipContext, type UserContext } from '../types/context';
import { teachingWeeksBetween } from '../utils/weekdays';

const user: UserContext = {
  id: 'usr_1',
  firebaseUid: 'uid_1',
  email: 'teacher@brightfield.edu.ng',
  displayName: 'Funmilayo Adeyemi',
  phone: null,
  photoUrl: null,
  isPlatformAdmin: false,
};

function membership(overrides: Partial<MembershipContext> = {}): MembershipContext {
  return {
    id: 'mem_1',
    schoolId: 'sch_1',
    schoolName: 'Brightfield Academy',
    schoolShortName: 'Brightfield',
    schoolSlug: 'brightfield-academy',
    branchId: null,
    branchName: null,
    roles: ['TEACHER'],
    customRoleNames: [],
    permissions: ['student.read', 'attendance.manage'],
    status: 'ACTIVE',
    guardianId: null,
    studentId: null,
    staffId: 'stf_1',
    ...overrides,
  };
}

describe('buildRequestContext', () => {
  it('derives schoolId from the membership, not from anything the caller sent', () => {
    const context = buildRequestContext({
      user,
      membership: membership(),
      requestId: 'req_1',
      ipAddress: null,
      userAgent: null,
    });

    expect(context.schoolId).toBe('sch_1');
  });

  it('grants exactly the permissions the membership carries', () => {
    const context = buildRequestContext({
      user,
      membership: membership(),
      requestId: 'req_1',
      ipAddress: null,
      userAgent: null,
    });

    expect(context.can('student.read')).toBe(true);
    expect(context.can('attendance.manage')).toBe(true);
    expect(context.can('result.publish')).toBe(false);
    expect(context.can('platform.manage')).toBe(false);
  });

  it('treats platform.manage as implying everything', () => {
    const context = buildRequestContext({
      user,
      membership: membership({ permissions: ['platform.manage'] }),
      requestId: 'req_1',
      ipAddress: null,
      userAgent: null,
    });

    expect(context.can('result.publish')).toBe(true);
    expect(context.can('role.manage')).toBe(true);
  });
});

describe('teachingWeeksBetween', () => {
  it('counts weekdays rather than dividing the span by seven', () => {
    // Monday 8 Sep 2025 to Friday 12 Dec 2025 — 14 school weeks.
    expect(teachingWeeksBetween('2025-09-08', '2025-12-12')).toBe(14);
  });

  it('does not let a term gain a week by ending on a Saturday', () => {
    const friday = teachingWeeksBetween('2025-09-08', '2025-09-12');
    const saturday = teachingWeeksBetween('2025-09-08', '2025-09-13');
    expect(saturday).toBe(friday);
  });

  it('handles a term that starts mid-week', () => {
    // Wednesday to the following Friday: 8 weekdays, so 2 weeks.
    expect(teachingWeeksBetween('2025-09-10', '2025-09-19')).toBe(2);
  });

  it('returns at least one week for any valid range', () => {
    expect(teachingWeeksBetween('2025-09-08', '2025-09-08')).toBe(1);
  });

  it('returns zero for missing or reversed dates', () => {
    expect(teachingWeeksBetween(null, '2025-09-08')).toBe(0);
    expect(teachingWeeksBetween('2025-09-08', null)).toBe(0);
    expect(teachingWeeksBetween('2025-12-12', '2025-09-08')).toBe(0);
  });
});
