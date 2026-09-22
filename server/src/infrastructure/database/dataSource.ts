import 'reflect-metadata';
import path from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { env } from '../../config/env';

import { School } from '../../modules/school/entities/school.entity';
import { SchoolBranch } from '../../modules/school/entities/schoolBranch.entity';
import { WebsiteContent } from '../../modules/school/entities/websiteContent.entity';
import { User } from '../../modules/auth/entities/user.entity';
import { SchoolMembership } from '../../modules/auth/entities/schoolMembership.entity';
import { EmailVerification } from '../../modules/auth/entities/emailVerification.entity';
import { Role } from '../../modules/rbac/entities/role.entity';
import { MembershipRole } from '../../modules/rbac/entities/membershipRole.entity';
import { AuditLog } from '../../modules/audit/entities/auditLog.entity';
import { AcademicSession } from '../../modules/academics/entities/academicSession.entity';
import { Term } from '../../modules/academics/entities/term.entity';
import { SchoolLevel } from '../../modules/academics/entities/schoolLevel.entity';
import { SchoolClass } from '../../modules/academics/entities/schoolClass.entity';
import { ClassFormTeacher } from '../../modules/academics/entities/classFormTeacher.entity';
import { Subject } from '../../modules/academics/entities/subject.entity';
import { SubjectLevel } from '../../modules/academics/entities/subjectLevel.entity';
import { Room } from '../../modules/academics/entities/room.entity';
import { House } from '../../modules/academics/entities/house.entity';
import { TimetablePeriod } from '../../modules/academics/entities/timetablePeriod.entity';
import { AttendanceRecord } from '../../modules/attendance/entities/attendanceRecord.entity';
import { TimetableEntry } from '../../modules/timetable/entities/timetableEntry.entity';
import { Curriculum } from '../../modules/curriculum/entities/curriculum.entity';
import { CurriculumTopic } from '../../modules/curriculum/entities/curriculumTopic.entity';
import { LearningObjective } from '../../modules/curriculum/entities/learningObjective.entity';
import { SchemeOfWork } from '../../modules/curriculum/entities/schemeOfWork.entity';
import { SchemeWeek } from '../../modules/curriculum/entities/schemeWeek.entity';
import { LessonNote } from '../../modules/curriculum/entities/lessonNote.entity';
import { AssessmentComponent, GradeBand, GradingScheme } from '../../modules/assessment/entities/gradingScheme.entity';
import { ScoreEntry, ScoreSheet } from '../../modules/assessment/entities/scoreSheet.entity';
import { CommentTemplate, ReportCardRecord, TranscriptIssue } from '../../modules/assessment/entities/reportCard.entity';
import { Question } from '../../modules/cbt/entities/question.entity';
import { CbtAssessment, CbtAttempt } from '../../modules/cbt/entities/cbtAssessment.entity';
import { BehaviourScale } from '../../modules/behaviour/entities/behaviourScale.entity';
import { BehaviourTrait } from '../../modules/behaviour/entities/behaviourTrait.entity';
import { BehaviourObservation } from '../../modules/behaviour/entities/behaviourObservation.entity';
import { HousePointAward } from '../../modules/behaviour/entities/housePointAward.entity';
import { PickupPerson } from '../../modules/collection/entities/pickupPerson.entity';
import { CollectionEvent } from '../../modules/collection/entities/collectionEvent.entity';
import { Staff } from '../../modules/staff/entities/staff.entity';
import { Student } from '../../modules/students/entities/student.entity';
import { StudentEnrollment } from '../../modules/students/entities/studentEnrollment.entity';
import { StudentDocument } from '../../modules/students/entities/studentDocument.entity';
import { AdmissionApplication } from '../../modules/admissions/entities/admissionApplication.entity';
import { AdmissionStageEvent } from '../../modules/admissions/entities/admissionStageEvent.entity';
import { AdmissionApplicationGuardian } from '../../modules/admissions/entities/admissionApplicationGuardian.entity';
import { Guardian } from '../../modules/guardians/entities/guardian.entity';
import { StudentGuardian } from '../../modules/guardians/entities/studentGuardian.entity';
import { TeachingAssignment } from '../../modules/staff/entities/teachingAssignment.entity';
import { StaffClassAssignment } from '../../modules/staff/entities/staffClassAssignment.entity';
import { FeeItem } from '../../modules/finance/entities/feeItem.entity';
import { PaymentDestination } from '../../modules/finance/entities/paymentDestination.entity';
import { Discount } from '../../modules/finance/entities/discount.entity';
import { StudentDiscount } from '../../modules/finance/entities/studentDiscount.entity';
import { FeeStructure } from '../../modules/finance/entities/feeStructure.entity';
import { FeeStructureLine } from '../../modules/finance/entities/feeStructureLine.entity';
import { Invoice } from '../../modules/finance/entities/invoice.entity';
import { InvoiceLine } from '../../modules/finance/entities/invoiceLine.entity';
import { PaymentAccount } from '../../modules/finance/entities/paymentAccount.entity';
import { Payment } from '../../modules/finance/entities/payment.entity';
import { PaymentAllocation } from '../../modules/finance/entities/paymentAllocation.entity';
import { PaymentReceipt } from '../../modules/finance/entities/paymentReceipt.entity';
import { CustomBill } from '../../modules/finance/entities/customBill.entity';
import { ImportJob } from '../../modules/imports/entities/importJob.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { NotificationPreference } from '../../modules/notifications/entities/notificationPreference.entity';
import { PushToken } from '../../modules/notifications/entities/pushToken.entity';
import { SmsMessage } from '../../modules/messaging/entities/smsMessage.entity';
import { SmsCreditEntry } from '../../modules/messaging/entities/smsCreditEntry.entity';

