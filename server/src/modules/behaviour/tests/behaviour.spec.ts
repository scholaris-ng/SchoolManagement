import { BehaviourService } from '../services/behaviour.service';
import { BehaviourRepository } from '../repositories/behaviour.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { awardHousePointsSchema, recordObservationSchema } from '../validators/behaviour.schema';
import type { RequestContext } from '../../../shared/types/context';

const context = () =>
  ({
    schoolId: 'school-1',
    user: { id: 'user-1', displayName: 'Mrs Bello' },
    membership: { staffId: 'staff-1', guardianId: null, studentId: null, roles: ['TEACHER'], customRoleNames: [] },
    can: () => true,
    requestId: 'req-1',
    ipAddress: null,
    userAgent: null,
  }) as unknown as RequestContext;

const fivePoint = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very good' },
  { value: 5, label: 'Excellent' },
];

describe('BehaviourService.fetchStudentTermRatings', () => {
  afterEach(() => jest.restoreAllMocks());

  it('averages each trait, labels it from the scale, and keeps the run of ratings', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([{ id: 'term-1', isCurrent: true } as never]);
    jest.spyOn(BehaviourRepository.Instance, 'observationPoints').mockResolvedValue([
      { traitId: 't1', traitName: 'Punctuality', category: 'AFFECTIVE', rating: 3, scaleMax: 5, observedAt: '2026-09-01', scalePoints: fivePoint },
      { traitId: 't1', traitName: 'Punctuality', category: 'AFFECTIVE', rating: 5, scaleMax: 5, observedAt: '2026-09-08', scalePoints: fivePoint },
      { traitId: 't2', traitName: 'Neatness', category: 'PSYCHOMOTOR', rating: 2, scaleMax: 5, observedAt: '2026-09-03', scalePoints: fivePoint },
    ]);

    const rows = await BehaviourService.Instance.fetchStudentTermRatings(context(), 'child-a', undefined);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      traitId: 't1',
      observationCount: 2,
      averageRating: 4,
      label: 'Very good',
      trend: [
        { date: '2026-09-01', rating: 3 },
        { date: '2026-09-08', rating: 5 },
      ],
    });
    expect(rows[1]).toMatchObject({ traitId: 't2', averageRating: 2, label: 'Fair' });
  });

  it("is a 404 for a child the caller may not see", async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(false);
    await expect(
      BehaviourService.Instance.fetchStudentTermRatings(context(), 'child-x', undefined),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('BehaviourService.recordObservation', () => {
  afterEach(() => jest.restoreAllMocks());

  it("refuses a rating outside the trait's scale, naming the range", async () => {
    jest.spyOn(StudentRepository.Instance, 'findOneDTO').mockResolvedValue({ id: 'child-a', currentClassId: 'class-a' } as never);
    jest.spyOn(BehaviourRepository.Instance, 'findTraitDTO').mockResolvedValue({ id: 't1', name: 'Punctuality', scaleId: 's1', isActive: true } as never);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([{ id: 'term-1', isCurrent: true } as never]);
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: null, subjectIds: null, pairs: null });
    jest.spyOn(BehaviourRepository.Instance, 'findScale').mockResolvedValue({ id: 's1', name: 'Five-point scale', min: 1, max: 5 } as never);
    const create = jest.spyOn(BehaviourRepository.Instance, 'createObservation');

    await expect(
      BehaviourService.Instance.recordObservation(context(), { studentId: 'child-a', traitId: 't1', rating: 7, note: null }),
    ).rejects.toMatchObject({ statusCode: 422, message: 'Punctuality is rated from 1 to 5 on the Five-point scale.' });
    expect(create).not.toHaveBeenCalled();
  });

  it('a teacher cannot rate a pupil outside the classes they teach', async () => {
    jest.spyOn(StudentRepository.Instance, 'findOneDTO').mockResolvedValue({ id: 'child-a', currentClassId: 'class-z' } as never);
    jest.spyOn(BehaviourRepository.Instance, 'findTraitDTO').mockResolvedValue({ id: 't1', name: 'Punctuality', scaleId: 's1', isActive: true } as never);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([{ id: 'term-1', isCurrent: true } as never]);
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: ['class-a'], subjectIds: [], pairs: [] });

    await expect(
      BehaviourService.Instance.recordObservation(context(), { studentId: 'child-a', traitId: 't1', rating: 3, note: null }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('behaviour validators', () => {
  const wrap = (body: unknown) => ({ body, query: {}, params: {} });

  it('refuses awarding zero house points', () => {
    expect(awardHousePointsSchema.safeParse(wrap({ studentId: '11111111-1111-4111-8111-111111111111', points: 0, reason: 'OTHER' })).success).toBe(false);
    expect(awardHousePointsSchema.safeParse(wrap({ studentId: '11111111-1111-4111-8111-111111111111', points: -5, reason: 'PENALTY' })).success).toBe(true);
  });

  it('refuses a reason the school does not recognise', () => {
    expect(awardHousePointsSchema.safeParse(wrap({ studentId: '11111111-1111-4111-8111-111111111111', points: 5, reason: 'VIBES' })).success).toBe(false);
  });

  it('coerces the rating and drops a blank note', () => {
    const result = recordObservationSchema.safeParse(
      wrap({ studentId: '11111111-1111-4111-8111-111111111111', traitId: '22222222-2222-4222-8222-222222222222', rating: '4', note: '  ' }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body).toMatchObject({ rating: 4, note: null });
  });
});
