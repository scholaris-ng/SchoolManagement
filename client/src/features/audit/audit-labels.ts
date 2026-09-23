import { humanizeEnum } from '@/lib/utils';

/**
 * The audit trail's own vocabulary, in plain words.
 *
 * Entries store machine names — `admission.converted`, `SchoolClass`,
 * `guardiansAttached` — because those are stable. This turns them into what a
 * bursar or a head teacher would say. Anything not listed here still comes out
 * readable, just less polished, so a new kind of entry never shows up blank.
 */

/** Words that are not simply their own lowercased selves. */
const WORDS: Record<string, string> = { cbt: 'CBT', whatsapp: 'WhatsApp', id: 'ID' };

/** `feeStructure` and `pickup_person` both come out as separate lowercase words. */
function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.\-\s]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => WORDS[word] ?? word);
}

function sentence(text: string): string {
  const [first = '', ...rest] = words(text);
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/** Actions whose machine name does not read as a sentence on its own. */
const ACTIONS: Record<string, string> = {
  'admission.converted': 'Applicant enrolled as a student',
  'admission.submitted.public': 'Application submitted from the public website',
  'admission.created': 'Admission application created',
  'invoice.generated': 'Invoices generated from a fee structure',
  'payment.received': 'Online payment received',
  'student.promoted': 'Class promoted to the next class',
  'collection.child_released': 'Child released to a pick-up person',
  'collection.pickup_person_added': 'Pick-up person added',
  'collection.pickup_person_updated': 'Pick-up person updated',
};

/** `admission.converted` → "Applicant enrolled as a student". */
export function describeAction(action: string): string {
  const known = ACTIONS[action];
  if (known) return known;
  // The "academics." prefix is a module name, not part of what happened.
  return sentence(action.replace(/^academics\./, ''));
}

const RECORD_TYPES: Record<string, string> = {
  SchoolClass: 'Class',
  SchoolLevel: 'Level',
  CbtAssessment: 'CBT assessment',
  TimetableEntry: 'Timetable lesson',
  // Two different things: where families pay the school, and an account number
  // issued to one student to pay into. They must not read the same.
  PaymentDestination: 'School bank account',
  PaymentAccount: 'Collection account',
  AdmissionApplication: 'Admission application',
  // Also two different things, and "Payment receipt" for the first would read
  // as the second: one is the slip a family photographed for the office to
  // check, the other a copy of the school's own receipt going out to them.
  PaymentReceipt: 'Payment slip from a family',
  DocumentDelivery: 'Document sent to a family',
};

/** `SchoolClass` → "Class". */
export function describeRecordType(entityType: string): string {
  return RECORD_TYPES[entityType] ?? sentence(entityType);
}

/**
 * Record types whose `amount`, `total` and `balance` are naira. On anything
 * else — a score sheet's `total` is a mark — the same key is just a number.
 */
const MONEY_RECORDS = new Set([
  'Invoice',
  'Payment',
  'PaymentReceipt',
  'PaymentAccount',
  'CustomBill',
  'FeeItem',
]);

export function carriesMoney(entityType: string): boolean {
  return MONEY_RECORDS.has(entityType);
}

/** `ADMISSION_OFFICER` → "Admission officer". */
export function describeRole(role: string): string {
  return humanizeEnum(role);
}

const FIELDS: Record<string, string> = {
  admissionNo: 'Admission number',
  staffNo: 'Staff number',
  formTeacherIds: 'Form teachers',
  mergedIds: 'Merged accounts',
  ids: 'Items',
  accessEndsAt: 'Access ends',
  monthsAdded: 'Months added',
  photoUrl: 'Photo',
  storagePath: 'Stored at',
};

/**
 * `classId` → "Class", `admissionNo` → "Admission number".
 *
 * A key ending in `Id` names the record it points at, so the suffix is dropped:
 * the value shown beside it is that record's name, not an id.
 */
export function describeField(key: string): string {
  const known = FIELDS[key];
  if (known) return known;
  const withoutId = key.replace(/Ids?$/, '');
  const text = sentence(withoutId || key);
  return text.replace(/ no$/, ' number');
}
