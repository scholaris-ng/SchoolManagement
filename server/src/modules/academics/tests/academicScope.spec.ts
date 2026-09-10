import { scopeAllows, type AcademicScope } from '../services/academicScope.service';

/**
 * The pair rule is the one piece of scoping logic that is easy to get subtly
 * wrong and hard to notice: checking `classIds` and `subjectIds` independently
 * looks correct and quietly grants a teacher access to a class/subject
 * combination nobody assigned them.
 */
describe('scopeAllows', () => {
  const unrestricted: AcademicScope = { classIds: null, subjectIds: null, pairs: null };

  // Teaches Biology to JSS 1, and Mathematics to SSS 1. Nothing else.
  const teacher: AcademicScope = {
    classIds: ['jss1', 'sss1'],
    subjectIds: ['biology', 'maths'],
    pairs: [
      { classId: 'jss1', subjectId: 'biology' },
      { classId: 'sss1', subjectId: 'maths' },
    ],
  };

  it('allows anything when the scope is unrestricted', () => {
    expect(scopeAllows(unrestricted, { classId: 'anything', subjectId: 'at-all' })).toBe(true);
  });

  it('allows an assigned class and subject pair', () => {
    expect(scopeAllows(teacher, { classId: 'jss1', subjectId: 'biology' })).toBe(true);
    expect(scopeAllows(teacher, { classId: 'sss1', subjectId: 'maths' })).toBe(true);
  });

  it('refuses a pair the cross-product would wrongly imply', () => {
    // Both halves are individually in scope, and the pairing still is not.
    expect(teacher.classIds).toContain('jss1');
    expect(teacher.subjectIds).toContain('maths');
    expect(scopeAllows(teacher, { classId: 'jss1', subjectId: 'maths' })).toBe(false);
  });

  it('refuses a class outside the scope', () => {
    expect(scopeAllows(teacher, { classId: 'jss3' })).toBe(false);
  });

  it('refuses a subject outside the scope', () => {
    expect(scopeAllows(teacher, { subjectId: 'french' })).toBe(false);
  });

  it('checks the fields independently when only one is named', () => {
    // No pair to check, so "do you teach this at all" is the right question.
    expect(scopeAllows(teacher, { classId: 'jss1' })).toBe(true);
    expect(scopeAllows(teacher, { subjectId: 'maths' })).toBe(true);
  });

  it('sees nothing when the scope is empty rather than unrestricted', () => {
    const none: AcademicScope = { classIds: [], subjectIds: [], pairs: [] };
    expect(scopeAllows(none, { classId: 'jss1' })).toBe(false);
    expect(scopeAllows(none, { classId: 'jss1', subjectId: 'biology' })).toBe(false);
  });
});
