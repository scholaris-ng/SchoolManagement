import type { ReferenceType } from '../services/auditReferences';

/**
 * How to name one kind of record. `from` always aliases the record's own table
 * as `t`, so the lookup can filter on `t.school_id` and `t.id` the same way for
 * every type — an entry can never surface a name from another school.
 *
 * These are fixed strings, never built from request input; only the school and
 * the ids reach the database as parameters.
 *
 * `softDeletable` says whether the table has a `deleted_at`. A removed record
 * is still looked up — its name is exactly what a person reading the trail
 * wants — and is marked so the screen can say it no longer exists.
 */
interface TableSpec {
  from: string;
  label: string;
  softDeletable: boolean;
}

const NAME = 't.name';

export const REFERENCE_TABLES: Record<ReferenceType, TableSpec> = {
  AcademicSession: { from: 'academic_sessions t', label: NAME, softDeletable: true },
  AdmissionApplication: {
    from: 'admission_applications t',
    label: `concat(t.application_no, ' · ', t.first_name, ' ', t.last_name)`,
    softDeletable: true,
  },
  Curriculum: { from: 'curricula t', label: NAME, softDeletable: false },
  Discount: { from: 'discounts t', label: NAME, softDeletable: true },
  FeeItem: { from: 'fee_items t', label: NAME, softDeletable: true },
  Guardian: {
    from: 'guardians t',
    label: `concat_ws(' ', t.first_name, t.last_name)`,
    softDeletable: true,
  },
  House: { from: 'houses t', label: NAME, softDeletable: true },
  Invoice: { from: 'invoices t', label: 't.invoice_no', softDeletable: false },
  Payment: { from: 'payments t', label: 't.reference', softDeletable: false },
  PaymentDestination: {
    from: 'payment_destinations t',
    label: `concat(t.bank_name, ' · ', t.account_number)`,
    softDeletable: false,
  },
  Room: { from: 'rooms t', label: NAME, softDeletable: true },
  SchoolClass: { from: 'school_classes t', label: NAME, softDeletable: true },
  SchoolLevel: { from: 'school_levels t', label: NAME, softDeletable: true },
  Staff: {
    from: 'staff t',
    label: `concat_ws(' ', t.first_name, t.last_name)`,
    softDeletable: true,
  },
  Student: {
    from: 'students t',
    label: `concat(concat_ws(' ', t.first_name, NULLIF(t.middle_name, ''), t.last_name), ' (', t.admission_no, ')')`,
    softDeletable: true,
  },
  Subject: { from: 'subjects t', label: NAME, softDeletable: true },
  // A term is only ever "First term" — the session is what tells two apart.
  Term: {
    from: 'terms t JOIN academic_sessions s ON s.id = t.session_id',
    label: `concat(t.name, ' · ', s.name)`,
    softDeletable: true,
  },
  TimetablePeriod: { from: 'timetable_periods t', label: NAME, softDeletable: true },
};
