import { describe, expect, it } from 'vitest';
import {
  carriesMoney,
  describeAction,
  describeField,
  describeRecordType,
  describeRole,
} from './audit-labels';

describe('describeAction', () => {
  it('says what happened in a sentence for the actions that need one', () => {
    expect(describeAction('admission.converted')).toBe('Applicant enrolled as a student');
    expect(describeAction('admission.submitted.public')).toBe(
      'Application submitted from the public website',
    );
    expect(describeAction('invoice.generated')).toBe('Invoices generated from a fee structure');
  });

  it('reads any other action as words rather than a code', () => {
    expect(describeAction('payment.reversed')).toBe('Payment reversed');
    expect(describeAction('payment.receipt.approved')).toBe('Payment receipt approved');
    expect(describeAction('role.permissions_changed')).toBe('Role permissions changed');
    expect(describeAction('studentDiscount.granted')).toBe('Student discount granted');
  });

  it('drops the module prefix, which is where the code lives, not what happened', () => {
    expect(describeAction('academics.class_created')).toBe('Class created');
    expect(describeAction('academics.current_term_changed')).toBe('Current term changed');
  });

  it('keeps acronyms and brand names written properly', () => {
    expect(describeAction('cbt.assessment_created')).toBe('CBT assessment created');
    expect(describeAction('feeStructure.whatsappShared')).toBe('Fee structure WhatsApp shared');
  });

  it('copes with an action written at run time, like result.published', () => {
    expect(describeAction('result.published')).toBe('Result published');
  });

  it('never returns nothing for an action it has not seen', () => {
    expect(describeAction('something.brand_new')).toBe('Something brand new');
  });
});

describe('describeRecordType', () => {
  it('uses the school\'s own word for a record', () => {
    expect(describeRecordType('SchoolClass')).toBe('Class');
    expect(describeRecordType('AdmissionApplication')).toBe('Admission application');
    expect(describeRecordType('PaymentDestination')).toBe('School bank account');
  });

  it('keeps the school\'s bank account and a student\'s collection account apart', () => {
    expect(describeRecordType('PaymentAccount')).toBe('Collection account');
    expect(describeRecordType('PaymentAccount')).not.toBe(describeRecordType('PaymentDestination'));
  });

  it('spaces out any other name', () => {
    expect(describeRecordType('FeeStructure')).toBe('Fee structure');
    expect(describeRecordType('Student')).toBe('Student');
  });
});

describe('describeRole', () => {
  it('turns a role code into words', () => {
    expect(describeRole('ADMISSION_OFFICER')).toBe('Admission officer');
    expect(describeRole('SCHOOL_ADMIN')).toBe('School admin');
  });
});

describe('describeField', () => {
  it('drops "Id", because the value beside it is a name and not an id', () => {
    expect(describeField('classId')).toBe('Class');
    expect(describeField('guardianId')).toBe('Guardian');
    expect(describeField('sessionId')).toBe('Session');
  });

  it('spells out abbreviations', () => {
    expect(describeField('admissionNo')).toBe('Admission number');
    expect(describeField('staffNo')).toBe('Staff number');
  });

  it('reads a camel-cased key as a phrase', () => {
    expect(describeField('guardiansAttached')).toBe('Guardians attached');
    expect(describeField('screeningScore')).toBe('Screening score');
    expect(describeField('canPickUp')).toBe('Can pick up');
  });

  it('names lists of ids for what they hold', () => {
    expect(describeField('formTeacherIds')).toBe('Form teachers');
    expect(describeField('mergedIds')).toBe('Merged accounts');
  });
});

describe('carriesMoney', () => {
  it('is true for finance records, whose totals are naira', () => {
    expect(carriesMoney('Invoice')).toBe(true);
    expect(carriesMoney('Payment')).toBe(true);
  });

  it('is false elsewhere, where a total might be a mark', () => {
    expect(carriesMoney('ScoreSheet')).toBe(false);
    expect(carriesMoney('Student')).toBe(false);
  });
});
