import type { AuditLog } from '../entities/auditLog.entity';
import {
  attachReferences,
  referencesIn,
  type ReferenceLookup,
  type ReferenceType,
  type ResolvedRecord,
} from '../services/auditReferences';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function entry(over: Partial<AuditLog> = {}): AuditLog {
  return {
    id: id(900),
    schoolId: id(1),
    actorUserId: id(2),
    actorName: 'Oyeyemi Adeshina',
    actorRole: 'ADMISSION_OFFICER',
    action: 'admission.converted',
    entityType: 'AdmissionApplication',
    entityId: id(10),
    entityLabel: 'APP/2026-2027/0047',
    before: null,
    after: null,
    ipAddress: null,
    userAgent: null,
    requestId: null,
    severity: 'INFO',
    occurredAt: new Date('2026-09-21T13:23:00Z'),
    ...over,
  };
}

const idsOf = (found: Map<ReferenceType, Set<string>>, type: ReferenceType) => [
  ...(found.get(type) ?? []),
];

/** A lookup over a fixed directory, recording each call it receives. */
function directory(records: Partial<Record<ReferenceType, Record<string, ResolvedRecord>>>) {
  const calls: { type: ReferenceType; ids: string[] }[] = [];
  const lookup: ReferenceLookup = async (type, ids) => {
    calls.push({ type, ids });
    const known = records[type] ?? {};
    return new Map(ids.filter((wanted) => known[wanted]).map((wanted) => [wanted, known[wanted]]));
  };
  return { lookup, calls };
}

describe('referencesIn', () => {
  it('finds the record the entry is about, and every id its payload points at', () => {
    const found = referencesIn(
      entry({
        after: { studentId: id(20), admissionNo: 'A1S/2026/0046', classId: id(30), guardiansAttached: 1 },
      }),
    );

    expect(idsOf(found, 'AdmissionApplication')).toEqual([id(10)]);
    expect(idsOf(found, 'Student')).toEqual([id(20)]);
    expect(idsOf(found, 'SchoolClass')).toEqual([id(30)]);
  });

  it('reads both the before and the after side', () => {
    const found = referencesIn(
      entry({
        entityType: 'Student',
        before: { classId: id(31) },
        after: { classId: id(32) },
      }),
    );

    expect(idsOf(found, 'SchoolClass').sort()).toEqual([id(31), id(32)]);
  });

  it('reads a list of ids, such as a class\'s form teachers', () => {
    const found = referencesIn(
      entry({
        entityType: 'SchoolClass',
        after: { name: 'JSS 1', formTeacherIds: [id(40), id(41)] },
      }),
    );

    expect(idsOf(found, 'Staff')).toEqual([id(40), id(41)]);
  });

  it('reads a bare "ids" list as more of whatever the entry is about', () => {
    const found = referencesIn(
      entry({ entityType: 'FeeItem', entityId: id(50), after: { ids: [id(50), id(51)] } }),
    );

    expect(idsOf(found, 'FeeItem').sort()).toEqual([id(50), id(51)]);
  });

  it('finds ids inside a nested object, but does not chase a payload forever', () => {
    const shallow = referencesIn(entry({ after: { settings: { nested: { classId: id(30) } } } }));
    expect(idsOf(shallow, 'SchoolClass')).toEqual([id(30)]);

    const deep = referencesIn(
      entry({ after: { a: { b: { c: { d: { classId: id(30) } } } } } }),
    );
    expect(idsOf(deep, 'SchoolClass')).toEqual([]);
  });

  it('skips an entity id that is not a uuid, which would fail the whole ::uuid[] lookup', () => {
    // An attendance register is identified by its class and day, not by a row.
    const found = referencesIn(
      entry({ entityType: 'SchoolClass', entityId: `${id(30)}:2026-09-21` }),
    );

    expect(found.size).toBe(0);
  });

  it('skips a payload value that is not a uuid, or not a string at all', () => {
    const found = referencesIn(
      entry({ entityType: 'ScoreSheet', after: { classId: 'not-a-uuid', studentId: 42, termId: null } }),
    );

    expect(found.size).toBe(0);
  });

  it('skips record types it has no way to name', () => {
    const found = referencesIn(entry({ entityType: 'ScoreSheet', entityId: id(60) }));

    expect(found.size).toBe(0);
  });

  it('ignores keys that merely look like ids but are not on its list', () => {
    const found = referencesIn(entry({ entityType: 'ScoreSheet', after: { reviewerId: id(70) } }));

    expect(found.size).toBe(0);
  });
});

