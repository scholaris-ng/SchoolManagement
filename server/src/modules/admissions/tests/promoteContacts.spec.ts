import { FindOperator } from 'typeorm';
import { AdmissionsService } from '../services/admissions.service';
import type { ApplicationContact } from '../entities/admissionApplication.entity';

/**
 * Enrolment turns an application's typed-in contacts into real guardian
 * records and links them to the new pupil.
 *
 * The question that matters is "is this person already a guardian here?", and
 * an email address alone cannot answer it: two parents on one family address,
 * or a placeholder such as `nil@gmail.com` typed because a form asked for one.
 * `guardians` has a unique index on (school, email), so the second person to
 * arrive with an address somebody holds cannot simply be given it — and must
 * not be quietly folded into the first.
 */

interface Row {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  hasPortalAccess: boolean;
  deletedAt: Date | null;
  [key: string]: unknown;
}

/** Just enough of an `EntityManager` for `promoteContacts`, with the unique email index enforced. */
class FakeManager {
  guardians: Row[] = [];
  links: { studentId: string; guardianId: string; isPrimaryContact: boolean }[] = [];
  private nextId = 1;

  create(entity: { name: string }, data: Record<string, unknown>) {
    return { __entity: entity.name, ...data };
  }

  async save(row: Record<string, unknown>) {
    if (row.__entity === 'Guardian') {
      const email = (row.email as string | null) ?? null;
      if (email && this.guardians.some((g) => g.schoolId === row.schoolId && g.email === email)) {
        throw new Error('duplicate key value violates unique constraint "IDX_guardians_school_email"');
      }
      const saved = { deletedAt: null, ...row, id: `g-${this.nextId++}` } as unknown as Row;
      this.guardians.push(saved);
      return saved;
    }
    this.links.push(row as never);
    return row;
  }

  async findOne(
    _entity: unknown,
    options: { where: Record<string, unknown>; withDeleted?: boolean },
  ): Promise<Row | null> {
    const found = this.guardians.find((guardian) => {
      if (guardian.deletedAt && !options.withDeleted) return false;
      return Object.entries(options.where).every(([key, wanted]) => {
        const actual = guardian[key];
        if (wanted instanceof FindOperator) return actual === null || actual === undefined;
        return actual === wanted;
      });
    });
    return found ?? null;
  }
}

const SCHOOL = 'school-1';

const contact = (over: Partial<ApplicationContact> = {}): ApplicationContact => ({
  title: null,
  firstName: 'Ifeanyi',
  lastName: 'Samuel',
  relationship: 'FATHER',
  email: 'nil@gmail.com',
  phone: '08168866788',
  occupation: null,
  address: null,
  city: null,
  state: null,
  isPrimaryContact: false,
  ...over,
});

const father = contact();
const mother = contact({
  firstName: 'Victoria',
  lastName: 'Samuel',
  relationship: 'MOTHER',
  phone: '07080011974',
  isPrimaryContact: true,
});

function knownGuardian(over: Partial<Row> = {}): Row {
  return {
    id: 'g-existing',
    schoolId: SCHOOL,
    firstName: 'Chika',
    lastName: 'Okoro',
    email: 'nil@gmail.com',
    phone: '08011111111',
    hasPortalAccess: false,
    deletedAt: null,
    ...over,
  };
}

async function promote(
  manager: FakeManager,
  contacts: ApplicationContact[],
  studentId = 'student-1',
): Promise<string[]> {
  const service = AdmissionsService.Instance as unknown as {
    promoteContacts(
      manager: unknown,
      schoolId: string,
      studentId: string,
      contacts: ApplicationContact[],
      linked: unknown[],
    ): Promise<string[]>;
  };
  return service.promoteContacts(manager, SCHOOL, studentId, contacts, []);
}

const namesLinked = (manager: FakeManager, studentId = 'student-1') =>
  manager.links
    .filter((link) => link.studentId === studentId)
    .map((link) => {
      const guardian = manager.guardians.find((g) => g.id === link.guardianId)!;
      return `${guardian.firstName} ${guardian.lastName}`;
    })
    .sort();

