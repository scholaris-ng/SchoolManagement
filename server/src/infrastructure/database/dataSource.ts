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
import { Staff } from '../../modules/staff/entities/staff.entity';
import { Student } from '../../modules/students/entities/student.entity';
import { StudentEnrollment } from '../../modules/students/entities/studentEnrollment.entity';
import { StudentDocument } from '../../modules/students/entities/studentDocument.entity';
import { AdmissionApplication } from '../../modules/admissions/entities/admissionApplication.entity';
import { AdmissionStageEvent } from '../../modules/admissions/entities/admissionStageEvent.entity';
import { Guardian } from '../../modules/guardians/entities/guardian.entity';
import { StudentGuardian } from '../../modules/guardians/entities/studentGuardian.entity';
import { TeachingAssignment } from '../../modules/staff/entities/teachingAssignment.entity';
import { FeeItem } from '../../modules/finance/entities/feeItem.entity';
import { Discount } from '../../modules/finance/entities/discount.entity';
import { ImportJob } from '../../modules/imports/entities/importJob.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { NotificationPreference } from '../../modules/notifications/entities/notificationPreference.entity';
import { PushToken } from '../../modules/notifications/entities/pushToken.entity';

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
  Student,
  StudentEnrollment,
  StudentDocument,
  AttendanceRecord,
  Guardian,
  StudentGuardian,
  AdmissionApplication,
  AdmissionStageEvent,
  FeeItem,
  Discount,
  ImportJob,
  Notification,
  NotificationPreference,
  PushToken,
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
