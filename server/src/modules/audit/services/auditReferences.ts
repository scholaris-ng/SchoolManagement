import type { AuditLog } from '../entities/auditLog.entity';

/**
 * Turning the ids inside an audit entry back into names.
 *
 * An entry is written once and never edited, and what it captures is a
 * snapshot: `classId`, `guardianId`, `termId`. Those are the right thing to
 * store — a name can change, an id cannot — but they mean nothing to the person
 * reading the trail. So the names are looked up when the trail is *read*, by
 * the record's id, and sent alongside the entry rather than written into it.
 * The stored entry stays exactly as it was, and entries written long before
 * this existed read just as well as new ones.
 */

/** Every record type an entry can be resolved to. The repository holds one lookup per name. */
export const REFERENCE_TYPES = [
  'AcademicSession',
  'AdmissionApplication',
  'Curriculum',
  'Discount',
  'FeeItem',
  'Guardian',
  'House',
  'Invoice',
  'Payment',
  'PaymentDestination',
  'Room',
  'SchoolClass',
  'SchoolLevel',
  'Staff',
  'Student',
  'Subject',
  'Term',
  'TimetablePeriod',
] as const;

export type ReferenceType = (typeof REFERENCE_TYPES)[number];

/** A record an entry points at, named the way a person would say it. */
export interface AuditReference {
  type: ReferenceType;
  label: string;
  /** Soft-deleted since the entry was written — the name is still true, the record is gone. */
  removed: boolean;
}

export interface ResolvedRecord {
  label: string;
  removed: boolean;
}

/** One lookup per type. An id that matches nothing is absent from the map, not an error. */
export type ReferenceLookup = (
  type: ReferenceType,
  ids: string[],
) => Promise<Map<string, ResolvedRecord>>;

export type AuditEntryDTO = AuditLog & {
  /** Keyed by record id. Holds only ids this entry mentions, and only those that still resolve. */
  references: Record<string, AuditReference>;
};

/** Payload keys that carry a record id, and what kind of record it is. */
const KEY_TARGETS: Record<string, ReferenceType | 'self'> = {
  classId: 'SchoolClass',
  studentId: 'Student',
  guardianId: 'Guardian',
  termId: 'Term',
  sessionId: 'AcademicSession',
  subjectId: 'Subject',
  levelId: 'SchoolLevel',
  houseId: 'House',
  roomId: 'Room',
  periodId: 'TimetablePeriod',
  // A timetable lesson's teacher and a class's form teachers are both staff.
  teacherId: 'Staff',
  formTeacherIds: 'Staff',
  curriculumId: 'Curriculum',
  discountId: 'Discount',
  invoiceId: 'Invoice',
  paymentId: 'Payment',
  // Generic list keys mean "more of what this entry is about".
  ids: 'self',
  mergedIds: 'self',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Deep enough for a settings snapshot, shallow enough that a bad payload cannot run away. */
const MAX_DEPTH = 3;

export function isReferenceType(value: string): value is ReferenceType {
  return (REFERENCE_TYPES as readonly string[]).includes(value);
}

/**
 * Every (type, id) an entry mentions — the record it is about, plus anything
 * its before/after payloads point at.
 *
 * Ids are checked against the uuid shape here, not left to the database: an
 * attendance register's `entityId` is `<classId>:<date>`, and handing that to a
 * `::uuid[]` cast would fail the whole page's lookup rather than that one row.
 */
export function referencesIn(entry: AuditLog): Map<ReferenceType, Set<string>> {
  const found = new Map<ReferenceType, Set<string>>();

  const add = (type: ReferenceType, id: unknown) => {
    if (typeof id !== 'string' || !UUID.test(id)) return;
    const ids = found.get(type) ?? new Set<string>();
    ids.add(id);
    found.set(type, ids);
  };

  if (isReferenceType(entry.entityType)) add(entry.entityType, entry.entityId);

  const scan = (value: unknown, depth: number) => {
    if (depth > MAX_DEPTH || value === null || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const target = KEY_TARGETS[key];
      if (target) {
        const type = target === 'self' ? entry.entityType : target;
        if (isReferenceType(type)) {
          for (const id of Array.isArray(child) ? child : [child]) add(type, id);
        }
      } else {
        scan(child, depth + 1);
      }
    }
  };
  scan(entry.before, 0);
  scan(entry.after, 0);

  return found;
}

/**
 * Attaches names to a page of entries with one lookup per record type, however
 * many entries or ids there are.
 *
 * Best effort by design. The trail is the record of last resort, and it must
 * open even if a lookup fails — a failed type simply leaves its ids unnamed,
 * and the screen says so instead of the whole page erroring.
 */
export async function attachReferences(
  entries: AuditLog[],
  lookup: ReferenceLookup,
  onError: (type: ReferenceType, error: unknown) => void = () => undefined,
): Promise<AuditEntryDTO[]> {
  const perEntry = entries.map(referencesIn);

  const wanted = new Map<ReferenceType, Set<string>>();
  for (const found of perEntry) {
    for (const [type, ids] of found) {
      const all = wanted.get(type) ?? new Set<string>();
      ids.forEach((id) => all.add(id));
      wanted.set(type, all);
    }
  }

  const resolved = new Map<ReferenceType, Map<string, ResolvedRecord>>();
  await Promise.all(
    [...wanted].map(async ([type, ids]) => {
      try {
        resolved.set(type, await lookup(type, [...ids]));
      } catch (error) {
        onError(type, error);
      }
    }),
  );

  return entries.map((entry, index) => {
    const references: Record<string, AuditReference> = {};
    for (const [type, ids] of perEntry[index]) {
      for (const id of ids) {
        const record = resolved.get(type)?.get(id);
        if (record) references[id] = { type, label: record.label, removed: record.removed };
      }
    }
    return Object.assign(entry, { references });
  });
}
