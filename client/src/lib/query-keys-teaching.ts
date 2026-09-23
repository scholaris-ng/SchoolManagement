import type { ListQuery } from '@/types/api';
import { scoped, type Scope } from './query-scope';

/** Cache keys for results, finance, curriculum, the timetable and assessments. */
export const teachingKeys = {
  results: {
    schemes: (schoolId: Scope) => scoped(schoolId, 'grading-schemes'),
    schemeDetail: (schoolId: Scope, id: string) => scoped(schoolId, 'grading-schemes', id),
    scoreSheets: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'score-sheets', query ?? {}),
    scoreSheet: (schoolId: Scope, id: string) => scoped(schoolId, 'score-sheets', id),
    reportCard: (schoolId: Scope, studentId: string, termId: string) =>
      scoped(schoolId, 'report-cards', studentId, termId),
    reportCards: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'report-cards', query ?? {}),
    broadsheet: (schoolId: Scope, classId: string, termId: string) =>
      scoped(schoolId, 'broadsheet', classId, termId),
    comments: (schoolId: Scope) => scoped(schoolId, 'comment-templates'),
    analytics: (schoolId: Scope, termId?: string) =>
      scoped(schoolId, 'result-analytics', termId ?? 'current'),
    transcript: (schoolId: Scope, studentId: string) => scoped(schoolId, 'transcripts', studentId),
  },

  finance: {
    overview: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'finance', query ?? {}),
    feeItems: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'fee-items', query ?? {}),
    structures: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'fee-structures', query ?? {}),
    structure: (schoolId: Scope, id: string) => scoped(schoolId, 'fee-structures', id),
    discounts: (schoolId: Scope) => scoped(schoolId, 'discounts'),
    /** The discounts granted to one student — what their next invoice will carry. */
    studentDiscounts: (schoolId: Scope, studentId: string) =>
      scoped(schoolId, 'student-discounts', studentId),
    /** The school's own bank accounts, managed once centrally — see `PaymentDestination`. */
    paymentDestinations: (schoolId: Scope) => scoped(schoolId, 'payment-destinations'),
    paymentDestinationDuplicates: (schoolId: Scope) =>
      scoped(schoolId, 'payment-destination-duplicates'),
    invoices: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'invoices', query ?? {}),
    invoice: (schoolId: Scope, id: string) => scoped(schoolId, 'invoices', id),
    payments: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'payments', query ?? {}),
    payment: (schoolId: Scope, id: string) => scoped(schoolId, 'payments', id),
    paymentAccounts: (schoolId: Scope, studentId: string) =>
      scoped(schoolId, 'payment-accounts', studentId),
    receipt: (schoolId: Scope, paymentId: string) => scoped(schoolId, 'receipts', paymentId),
    /** Every copy of every finance document this school has sent — the register itself. */
    deliveries: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'document-deliveries', query ?? {}),
    /** The copies of one document that have gone out, for the card on its page. */
    documentDeliveries: (schoolId: Scope, documentType: string, documentId: string) =>
      scoped(schoolId, 'document-deliveries', documentType, documentId),
    debtors: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'debtors', query ?? {}),
    /** One student's own submitted claims — the family's view and the office's, on one student. */
    paymentReceipts: (schoolId: Scope, studentId: string) =>
      scoped(schoolId, 'payment-receipts', studentId),
    /** The office's whole review queue, across every student. */
    allPaymentReceipts: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'payment-receipts', query ?? {}),
    customBills: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'custom-bills', query ?? {}),
    customBill: (schoolId: Scope, id: string) => scoped(schoolId, 'custom-bills', id),
  },

  curriculum: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'curricula', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'curricula', id),
    topics: (schoolId: Scope, id: string) => scoped(schoolId, 'curricula', id, 'topics'),
    coverage: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'coverage', query ?? {}),
    schemes: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'schemes', query ?? {}),
    scheme: (schoolId: Scope, id: string) => scoped(schoolId, 'schemes', id),
    lessonNotes: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'lesson-notes', query ?? {}),
    lessonNote: (schoolId: Scope, id: string) => scoped(schoolId, 'lesson-notes', id),
  },

  timetable: {
    list: (schoolId: Scope) => scoped(schoolId, 'timetables'),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'timetables', id),
    forClass: (schoolId: Scope, classId: string) => scoped(schoolId, 'timetables', 'class', classId),
    forTeacher: (schoolId: Scope, staffId: string) =>
      scoped(schoolId, 'timetables', 'teacher', staffId),
    periods: (schoolId: Scope) => scoped(schoolId, 'periods'),
  },

  calendar: {
    events: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'calendar', query ?? {}),
    event: (schoolId: Scope, id: string) => scoped(schoolId, 'calendar', id),
  },

  cbt: {
    questions: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'questions', query ?? {}),
    assessments: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'assessments', query ?? {}),
    assessment: (schoolId: Scope, id: string) => scoped(schoolId, 'assessments', id),
    attempt: (schoolId: Scope, id: string) => scoped(schoolId, 'attempts', id),
    attemptResult: (schoolId: Scope, id: string) => scoped(schoolId, 'attempts', id, 'result'),
    myAttempts: (schoolId: Scope) => scoped(schoolId, 'attempts', 'mine'),
  }
,
} as const;