/**
 * Entities are listed explicitly rather than glob-loaded: a glob resolves
 * differently under `tsx` and a compiled build, and silently loading nothing is
 * a confusing failure. Adding an entity means adding it here.
 */
export const entities = [
  School,
  SchoolBranch,
  WebsiteContent,
  User,
  SchoolMembership,
  EmailVerification,
  Role,
  MembershipRole,
  AuditLog,
  AcademicSession,
  Term,
  SchoolLevel,
  SchoolClass,
  ClassFormTeacher,
  Subject,
  SubjectLevel,
  Room,
  House,
  TimetablePeriod,
  Staff,
  TeachingAssignment,
  StaffClassAssignment,
  Student,
  StudentEnrollment,
  StudentDocument,
  AttendanceRecord,
  TimetableEntry,
  Curriculum,
  CurriculumTopic,
  LearningObjective,
  SchemeOfWork,
  SchemeWeek,
  LessonNote,
  GradingScheme,
  AssessmentComponent,
  GradeBand,
  ScoreSheet,
  ScoreEntry,
  ReportCardRecord,
  CommentTemplate,
  TranscriptIssue,
  Question,
  CbtAssessment,
  CbtAttempt,
  BehaviourScale,
  BehaviourTrait,
  BehaviourObservation,
  HousePointAward,
  PickupPerson,
  CollectionEvent,
  Guardian,
  StudentGuardian,
  AdmissionApplication,
  AdmissionStageEvent,
  AdmissionApplicationGuardian,
  FeeItem,
  PaymentDestination,
  Discount,
  StudentDiscount,
  FeeStructure,
  FeeStructureLine,
  Invoice,
  InvoiceLine,
  PaymentAccount,
  Payment,
  PaymentAllocation,
  PaymentReceipt,
  CustomBill,
  ImportJob,
  Notification,
  NotificationPreference,
  PushToken,
  SmsMessage,
  SmsCreditEntry,
];

/**
 * Managed providers (Aiven, Neon, Cloud SQL) require TLS but present a
 * certificate chain Node will not verify by default. Local PostgreSQL has no
 * TLS at all. Driving that off `DB_SSL` keeps one configuration working in both
 * places (spec section 48).
 */
function sslOptions(): PostgresConnectionOptions['ssl'] {
  return env.database.ssl ? { rejectUnauthorized: false } : false;
}

const connection: Partial<DataSourceOptions> = env.database.url
  ? { url: env.database.url }
  : {
      host: env.database.host,
      port: env.database.port,
      username: env.database.username,
      password: env.database.password,
      database: env.database.name,
    };

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  ...connection,
  ssl: sslOptions(),
  entities,
  migrations: [path.join(__dirname, 'migrations', '*.ts')],
  migrationsTableName: 'migrations',
  // Never true, in any environment. Schema changes go through a migration so
  // production and development converge on the same DDL (spec section 42).
  synchronize: false,
  logging: env.database.logging ? ['query', 'error', 'warn'] : ['error'],
  poolSize: env.database.poolSize,
  extra: {
    max: env.database.poolSize,
    // A managed database on the far side of a Nigerian link is not always fast
    // to hand out a connection; failing at 10s beats hanging the request.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  },
} as DataSourceOptions;

export const AppDataSource = new DataSource(dataSourceOptions);

export async function initialiseDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Deliberately no default export. The TypeORM CLI refuses a data-source file
// that exports more than one DataSource instance, and a default alongside the
// named `AppDataSource` counts as two.