describe('attachReferences', () => {
  it('names the ids each entry mentions, with the kind of record and whether it is gone', async () => {
    const { lookup } = directory({
      Student: { [id(20)]: { label: 'Lotanna Ohanyere (A1S/2026/0046)', removed: false } },
      SchoolClass: { [id(30)]: { label: 'JSS 1 A', removed: true } },
    });

    const [result] = await attachReferences(
      [entry({ after: { studentId: id(20), classId: id(30) } })],
      lookup,
    );

    expect(result.references[id(20)]).toEqual({
      type: 'Student',
      label: 'Lotanna Ohanyere (A1S/2026/0046)',
      removed: false,
    });
    expect(result.references[id(30)]).toEqual({ type: 'SchoolClass', label: 'JSS 1 A', removed: true });
  });

  it('makes one lookup per record type however many entries mention it', async () => {
    const { lookup, calls } = directory({
      SchoolClass: {
        [id(30)]: { label: 'JSS 1 A', removed: false },
        [id(31)]: { label: 'JSS 2 B', removed: false },
      },
    });

    await attachReferences(
      [
        entry({ id: id(901), entityType: 'ScoreSheet', after: { classId: id(30) } }),
        entry({ id: id(902), entityType: 'ScoreSheet', after: { classId: id(31) } }),
        entry({ id: id(903), entityType: 'ScoreSheet', after: { classId: id(30) } }),
      ],
      lookup,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('SchoolClass');
    expect(calls[0].ids.sort()).toEqual([id(30), id(31)]);
  });

  it('gives each entry only its own ids, not the whole page\'s', async () => {
    const { lookup } = directory({
      SchoolClass: {
        [id(30)]: { label: 'JSS 1 A', removed: false },
        [id(31)]: { label: 'JSS 2 B', removed: false },
      },
    });

    const [first, second] = await attachReferences(
      [
        entry({ id: id(901), entityType: 'ScoreSheet', after: { classId: id(30) } }),
        entry({ id: id(902), entityType: 'ScoreSheet', after: { classId: id(31) } }),
      ],
      lookup,
    );

    expect(Object.keys(first.references)).toEqual([id(30)]);
    expect(Object.keys(second.references)).toEqual([id(31)]);
  });

  it('leaves an id out when nothing matches it, rather than inventing a name', async () => {
    const { lookup } = directory({});

    const [result] = await attachReferences(
      [entry({ entityType: 'ScoreSheet', after: { classId: id(30) } })],
      lookup,
    );

    expect(result.references).toEqual({});
  });

  it('still returns the page when one type\'s lookup fails, and reports it', async () => {
    const lookup: ReferenceLookup = async (type, ids) => {
      if (type === 'Student') throw new Error('relation "students" does not exist');
      return new Map(ids.map((wanted) => [wanted, { label: 'JSS 1 A', removed: false }]));
    };
    const onError = jest.fn();

    const [result] = await attachReferences(
      [entry({ entityType: 'ScoreSheet', after: { studentId: id(20), classId: id(30) } })],
      lookup,
      onError,
    );

    expect(result.references[id(30)].label).toBe('JSS 1 A');
    expect(result.references[id(20)]).toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe('Student');
  });

  it('makes no lookups at all when there is nothing to name', async () => {
    const { lookup, calls } = directory({});

    const result = await attachReferences([entry({ entityType: 'ScoreSheet' })], lookup);

    expect(calls).toHaveLength(0);
    expect(result[0].references).toEqual({});
  });

  it('keeps the stored entry exactly as it was', async () => {
    const { lookup } = directory({ SchoolClass: { [id(30)]: { label: 'JSS 1 A', removed: false } } });
    const original = entry({ entityType: 'ScoreSheet', after: { classId: id(30) } });

    const [result] = await attachReferences([original], lookup);

    expect(result.after).toEqual({ classId: id(30) });
    expect(result.action).toBe('admission.converted');
  });
});