describe('promoteContacts', () => {
  it('saves and links both parents when they share one email address', async () => {
    const manager = new FakeManager();

    await promote(manager, [father, mother]);

    expect(namesLinked(manager)).toEqual(['Ifeanyi Samuel', 'Victoria Samuel']);
    expect(manager.guardians).toHaveLength(2);
  });

  it('gives the shared address to the primary contact only, and invites only them', async () => {
    const manager = new FakeManager();

    // The father is listed first, but the mother is the primary contact.
    const invite = await promote(manager, [father, mother]);

    const victoria = manager.guardians.find((g) => g.firstName === 'Victoria')!;
    const ifeanyi = manager.guardians.find((g) => g.firstName === 'Ifeanyi')!;
    expect(victoria.email).toBe('nil@gmail.com');
    expect(ifeanyi.email).toBeNull();
    expect(invite).toEqual([victoria.id]);
  });

  it('keeps the address on whoever is first when neither is the primary contact', async () => {
    const manager = new FakeManager();

    await promote(manager, [father, { ...mother, isPrimaryContact: false }]);

    expect(manager.guardians.find((g) => g.firstName === 'Ifeanyi')?.email).toBe('nil@gmail.com');
    expect(manager.guardians.find((g) => g.firstName === 'Victoria')?.email).toBeNull();
  });

  it('keeps two different first names apart even when the surname and address are shared', async () => {
    const manager = new FakeManager();
    manager.guardians.push(
      knownGuardian({
        id: 'g-ifeanyi',
        firstName: 'Ifeanyi',
        lastName: 'Samuel',
        email: 'nil@gmail.com',
      }),
    );

    await promote(manager, [mother]);

    // Victoria Samuel is not Ifeanyi Samuel just because the surname and address match.
    expect(namesLinked(manager)).toEqual(['Victoria Samuel']);
    expect(manager.links.some((link) => link.guardianId === 'g-ifeanyi')).toBe(false);
  });

  it('keeps the primary contact on the parent who was marked as one', async () => {
    const manager = new FakeManager();

    await promote(manager, [father, mother]);

    const primary = manager.links.filter((link) => link.isPrimaryContact);
    expect(primary).toHaveLength(1);
    expect(manager.guardians.find((g) => g.id === primary[0].guardianId)?.firstName).toBe('Victoria');
  });

  it('does not attach a child to somebody else’s guardian record that happens to hold the address', async () => {
    const manager = new FakeManager();
    manager.guardians.push(knownGuardian());

    await promote(manager, [father, mother]);

    expect(namesLinked(manager)).toEqual(['Ifeanyi Samuel', 'Victoria Samuel']);
    // The stranger keeps the address, and keeps only their own children.
    expect(manager.links.some((link) => link.guardianId === 'g-existing')).toBe(false);
    expect(manager.guardians.find((g) => g.id === 'g-existing')?.email).toBe('nil@gmail.com');
  });

  it('still recognises a parent already on the roll, so a second child does not create a second mother', async () => {
    const manager = new FakeManager();
    manager.guardians.push(
      knownGuardian({
        id: 'g-victoria',
        firstName: 'Victoria',
        lastName: 'Samuel',
        email: 'victoria@example.com',
      }),
    );

    await promote(manager, [contact({ ...mother, email: 'victoria@example.com' })]);

    expect(manager.guardians).toHaveLength(1);
    expect(manager.links.map((link) => link.guardianId)).toEqual(['g-victoria']);
  });

  it('recognises the same parent with the name typed in a different order or with a middle name', async () => {
    const manager = new FakeManager();
    manager.guardians.push(
      knownGuardian({
        id: 'g-victoria',
        firstName: 'Victoria',
        lastName: 'Samuel',
        email: 'victoria@example.com',
      }),
    );

    await promote(manager, [
      contact({
        firstName: 'Samuel',
        lastName: 'Victoria Ada',
        email: 'victoria@example.com',
        relationship: 'MOTHER',
      }),
    ]);

    expect(manager.guardians).toHaveLength(1);
    expect(manager.links.map((link) => link.guardianId)).toEqual(['g-victoria']);
  });

  it('does not collide with a deleted guardian that still holds the address', async () => {
    const manager = new FakeManager();
    manager.guardians.push(knownGuardian({ deletedAt: new Date() }));

    await promote(manager, [father]);

    expect(namesLinked(manager)).toEqual(['Ifeanyi Samuel']);
    expect(manager.guardians.find((g) => g.firstName === 'Ifeanyi')?.email).toBeNull();
  });

  it('matches a parent without an email by exact phone and name, as before', async () => {
    const manager = new FakeManager();
    manager.guardians.push(
      knownGuardian({
        id: 'g-ifeanyi',
        firstName: 'Ifeanyi',
        lastName: 'Samuel',
        email: null,
        phone: '08168866788',
      }),
    );

    await promote(manager, [contact({ email: null })]);

    expect(manager.guardians).toHaveLength(1);
    expect(manager.links.map((link) => link.guardianId)).toEqual(['g-ifeanyi']);
  });
});
