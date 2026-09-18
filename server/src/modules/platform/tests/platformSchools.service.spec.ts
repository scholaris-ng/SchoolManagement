const mockFindAll = jest.fn();
const mockExtend = jest.fn();
const mockRecordSystem = jest.fn().mockResolvedValue(undefined);

jest.mock('../repositories/platformSchools.repository', () => ({
  PlatformSchoolsRepository: { Instance: { findAll: mockFindAll, extendAccess: mockExtend } },
}));
jest.mock('../../audit/services/audit.service', () => ({
  AuditService: { Instance: { recordSystem: mockRecordSystem } },
}));

import { PlatformSchoolsService } from '../services/platformSchools.service';

const DAY = 24 * 60 * 60 * 1000;

const row = (over: Record<string, unknown> = {}) => ({
  id: '3f1c1e60-1f2a-4c9b-9a01-2b7d4e5f6a01',
  name: 'Brightfield College',
  code: 'BFC',
  slug: 'brightfield',
  email: 'office@brightfield.example',
  phone: '08030000000',
  status: 'TRIAL',
  accessEndsAt: new Date(Date.now() + 3 * DAY),
  lastActivatedAt: null,
  lastActivatedBy: null,
  createdAt: new Date('2026-09-01T09:00:00Z'),
  ...over,
});

const admin = { email: 'edoghotugiddy@gmail.com', requestId: 'req-1', ipAddress: '10.0.0.1', userAgent: 'jest' };

beforeEach(() => {
  mockFindAll.mockReset();
  mockExtend.mockReset();
  mockRecordSystem.mockClear();
});

describe('PlatformSchoolsService.list', () => {
  it('reports each school’s trial, days left and whether it has lapsed', async () => {
    mockFindAll.mockResolvedValue([
      row(),
      row({ id: 'b', name: 'Lapsed School', accessEndsAt: new Date(Date.now() - 2 * DAY) }),
    ]);

    const [open, lapsed] = await PlatformSchoolsService.Instance.list();

    expect(open).toMatchObject({ name: 'Brightfield College', plan: 'TRIAL', expired: false, daysLeft: 3 });
    expect(lapsed).toMatchObject({ name: 'Lapsed School', expired: true, daysLeft: 0 });
  });
});

describe('PlatformSchoolsService.activate', () => {
  const activated = () =>
    row({
      status: 'ACTIVE',
      previousEndsAt: new Date('2026-09-20T12:00:00Z'),
      accessEndsAt: new Date('2026-10-20T12:00:00Z'),
      lastActivatedAt: new Date('2026-09-18T12:00:00Z'),
      lastActivatedBy: 'edoghotugiddy@gmail.com',
    });

  it('extends the school and returns it as active, naming who did it', async () => {
    mockExtend.mockResolvedValue(activated());

    const school = await PlatformSchoolsService.Instance.activate(admin, 'school-1', 1);

    expect(mockExtend).toHaveBeenCalledWith('school-1', 'edoghotugiddy@gmail.com', 1);
    expect(school).toMatchObject({
      plan: 'ACTIVE',
      endsAt: '2026-10-20T12:00:00.000Z',
      lastActivatedBy: 'edoghotugiddy@gmail.com',
    });
  });

  it('records it in the school’s own audit trail, with the dates either side', async () => {
    mockExtend.mockResolvedValue(activated());

    await PlatformSchoolsService.Instance.activate(admin, 'school-1', 1);

    expect(mockRecordSystem).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        action: 'school.activated',
        entityType: 'School',
        entityLabel: 'Brightfield College',
        before: { accessEndsAt: '2026-09-20T12:00:00.000Z' },
        after: { accessEndsAt: '2026-10-20T12:00:00.000Z', monthsAdded: 1 },
        actorName: 'edoghotugiddy@gmail.com',
        actorRole: 'Platform administrator',
        requestId: 'req-1',
      }),
    );
  });

  it('gives as many months as were asked for, and records how many', async () => {
    mockExtend.mockResolvedValue(activated());

    await PlatformSchoolsService.Instance.activate(admin, 'school-1', 12);

    expect(mockExtend).toHaveBeenCalledWith('school-1', 'edoghotugiddy@gmail.com', 12);
    expect(mockRecordSystem).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ after: expect.objectContaining({ monthsAdded: 12 }) }),
    );
  });

  it('gives one month when none is named', async () => {
    mockExtend.mockResolvedValue(activated());

    await PlatformSchoolsService.Instance.activate(admin, 'school-1');

    expect(mockExtend).toHaveBeenCalledWith('school-1', 'edoghotugiddy@gmail.com', 1);
  });

  it('says so, and records nothing, when there is no such school', async () => {
    mockExtend.mockResolvedValue(null);

    await expect(PlatformSchoolsService.Instance.activate(admin, 'nope')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRecordSystem).not.toHaveBeenCalled();
  });
});
