import { addDays, createRandom, isoDate, previousSchoolDays } from './random';
import {
  BEHAVIOUR_TRAITS,
  FEMALE_FIRST_NAMES,
  MALE_FIRST_NAMES,
  MIDDLE_NAMES,
  OCCUPATIONS,
  STATES,
  SUBJECT_CATALOG,
  SURNAMES,
} from './names';
import { DEMO_PERSONAS, permissionsForRoles } from './personas';
import { teachingWeeksBetween } from '@/lib/weekdays';
import type {
  AcademicSession,
  House,
  Room,
  SchoolClass,
  SchoolLevel,
  Subject,
  Term,
} from '@/types/academics';
import type { School } from '@/types/tenant';
import type {
  Guardian,
  PickupPerson,
  CollectionEvent,
  Student,
  StaffMember,
  StudentEnrollment,
  StudentGuardianLink,
} from '@/types/people';
import type { AttendanceRecord } from '@/types/attendance';
import type { GradingScheme, ScoreSheet, CommentTemplate } from '@/types/results';
import type {
  Discount,
  FeeItem,
  FeeStructure,
  Invoice,
  Payment,
} from '@/types/finance';
import type {
  CalendarEvent,
  Curriculum,
  CurriculumTopic,
  LessonNote,
  SchemeOfWork,
  Timetable,
  TimetableEntry,
  TimetablePeriod,
  Weekday,
} from '@/types/curriculum';
import type { AdmissionApplication, AdmissionStageEvent } from '@/types/admissions';
import type {
  BehaviourObservation,
  BehaviourScale,
  BehaviourTrait,
  DisciplineIncident,
  DisciplineTimelineEvent,
  HousePointAward,
} from '@/types/behaviour';
import type {
  Announcement,
  AppNotification,
  AuditLogEntry,
  Conversation,
  ChatMessage,
  NewsPost,
  WebsiteContent,
} from '@/types/engagement';
import type { CbtAssessment, Question } from '@/types/assessment';
import type { AuthenticatedUser, SchoolMembership } from '@/types/tenant';
import type { Role } from '@/types/rbac';
import type { ImportJob } from '@/types/imports';

/**
 * In-memory fixture database for development.
 *
 * It is shaped like the relational model the Express/TypeORM server will own:
 * every row carries `schoolId`, enrolments are historical rather than mutated,
 * and balances are derived from invoices and payments rather than stored. That
 * keeps the client honest about the contract it is being written against.
 */
export interface MockDb {
  schools: School[];
  users: AuthenticatedUser[];
  roles: Role[];
  sessions: AcademicSession[];
  terms: Term[];
  levels: SchoolLevel[];
  classes: SchoolClass[];
  subjects: Subject[];
  rooms: Room[];
  houses: House[];
  staff: StaffMember[];
  students: Student[];
  guardians: Guardian[];
  studentGuardians: StudentGuardianLink[];
  enrollments: StudentEnrollment[];
  attendance: AttendanceRecord[];
  gradingSchemes: GradingScheme[];
  scoreSheets: ScoreSheet[];
  commentTemplates: CommentTemplate[];
  feeItems: FeeItem[];
  feeStructures: FeeStructure[];
  discounts: Discount[];
  invoices: Invoice[];
  payments: Payment[];
  curricula: Curriculum[];
  topics: CurriculumTopic[];
  schemes: SchemeOfWork[];
  lessonNotes: LessonNote[];
  periods: TimetablePeriod[];
  timetables: Timetable[];
  calendarEvents: CalendarEvent[];
  admissions: AdmissionApplication[];
  behaviourScales: BehaviourScale[];
  behaviourTraits: BehaviourTrait[];
  observations: BehaviourObservation[];
  housePoints: HousePointAward[];
  incidents: DisciplineIncident[];
  pickupPersons: PickupPerson[];
  collectionEvents: CollectionEvent[];
  questions: Question[];
  assessments: CbtAssessment[];
  announcements: Announcement[];
  news: NewsPost[];
  conversations: Conversation[];
  messages: ChatMessage[];
  notifications: AppNotification[];
  auditLog: AuditLogEntry[];
  websites: WebsiteContent[];
  importJobs: ImportJob[];
}

const random = createRandom();
let counter = 0;
const id = (prefix: string) => `${prefix}_${(counter += 1).toString(36).padStart(5, '0')}`;

const TODAY = new Date();
const CURRENT_YEAR = TODAY.getMonth() >= 8 ? TODAY.getFullYear() : TODAY.getFullYear() - 1;

const SCHOOL_BLUEPRINTS = [
  {
    name: 'Brightfield Academy',
    shortName: 'Brightfield',
    code: 'BFA',
    slug: 'brightfield',
    city: 'Lekki',
    state: 'Lagos',
    primary: '#4f46e5',
    accent: '#0ea5e9',
    motto: 'Knowledge, Character, Service',
    levels: [
      { name: 'Creche', code: 'CRE', arms: ['A'] },
      { name: 'Nursery', code: 'NUR', arms: ['1', '2'] },
      { name: 'Primary', code: 'PRI', arms: ['1', '2', '3', '4', '5'] },
      { name: 'Junior Secondary', code: 'JSS', arms: ['1', '2', '3'] },
      { name: 'Senior Secondary', code: 'SSS', arms: ['1', '2', '3'] },
    ],
    studentsPerClass: 18,
  },
  {
    name: 'Rivercrest School',
    shortName: 'Rivercrest',
    code: 'RCS',
    slug: 'rivercrest',
    city: 'Enugu',
    state: 'Enugu',
    primary: '#0f766e',
    accent: '#f59e0b',
    motto: 'Rise and Build',
    levels: [
      { name: 'Reception', code: 'REC', arms: ['A'] },
      { name: 'Lower School', code: 'LOW', arms: ['1', '2', '3'] },
      { name: 'Upper School', code: 'UPP', arms: ['4', '5', '6'] },
    ],
    studentsPerClass: 12,
  },
] as const;

const HOUSE_BLUEPRINTS = [
  { name: 'Red', color: '#dc2626', motto: 'Courage first' },
  { name: 'Blue', color: '#2563eb', motto: 'Steady and true' },
  { name: 'Green', color: '#16a34a', motto: 'Grow together' },
  { name: 'Yellow', color: '#ca8a04', motto: 'Shine bright' },
];

export function buildSeed(): MockDb {
  const db: MockDb = {
    schools: [], users: [], roles: [], sessions: [], terms: [], levels: [], classes: [],
    subjects: [], rooms: [], houses: [], staff: [], students: [], guardians: [],
    studentGuardians: [], enrollments: [], attendance: [], gradingSchemes: [], scoreSheets: [],
    commentTemplates: [], feeItems: [], feeStructures: [], discounts: [], invoices: [],
    payments: [], curricula: [], topics: [], schemes: [], lessonNotes: [], periods: [],
    timetables: [], calendarEvents: [], admissions: [], behaviourScales: [], behaviourTraits: [],
    observations: [], housePoints: [], incidents: [], pickupPersons: [], collectionEvents: [],
    questions: [], assessments: [], announcements: [], news: [], conversations: [], messages: [],
    notifications: [], auditLog: [], websites: [], importJobs: [],
  };

  SCHOOL_BLUEPRINTS.forEach((blueprint, schoolIndex) => {
    seedSchool(db, blueprint, schoolIndex);
  });

  seedUsers(db);
  return db;
}

/* -------------------------------------------------------------------------- */
/* School                                                                      */
/* -------------------------------------------------------------------------- */

function seedSchool(
  db: MockDb,
  blueprint: (typeof SCHOOL_BLUEPRINTS)[number],
  schoolIndex: number,
): void {
  const schoolId = `school_${blueprint.slug}`;

  db.schools.push({
    id: schoolId,
    name: blueprint.name,
    shortName: blueprint.shortName,
    code: blueprint.code,
    slug: blueprint.slug,
    email: `info@${blueprint.slug}.edu.ng`,
    phone: `+234 80${random.int(10000000, 99999999)}`,
    website: `https://${blueprint.slug}.edu.ng`,
    addressLine1: `${random.int(1, 90)} ${random.pick(SURNAMES)} Street`,
    addressLine2: null,
    city: blueprint.city,
    state: blueprint.state,
    status: 'ACTIVE',
    branding: {
      primaryColor: blueprint.primary,
      accentColor: blueprint.accent,
      logoUrl: null,
      faviconUrl: null,
      motto: blueprint.motto,
    },
    settings: {
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      currencySymbol: '₦',
      country: 'NG',
      locale: 'en-NG',
      requirePhotoConsent: true,
      absenceAlertEnabled: true,
      absenceAlertCutoff: '10:00',
      resultPublishNotification: true,
      allowParentTeacherMessaging: true,
      publicWebsiteEnabled: schoolIndex === 0,
    },
    createdAt: new Date(CURRENT_YEAR - 4, 5, 12).toISOString(),
    updatedAt: TODAY.toISOString(),
    version: 3,
  });

  db.websites.push({
    schoolId,
    enabled: schoolIndex === 0,
    slug: blueprint.slug,
    tagline: blueprint.motto,
    about: `${blueprint.name} has educated children in ${blueprint.city} since ${CURRENT_YEAR - 14}. We combine a rigorous academic programme with pastoral care that knows every child by name.`,
    mission: 'To develop confident, curious and considerate young people.',
    vision: 'A school where every child is known, stretched and supported.',
    heroImageUrl: null,
    admissionsIntro:
      'Applications for the coming session are open. Complete the form online and upload the required documents; we will invite you for screening within two weeks.',
    admissionsOpen: true,
    contactEmail: `info@${blueprint.slug}.edu.ng`,
    contactPhone: `+234 80${random.int(10000000, 99999999)}`,
    address: `${blueprint.city}, ${blueprint.state} State`,
    socialLinks: [
      { platform: 'Facebook', url: `https://facebook.com/${blueprint.slug}` },
      { platform: 'Instagram', url: `https://instagram.com/${blueprint.slug}` },
    ],
    testimonials: [
      {
        id: id('tst'),
        author: 'Mrs Chioma Eze',
        role: 'Parent',
        quote:
          'I can see all three of my children in one place — their attendance, their results and what I still owe. It has removed a lot of guesswork.',
      },
      {
        id: id('tst'),
        author: 'Mr Segun Balogun',
        role: 'Parent',
        quote: 'The same-day message when a child is absent gave us real peace of mind.',
      },
    ],
    gallery: [],
    updatedAt: TODAY.toISOString(),
  });

  seedAcademicStructure(db, schoolId, blueprint);
  seedStaff(db, schoolId);
  seedPeople(db, schoolId, blueprint);
  seedGrading(db, schoolId);
  seedCurriculum(db, schoolId);
  seedTimetable(db, schoolId);
  seedCalendar(db, schoolId);
  seedFinance(db, schoolId);
  seedAttendance(db, schoolId);
  seedResults(db, schoolId);
  seedBehaviour(db, schoolId);
  seedDiscipline(db, schoolId);
  seedCollection(db, schoolId);
  seedAdmissions(db, schoolId);
  seedCbt(db, schoolId);
  seedEngagement(db, schoolId);
  seedAudit(db, schoolId);
  seedRoles(db, schoolId);
  seedImports(db, schoolId);
}

/* -------------------------------------------------------------------------- */
/* Academic structure                                                          */
/* -------------------------------------------------------------------------- */

function seedAcademicStructure(
  db: MockDb,
  schoolId: string,
  blueprint: (typeof SCHOOL_BLUEPRINTS)[number],
): void {
  for (let offset = 2; offset >= 0; offset -= 1) {
    const year = CURRENT_YEAR - offset;
    const sessionId = `${schoolId}_session_${year}`;
    const isCurrent = offset === 0;

    db.sessions.push({
      id: sessionId,
      schoolId,
      name: `${year}/${year + 1}`,
      startDate: isoDate(new Date(year, 8, 9)),
      endDate: isoDate(new Date(year + 1, 6, 20)),
      isCurrent,
      status: isCurrent ? 'ACTIVE' : 'CLOSED',
      termCount: 3,
    });

    const termSpans: [string, Date, Date][] = [
      ['First Term', new Date(year, 8, 9), new Date(year, 11, 13)],
      ['Second Term', new Date(year + 1, 0, 6), new Date(year + 1, 3, 4)],
      ['Third Term', new Date(year + 1, 3, 22), new Date(year + 1, 6, 20)],
    ];

    termSpans.forEach(([name, start, end], index) => {
      const isCurrentTerm = isCurrent && TODAY >= start && TODAY <= end;
      db.terms.push({
        id: `${sessionId}_term_${index + 1}`,
        schoolId,
        sessionId,
        sessionName: `${year}/${year + 1}`,
        name,
        sequence: index + 1,
        startDate: isoDate(start),
        endDate: isoDate(end),
        teachingWeeks: teachingWeeksBetween(isoDate(start), isoDate(end)),
        isCurrent: isCurrentTerm,
        status: isCurrentTerm ? 'ACTIVE' : end < TODAY ? 'CLOSED' : 'PLANNED',
      });
    });
  }

  // If today falls in a holiday, the most recent term is still "current" so the
  // app always has something sensible selected.
  if (!db.terms.some((term) => term.schoolId === schoolId && term.isCurrent)) {
    const candidates = db.terms.filter((term) => term.schoolId === schoolId);
    const latest = candidates.filter((term) => new Date(term.startDate) <= TODAY).pop();
    if (latest) {
      latest.isCurrent = true;
      latest.status = 'ACTIVE';
    }
  }

  blueprint.levels.forEach((levelBlueprint, levelIndex) => {
    const levelId = `${schoolId}_level_${levelBlueprint.code}`;
    db.levels.push({
      id: levelId,
      schoolId,
      name: levelBlueprint.name,
      code: levelBlueprint.code,
      sequence: levelIndex + 1,
      gradingSchemeId: null,
      gradingSchemeName: null,
      classCount: levelBlueprint.arms.length,
    });

    levelBlueprint.arms.forEach((arm) => {
      const className =
        levelBlueprint.arms.length === 1
          ? levelBlueprint.name
          : `${levelBlueprint.code} ${arm}`;
      db.classes.push({
        id: `${levelId}_class_${arm}`,
        schoolId,
        levelId,
        levelName: levelBlueprint.name,
        name: className,
        arm,
        code: `${levelBlueprint.code}${arm}`,
        capacity: 30,
        enrolledCount: 0,
        formTeacherId: null,
        formTeacherName: null,
        roomId: null,
        isActive: true,
      });
    });
  });

  const levelIds = db.levels.filter((level) => level.schoolId === schoolId).map((l) => l.id);
  const levelNames = db.levels.filter((level) => level.schoolId === schoolId).map((l) => l.name);

  SUBJECT_CATALOG.forEach((subject) => {
    db.subjects.push({
      id: `${schoolId}_subject_${subject.code}`,
      schoolId,
      name: subject.name,
      code: subject.code,
      category: subject.core ? 'Core' : 'Elective',
      isCore: subject.core,
      levelIds,
      levelNames,
      teacherCount: random.int(1, 4),
      isActive: true,
      schedule: [],
    });
  });

  ['Hall', 'Laboratory 1', 'Computer Room', 'Library'].forEach((name, index) => {
    db.rooms.push({
      id: `${schoolId}_room_${index}`,
      schoolId,
      name,
      code: `R${index + 1}`,
      capacity: random.int(25, 120),
      type: index === 0 ? 'HALL' : index === 1 ? 'LABORATORY' : index === 3 ? 'LIBRARY' : 'OTHER',
    });
  });

  HOUSE_BLUEPRINTS.forEach((house) => {
    db.houses.push({
      id: `${schoolId}_house_${house.name.toLowerCase()}`,
      schoolId,
      name: house.name,
      color: house.color,
      motto: house.motto,
      captainStudentId: null,
      captainName: null,
      memberCount: 0,
      points: 0,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                       */
/* -------------------------------------------------------------------------- */

function seedStaff(db: MockDb, schoolId: string): void {
  const subjects = db.subjects.filter((subject) => subject.schoolId === schoolId);
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);

  const designations = [
    'Form teacher', 'Subject teacher', 'Head of department', 'Bursar', 'Vice principal',
    'Admissions officer', 'Counsellor', 'Librarian',
  ];

  const count = Math.max(12, classes.length + 6);

  for (let index = 0; index < count; index += 1) {
    const gender = random.bool() ? 'MALE' : 'FEMALE';
    const firstName = random.pick(gender === 'MALE' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const lastName = random.pick(SURNAMES);
    const staffId = id('staff');
    const taughtSubjects = random.pickMany(subjects, random.int(1, 3));
    const taughtClasses = random.pickMany(classes, random.int(1, 4));
    const isFormTeacher = index < classes.length;

    db.staff.push({
      id: staffId,
      schoolId,
      userId: null,
      staffNo: `STF/${String(index + 1).padStart(3, '0')}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${schoolId.replace('school_', '')}.edu.ng`,
      phone: `+234 80${random.int(10000000, 99999999)}`,
      gender,
      photoUrl: null,
      designation: isFormTeacher ? 'Form teacher' : random.pick(designations),
      department: random.pick(['Sciences', 'Languages', 'Humanities', 'Administration']),
      employmentType: random.bool(0.8) ? 'FULL_TIME' : 'PART_TIME',
      employmentDate: isoDate(new Date(CURRENT_YEAR - random.int(0, 8), random.int(0, 11), random.int(1, 28))),
      status: random.bool(0.94) ? 'ACTIVE' : 'ON_LEAVE',
      roleNames: isFormTeacher ? ['Form teacher'] : ['Teacher'],
      subjectIds: taughtSubjects.map((subject) => subject.id),
      subjectNames: taughtSubjects.map((subject) => subject.name),
      classIds: taughtClasses.map((schoolClass) => schoolClass.id),
      classNames: taughtClasses.map((schoolClass) => schoolClass.name),
      isFormTeacher,
      createdAt: new Date(CURRENT_YEAR - 1, 7, 1).toISOString(),
      version: 1,
    });

    if (isFormTeacher && classes[index]) {
      classes[index].formTeacherId = staffId;
      classes[index].formTeacherName = `${firstName} ${lastName}`;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Students, guardians, enrolments                                             */
/* -------------------------------------------------------------------------- */

function seedPeople(
  db: MockDb,
  schoolId: string,
  blueprint: (typeof SCHOOL_BLUEPRINTS)[number],
): void {
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);
  const houses = db.houses.filter((house) => house.schoolId === schoolId);
  const currentSession = db.sessions.find(
    (session) => session.schoolId === schoolId && session.isCurrent,
  )!;
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;

  let admissionCounter = 0;

  // Guardians come first so siblings can share one.
  const guardianCount = Math.ceil((classes.length * blueprint.studentsPerClass) / 1.6);
  const guardians: Guardian[] = [];

  for (let index = 0; index < guardianCount; index += 1) {
    const gender = index % 2 === 0 ? 'FEMALE' : 'MALE';
    const firstName = random.pick(gender === 'MALE' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const lastName = random.pick(SURNAMES);
    const guardian: Guardian = {
      id: id('gdn'),
      schoolId,
      userId: null,
      title: gender === 'MALE' ? 'Mr' : random.bool() ? 'Mrs' : 'Ms',
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`,
      phone: `+234 81${random.int(10000000, 99999999)}`,
      altPhone: null,
      occupation: random.pick(OCCUPATIONS),
      address: `${random.int(1, 120)} ${random.pick(SURNAMES)} Close, ${blueprint.city}`,
      photoUrl: null,
      hasPortalAccess: random.bool(0.72),
      lastLoginAt: random.bool(0.6)
        ? addDays(TODAY, -random.int(0, 60)).toISOString()
        : null,
      studentCount: 0,
      createdAt: addDays(TODAY, -random.int(60, 900)).toISOString(),
      version: 1,
    };
    guardians.push(guardian);
    db.guardians.push(guardian);
  }

  classes.forEach((schoolClass) => {
    for (let index = 0; index < blueprint.studentsPerClass; index += 1) {
      const gender = random.bool() ? 'MALE' : 'FEMALE';
      const firstName = random.pick(gender === 'MALE' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
      const middleName = random.pick(MIDDLE_NAMES);
      const lastName = random.pick(SURNAMES);
      const house = random.pick(houses);
      admissionCounter += 1;

      const level = db.levels.find((entry) => entry.id === schoolClass.levelId)!;
      const approximateAge = 3 + level.sequence * 2 + random.int(0, 2);

      const studentId = id('std');
      const student: Student = {
        id: studentId,
        schoolId,
        admissionNo: `${schoolId.includes('brightfield') ? 'BFA' : 'RCS'}/${CURRENT_YEAR}/${String(admissionCounter).padStart(4, '0')}`,
        firstName,
        middleName: middleName || null,
        lastName,
        fullName: [firstName, middleName, lastName].filter(Boolean).join(' '),
        gender,
        dateOfBirth: isoDate(
          new Date(TODAY.getFullYear() - approximateAge, random.int(0, 11), random.int(1, 28)),
        ),
        photoUrl: null,
        photoConsent: random.bool(0.65),
        admissionDate: isoDate(addDays(TODAY, -random.int(90, 1400))),
        status: 'ACTIVE',
        currentClassId: schoolClass.id,
        currentClassName: schoolClass.name,
        currentLevelName: schoolClass.levelName,
        houseId: house.id,
        houseName: house.name,
        bloodGroup: random.pick(['O+', 'A+', 'B+', 'AB+', 'O-']),
        medicalNotes: random.bool(0.12)
          ? random.pick([
              'Mild asthma — inhaler kept with the school nurse.',
              'Allergic to peanuts. Must not be given shared snacks.',
              'Wears glasses; should sit near the front.',
            ])
          : null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        address: `${random.int(1, 120)} ${random.pick(SURNAMES)} Close, ${blueprint.city}`,
        nationality: 'Nigerian',
        stateOfOrigin: random.pick(STATES),
        religion: random.bool(0.6) ? 'Christianity' : 'Islam',
        guardianCount: 0,
        createdAt: addDays(TODAY, -random.int(90, 1400)).toISOString(),
        updatedAt: TODAY.toISOString(),
        version: 1,
      };

      db.students.push(student);
      schoolClass.enrolledCount += 1;
      house.memberCount += 1;

      // 1–2 guardians per child; some guardians are shared, producing siblings.
      const linkedGuardians = random.pickMany(guardians, random.bool(0.65) ? 2 : 1);
      linkedGuardians.forEach((guardian, guardianIndex) => {
        guardian.studentCount += 1;
        student.guardianCount += 1;
        if (guardianIndex === 0) {
          student.emergencyContactName = guardian.fullName;
          student.emergencyContactPhone = guardian.phone;
        }
        db.studentGuardians.push({
          id: id('sgl'),
          studentId,
          studentName: student.fullName,
          studentAdmissionNo: student.admissionNo,
          studentPhotoUrl: null,
          guardianId: guardian.id,
          guardianName: guardian.fullName,
          guardianPhone: guardian.phone,
          guardianEmail: guardian.email,
          relationship:
            guardianIndex === 0
              ? guardian.title === 'Mr'
                ? 'FATHER'
                : 'MOTHER'
              : 'GUARDIAN',
          isPrimaryContact: guardianIndex === 0,
          isEmergencyContact: true,
          isFinanciallyResponsible: guardianIndex === 0,
          canPickUp: true,
        });
      });

      // Historical enrolments: one per session the student has been present for.
      const sessions = db.sessions.filter((session) => session.schoolId === schoolId);
      sessions.forEach((session, sessionIndex) => {
        const isCurrentSession = session.id === currentSession.id;
        db.enrollments.push({
          id: id('enr'),
          schoolId,
          studentId,
          studentName: student.fullName,
          sessionId: session.id,
          sessionName: session.name,
          termId: isCurrentSession ? currentTerm.id : null,
          termName: isCurrentSession ? currentTerm.name : null,
          levelId: schoolClass.levelId,
          levelName: schoolClass.levelName,
          classId: schoolClass.id,
          className: schoolClass.name,
          status: isCurrentSession ? 'ACTIVE' : 'PROMOTED',
          enrolledOn: session.startDate,
          exitedOn: isCurrentSession ? null : session.endDate,
          note: sessionIndex === 0 ? 'Initial enrolment' : null,
        });
      });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Grading                                                                     */
/* -------------------------------------------------------------------------- */

function seedGrading(db: MockDb, schoolId: string): void {
  const levels = db.levels.filter((level) => level.schoolId === schoolId);
  const schemeId = `${schoolId}_grading_default`;

  db.gradingSchemes.push({
    id: schemeId,
    schoolId,
    name: 'Standard (CA 40 / Exam 60)',
    description: 'Continuous assessment carries 40 marks and the terminal examination 60.',
    isDefault: true,
    passMark: 40,
    showPosition: true,
    levelIds: levels.map((level) => level.id),
    levelNames: levels.map((level) => level.name),
    components: [
      { id: `${schemeId}_ca1`, schoolId, schemeId, name: 'CA 1', code: 'CA1', maxScore: 15, sequence: 1, type: 'CONTINUOUS_ASSESSMENT' },
      { id: `${schemeId}_ca2`, schoolId, schemeId, name: 'CA 2', code: 'CA2', maxScore: 15, sequence: 2, type: 'CONTINUOUS_ASSESSMENT' },
      { id: `${schemeId}_asg`, schoolId, schemeId, name: 'Assignment', code: 'ASG', maxScore: 10, sequence: 3, type: 'CONTINUOUS_ASSESSMENT' },
      { id: `${schemeId}_exm`, schoolId, schemeId, name: 'Examination', code: 'EXM', maxScore: 60, sequence: 4, type: 'EXAM' },
    ],
    bands: [
      { id: id('bnd'), label: 'A', minScore: 75, maxScore: 100, remark: 'Excellent', gradePoint: 5, isPass: true, color: '#16a34a' },
      { id: id('bnd'), label: 'B', minScore: 65, maxScore: 74, remark: 'Very good', gradePoint: 4, isPass: true, color: '#0d9488' },
      { id: id('bnd'), label: 'C', minScore: 55, maxScore: 64, remark: 'Good', gradePoint: 3, isPass: true, color: '#0ea5e9' },
      { id: id('bnd'), label: 'D', minScore: 45, maxScore: 54, remark: 'Fair', gradePoint: 2, isPass: true, color: '#f59e0b' },
      { id: id('bnd'), label: 'E', minScore: 40, maxScore: 44, remark: 'Pass', gradePoint: 1, isPass: true, color: '#f97316' },
      { id: id('bnd'), label: 'F', minScore: 0, maxScore: 39, remark: 'Fail', gradePoint: 0, isPass: false, color: '#dc2626' },
    ],
    version: 1,
  });

  const templates: [CommentTemplate['audience'], CommentTemplate['band'], string][] = [
    ['FORM_TEACHER', 'EXCELLENT', 'An outstanding term. {firstName} works with care and consistently sets a good example for the class.'],
    ['FORM_TEACHER', 'GOOD', '{firstName} has worked steadily this term and should be pleased with the progress made.'],
    ['FORM_TEACHER', 'AVERAGE', '{firstName} is capable of more. More consistent effort with homework would lift these results.'],
    ['FORM_TEACHER', 'POOR', '{firstName} has found this term difficult. Regular attendance and support at home are needed.'],
    ['PRINCIPAL', 'EXCELLENT', 'A commendable result. Keep it up.'],
    ['PRINCIPAL', 'GOOD', 'A good result. There is room to push further next term.'],
    ['PRINCIPAL', 'AVERAGE', 'A fair result. More focus is required.'],
    ['PRINCIPAL', 'POOR', 'This result is below expectation. The school will arrange a meeting with the parents.'],
  ];

  templates.forEach(([audience, band, text]) => {
    db.commentTemplates.push({
      id: id('cmt'),
      schoolId,
      audience,
      band,
      text,
      usageCount: random.int(0, 40),
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Curriculum, schemes of work and lesson notes                                */
/* -------------------------------------------------------------------------- */

const TOPIC_LIBRARY: Record<string, { title: string; objectives: string[] }[]> = {
  BIO: [
    {
      title: 'Photosynthesis',
      objectives: [
        'Define photosynthesis',
        'Identify the raw materials required',
        'State the word equation for photosynthesis',
        'Describe an experiment to show that light is necessary',
        'Explain the importance of photosynthesis to life on earth',
      ],
    },
    {
      title: 'Cell structure',
      objectives: [
        'Draw and label a plant cell',
        'Draw and label an animal cell',
        'Compare plant and animal cells',
        'State the function of each organelle',
      ],
    },
    {
      title: 'Nutrition in animals',
      objectives: [
        'List the classes of food',
        'State the function of each class of food',
        'Describe the process of digestion',
        'Explain the causes of malnutrition',
      ],
    },
  ],
  MTH: [
    {
      title: 'Number bases',
      objectives: [
        'Convert numbers from base 10 to other bases',
        'Convert numbers from other bases to base 10',
        'Add and subtract in a given base',
        'Solve problems involving number bases',
      ],
    },
    {
      title: 'Simple equations',
      objectives: [
        'Solve linear equations in one variable',
        'Translate word problems into equations',
        'Check the solution of an equation',
      ],
    },
    {
      title: 'Plane shapes',
      objectives: [
        'Identify common plane shapes',
        'Calculate the perimeter of plane shapes',
        'Calculate the area of plane shapes',
      ],
    },
  ],
  ENG: [
    {
      title: 'Parts of speech',
      objectives: [
        'Identify nouns in a passage',
        'Identify verbs and their tenses',
        'Use adjectives correctly in sentences',
        'Distinguish between adverbs and adjectives',
      ],
    },
    {
      title: 'Comprehension',
      objectives: [
        'Read a passage for main ideas',
        'Answer literal comprehension questions',
        'Infer meaning from context',
      ],
    },
  ],
};

function seedCurriculum(db: MockDb, schoolId: string): void {
  const levels = db.levels.filter((level) => level.schoolId === schoolId);
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const staff = db.staff.filter((member) => member.schoolId === schoolId);

  // Authors are taken in a stable order rather than at random, so the demo
  // form teacher reliably owns some of the curricula they can see. Staff
  // records reserved for a non-teaching persona are skipped, or the bursar
  // would end up credited with writing a syllabus.
  const schoolIndex = db.schools.findIndex((school) => school.id === schoolId);
  const reserved = new Set(
    DEMO_PERSONAS.filter(
      (persona) =>
        persona.schoolIndex === schoolIndex &&
        persona.link?.type === 'staff' &&
        !persona.roles.some((role) => role === 'TEACHER' || role === 'FORM_TEACHER'),
    ).map((persona) => persona.link!.index),
  );
  const authors = staff.filter(
    (member, index) => member.status !== 'EXITED' && !reserved.has(index),
  );
  let authorIndex = 0;

  Object.entries(TOPIC_LIBRARY).forEach(([subjectCode, topics]) => {
    const subject = db.subjects.find(
      (entry) => entry.schoolId === schoolId && entry.code === subjectCode,
    );
    if (!subject) return;

    const level = levels[Math.min(levels.length - 1, 3)] ?? levels[levels.length - 1];
    const levelClasses = classes
      .filter((schoolClass) => schoolClass.levelId === level.id)
      .slice(0, 2);

    // A curriculum belongs to one class. Two classes at the same level get two
    // plans, which is the whole point: they do not move at the same speed.
    levelClasses.forEach((schoolClass) => {
      const teacher = authors[authorIndex % authors.length];
      authorIndex += 1;

      // The author has to actually teach this, or the API would hide their own
      // work from them.
      if (!teacher.subjectIds.includes(subject.id)) {
        teacher.subjectIds.push(subject.id);
        teacher.subjectNames.push(subject.name);
      }
      if (!teacher.classIds.includes(schoolClass.id)) {
        teacher.classIds.push(schoolClass.id);
        teacher.classNames.push(schoolClass.name);
      }

      const curriculumId = id('cur');
      const writtenOn = addDays(new Date(currentTerm.startDate), -random.int(3, 40));

      db.curricula.push({
        id: curriculumId,
        schoolId,
        name: `${subject.name} — ${schoolClass.name}`,
        subjectId: subject.id,
        subjectName: subject.name,
        classId: schoolClass.id,
        className: schoolClass.name,
        levelId: level.id,
        levelName: level.name,
        sessionId: currentTerm.sessionId,
        sessionName: currentTerm.sessionName,
        description: `Performance objectives for ${subject.name} in ${schoolClass.name}.`,
        topicCount: topics.length,
        objectiveCount: topics.reduce((total, topic) => total + topic.objectives.length, 0),
        isActive: true,
        // Rewritten to the persona's user id in `seedUsers` for staff who have
        // a portal login.
        createdById: teacher.id,
        createdByName: teacher.fullName,
        createdByRole: teacher.isFormTeacher ? 'Form teacher' : 'Teacher',
        createdAt: writtenOn.toISOString(),
        updatedAt: writtenOn.toISOString(),
      });

      topics.forEach((topic, topicIndex) => {
        const topicId = id('top');
        db.topics.push({
          id: topicId,
          curriculumId,
          title: topic.title,
          description: null,
          sequence: topicIndex + 1,
          suggestedWeeks: random.int(1, 3),
          objectives: topic.objectives.map((statement, objectiveIndex) => {
            // A realistic coverage picture: most objectives taught, fewer
            // assessed — exactly the gap the analytics exist to surface.
            const taught = random.bool(0.72);
            return {
              id: id('obj'),
              topicId,
              code: `${subject.code}.${topicIndex + 1}.${objectiveIndex + 1}`,
              statement,
              sequence: objectiveIndex + 1,
              bloomLevel: random.pick(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE'] as const),
              taught,
              assessed: taught && random.bool(0.55),
              taughtOn: taught ? isoDate(addDays(TODAY, -random.int(1, 60))) : null,
              questionCount: random.int(0, 6),
            };
          }),
        });
      });

      const curriculumTopics = db.topics.filter((topic) => topic.curriculumId === curriculumId);

      db.schemes.push({
        id: id('sow'),
        schoolId,
        subjectId: subject.id,
        subjectName: subject.name,
        classId: schoolClass.id,
        className: schoolClass.name,
        termId: currentTerm.id,
        termName: currentTerm.name,
        sessionName: currentTerm.sessionName,
        curriculumId,
        status: random.pick(['DRAFT', 'SUBMITTED', 'APPROVED'] as const),
        createdByName: teacher.fullName,
        approvedByName: null,
        approvedAt: null,
        version: 1,
        weeks: Array.from({ length: 13 }, (_, weekIndex) => {
          const topic = curriculumTopics[weekIndex % curriculumTopics.length];
          const isBreak = weekIndex === 6;
          return {
            id: id('swk'),
            weekNumber: weekIndex + 1,
            startDate: isoDate(addDays(new Date(currentTerm.startDate), weekIndex * 7)),
            endDate: isoDate(addDays(new Date(currentTerm.startDate), weekIndex * 7 + 4)),
            topicId: isBreak ? null : topic?.id ?? null,
            topicTitle: isBreak ? 'Mid-term break' : (topic?.title ?? 'Revision'),
            objectiveIds: isBreak ? [] : (topic?.objectives.slice(0, 2).map((o) => o.id) ?? []),
            objectiveStatements: isBreak
              ? []
              : (topic?.objectives.slice(0, 2).map((o) => o.statement) ?? []),
            activities: isBreak ? null : 'Class discussion, worked examples, group task.',
            resources: isBreak ? null : 'Textbook chapter, wall chart, past questions.',
            isBreak,
          };
        }),
      });

      for (let week = 1; week <= 4; week += 1) {
        const topic = curriculumTopics[(week - 1) % curriculumTopics.length];
        db.lessonNotes.push({
          id: id('lsn'),
          schoolId,
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          classId: schoolClass.id,
          className: schoolClass.name,
          subjectId: subject.id,
          subjectName: subject.name,
          termId: currentTerm.id,
          weekNumber: week,
          date: isoDate(addDays(new Date(currentTerm.startDate), (week - 1) * 7 + 1)),
          topic: topic?.title ?? 'Revision',
          objectiveIds: topic?.objectives.slice(0, 2).map((o) => o.id) ?? [],
          objectiveStatements: topic?.objectives.slice(0, 2).map((o) => o.statement) ?? [],
          content:
            'Introduced the topic with a familiar example, worked through three problems on the board, then set a class exercise in pairs.',
          resources: 'Textbook, wall chart, worksheets.',
          assignment: 'Exercise 4, questions 1–8.',
          challenges: random.bool(0.6)
            ? random.pick([
                'The class struggled with the word equation; I will re-teach it next lesson using a diagram.',
                'Too few textbooks to go round — pairs had to share, which slowed the exercise.',
                'Several students were absent, so the recap took longer than planned.',
              ])
            : null,
          studentDifficulties: random.bool(0.5)
            ? 'About a third of the class could not convert between units without help.'
            : null,
          status: random.pick(['DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED'] as const),
          reviewerName: null,
          reviewedAt: null,
          reviewComment: null,
          version: 1,
        });
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Timetable and calendar                                                      */
/* -------------------------------------------------------------------------- */

const WEEKDAYS: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

function seedTimetable(db: MockDb, schoolId: string): void {
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);
  const subjects = db.subjects.filter((subject) => subject.schoolId === schoolId);
  const staff = db.staff.filter((member) => member.schoolId === schoolId);
  const rooms = db.rooms.filter((room) => room.schoolId === schoolId);

  const periodSpans: [string, string, string, boolean][] = [
    ['Period 1', '08:00', '08:40', false],
    ['Period 2', '08:40', '09:20', false],
    ['Period 3', '09:20', '10:00', false],
    ['Break', '10:00', '10:20', true],
    ['Period 4', '10:20', '11:00', false],
    ['Period 5', '11:00', '11:40', false],
    ['Period 6', '11:40', '12:20', false],
    ['Lunch', '12:20', '13:00', true],
    ['Period 7', '13:00', '13:40', false],
    ['Period 8', '13:40', '14:20', false],
  ];

  const periods: TimetablePeriod[] = periodSpans.map(([name, startTime, endTime, isBreak], index) => ({
    id: `${schoolId}_period_${index}`,
    schoolId,
    name,
    startTime,
    endTime,
    sequence: index + 1,
    isBreak,
  }));
  db.periods.push(...periods);

  const entries: TimetableEntry[] = [];
  const timetableId = `${schoolId}_timetable`;

  classes.forEach((schoolClass) => {
    WEEKDAYS.forEach((day) => {
      periods
        .filter((period) => !period.isBreak)
        .forEach((period) => {
          if (!random.bool(0.85)) return;
          const subject = random.pick(subjects);
          const teacher = random.pick(staff);
          entries.push({
            id: id('tte'),
            schoolId,
            timetableId,
            classId: schoolClass.id,
            className: schoolClass.name,
            subjectId: subject.id,
            subjectName: subject.name,
            teacherId: teacher.id,
            teacherName: teacher.fullName,
            roomId: random.bool(0.3) ? random.pick(rooms).id : null,
            roomName: null,
            periodId: period.id,
            periodName: period.name,
            startTime: period.startTime,
            endTime: period.endTime,
            day,
          });
        });
    });
  });

  db.timetables.push({
    id: timetableId,
    schoolId,
    name: `${currentTerm.sessionName} ${currentTerm.name} timetable`,
    sessionId: currentTerm.sessionId,
    termId: currentTerm.id,
    termName: currentTerm.name,
    status: 'PUBLISHED',
    periods,
    entries,
    version: 1,
  });
}

function seedCalendar(db: MockDb, schoolId: string): void {
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);
  const start = new Date(currentTerm.startDate);

  const events: [string, CalendarEvent['category'], number, number, CalendarEvent['audience']][] = [
    ['Resumption', 'EVENT', 0, 0, 'EVERYONE'],
    ['PTA meeting', 'PTA', 21, 21, 'PARENTS'],
    ['First continuous assessment', 'TEST', 28, 32, 'STUDENTS'],
    ['Mid-term break', 'HOLIDAY', 42, 46, 'EVERYONE'],
    ['Second term fees due', 'FEE_DEADLINE', 49, 49, 'PARENTS'],
    ['Inter-house sports', 'EVENT', 56, 56, 'EVERYONE'],
    ['Staff development day', 'STAFF', 60, 60, 'STAFF'],
    ['Terminal examinations', 'EXAM', 70, 82, 'STUDENTS'],
    ['Admission screening', 'ADMISSION', 63, 63, 'EVERYONE'],
  ];

  events.forEach(([title, category, startOffset, endOffset, audience]) => {
    db.calendarEvents.push({
      id: id('cal'),
      schoolId,
      title,
      description: null,
      category,
      startDate: isoDate(addDays(start, startOffset)),
      endDate: isoDate(addDays(start, endOffset)),
      allDay: true,
      location: category === 'PTA' ? 'School hall' : null,
      audience,
      classIds: audience === 'CLASSES' ? classes.slice(0, 2).map((c) => c.id) : [],
      roleNames: [],
      color: null,
      createdByName: 'Adaeze Okonkwo',
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                     */
/* -------------------------------------------------------------------------- */

function seedFinance(db: MockDb, schoolId: string): void {
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const levels = db.levels.filter((level) => level.schoolId === schoolId);
  const students = db.students.filter((student) => student.schoolId === schoolId);

  const feeCatalog: [string, string, number, FeeItem['category'], boolean][] = [
    ['Tuition', 'TUI', 185000, 'TUITION', false],
    ['Development levy', 'DEV', 25000, 'DEVELOPMENT', false],
    ['Examination fee', 'EXM', 12000, 'EXAM', false],
    ['School bus (return)', 'BUS', 45000, 'TRANSPORT', true],
    ['Boarding', 'BRD', 220000, 'BOARDING', true],
    ['Uniform set', 'UNI', 18000, 'UNIFORM', true],
    ['ICT levy', 'ICT', 15000, 'OTHER', false],
  ];

  const feeItems = feeCatalog.map(([name, code, amount, category, isOptional]) => {
    const item: FeeItem = {
      id: `${schoolId}_fee_${code}`,
      schoolId,
      name,
      code,
      description: null,
      amount,
      category,
      isOptional,
      isRecurring: !isOptional,
      isActive: true,
    };
    db.feeItems.push(item);
    return item;
  });

  const structureId = `${schoolId}_structure_current`;
  db.feeStructures.push({
    id: structureId,
    schoolId,
    name: `${currentTerm.sessionName} ${currentTerm.name}`,
    sessionId: currentTerm.sessionId,
    sessionName: currentTerm.sessionName,
    termId: currentTerm.id,
    termName: currentTerm.name,
    levelIds: levels.map((level) => level.id),
    levelNames: levels.map((level) => level.name),
    classIds: [],
    lines: feeItems.map((item) => ({
      id: id('fsl'),
      feeItemId: item.id,
      feeItemName: item.name,
      amount: item.amount,
      isOptional: item.isOptional,
    })),
    mandatoryTotal: feeItems.filter((i) => !i.isOptional).reduce((sum, i) => sum + i.amount, 0),
    optionalTotal: feeItems.filter((i) => i.isOptional).reduce((sum, i) => sum + i.amount, 0),
    isActive: true,
    version: 1,
  });

  const discountBlueprints: [string, Discount['type'], Discount['mode'], number][] = [
    ['Sibling discount (2nd child)', 'SIBLING', 'PERCENTAGE', 10],
    ['Sibling discount (3rd child)', 'SIBLING', 'PERCENTAGE', 15],
    ['Staff child', 'STAFF_CHILD', 'PERCENTAGE', 50],
    ['Academic scholarship', 'SCHOLARSHIP', 'PERCENTAGE', 100],
    ['Early payment', 'EARLY_PAYMENT', 'FIXED', 10000],
  ];

  discountBlueprints.forEach(([name, type, mode, value]) => {
    db.discounts.push({
      id: id('dsc'),
      schoolId,
      name,
      type,
      mode,
      value,
      appliesToFeeItemIds: [feeItems[0].id],
      isActive: true,
      description: null,
    });
  });

  const mandatory = feeItems.filter((item) => !item.isOptional);
  let invoiceCounter = 0;
  let paymentCounter = 0;

  students.forEach((student) => {
    invoiceCounter += 1;
    const takesBus = random.bool(0.35);
    const lines = [...mandatory, ...(takesBus ? [feeItems.find((i) => i.code === 'BUS')!] : [])];

    // A believable spread: some families pay in full, most pay in part, a few
    // have not paid at all and carry a balance forward.
    const discountRate = random.bool(0.18) ? random.pick([10, 15, 50]) : 0;
    const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
    const discountTotal = Math.round((subtotal * discountRate) / 100);
    const broughtForward = random.bool(0.22) ? random.int(1, 8) * 5000 : 0;
    const total = subtotal - discountTotal + broughtForward;

    const paymentProfile = random.next();
    const amountPaid =
      paymentProfile < 0.45
        ? total
        : paymentProfile < 0.85
          ? Math.round((total * random.int(20, 80)) / 100 / 1000) * 1000
          : 0;

    const balance = total - amountPaid;
    const dueDate = addDays(new Date(currentTerm.startDate), 21);

    const invoiceId = id('inv');
    db.invoices.push({
      id: invoiceId,
      schoolId,
      invoiceNo: `INV/${CURRENT_YEAR}/${String(invoiceCounter).padStart(5, '0')}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      className: student.currentClassName,
      sessionId: currentTerm.sessionId,
      sessionName: currentTerm.sessionName,
      termId: currentTerm.id,
      termName: currentTerm.name,
      issueDate: currentTerm.startDate,
      dueDate: isoDate(dueDate),
      lines: lines.map((item) => ({
        id: id('inl'),
        feeItemId: item.id,
        description: item.name,
        quantity: 1,
        unitAmount: item.amount,
        discountAmount: item.code === 'TUI' ? discountTotal : 0,
        lineTotal: item.amount - (item.code === 'TUI' ? discountTotal : 0),
        isOptional: item.isOptional,
      })),
      subtotal,
      discountTotal,
      broughtForward,
      total,
      amountPaid,
      balance,
      status:
        balance === 0 ? 'PAID' : amountPaid > 0 ? 'PART_PAID' : dueDate < TODAY ? 'OVERDUE' : 'ISSUED',
      note: null,
      createdAt: new Date(currentTerm.startDate).toISOString(),
      version: 1,
    });

    if (amountPaid > 0) {
      paymentCounter += 1;
      const method = random.pick(['BANK_TRANSFER', 'ONLINE', 'CASH', 'POS'] as const);
      db.payments.push({
        id: id('pay'),
        schoolId,
        reference: `PAY-${CURRENT_YEAR}-${String(paymentCounter).padStart(6, '0')}`,
        providerReference: method === 'ONLINE' ? `psk_${random.int(100000, 999999)}` : null,
        studentId: student.id,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        guardianName: db.studentGuardians.find((link) => link.studentId === student.id)?.guardianName ?? null,
        amount: amountPaid,
        method,
        provider: method === 'ONLINE' ? 'PAYSTACK' : 'MANUAL',
        status: 'SUCCESSFUL',
        paidAt: addDays(new Date(currentTerm.startDate), random.int(1, 40)).toISOString(),
        recordedByName: 'Ibrahim Sule',
        allocations: [
          {
            id: id('pal'),
            invoiceId,
            invoiceNo: `INV/${CURRENT_YEAR}/${String(invoiceCounter).padStart(5, '0')}`,
            amount: amountPaid,
          },
        ],
        unallocatedAmount: 0,
        isReconciled: method !== 'CASH' ? random.bool(0.85) : random.bool(0.6),
        receiptNo: `RCP/${CURRENT_YEAR}/${String(paymentCounter).padStart(5, '0')}`,
        note: null,
      });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                  */
/* -------------------------------------------------------------------------- */

function seedAttendance(db: MockDb, schoolId: string): void {
  const students = db.students.filter((student) => student.schoolId === schoolId);
  const staff = db.staff.filter((member) => member.schoolId === schoolId);
  const days = previousSchoolDays(TODAY, 25);

  students.forEach((student) => {
    // Most students attend well; a small tail has a genuine attendance problem,
    // which is what makes the retention analytics show something real.
    const reliability = random.next() < 0.12 ? random.int(70, 85) / 100 : random.int(90, 100) / 100;

    days.forEach((day) => {
      const roll = random.next();
      let status: AttendanceRecord['status'] = 'PRESENT';
      let reason: AttendanceRecord['reason'] = null;

      if (roll > reliability) {
        const kind = random.next();
        if (kind < 0.2) {
          status = 'LATE';
          reason = 'TRANSPORT';
        } else if (kind < 0.55) {
          status = 'ABSENT';
          reason = 'SICK';
        } else if (kind < 0.75) {
          status = 'EXCUSED';
          reason = 'PERMITTED';
        } else {
          status = 'ABSENT';
          reason = 'UNEXPLAINED';
        }
      }

      const marker = random.pick(staff);
      db.attendance.push({
        id: id('att'),
        schoolId,
        studentId: student.id,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        photoUrl: null,
        classId: student.currentClassId!,
        date: isoDate(day),
        status,
        reason,
        note: null,
        markedByName: marker.fullName,
        markedAt: day.toISOString(),
        // The alert fires once, at the point the register was taken; editing the
        // register later must not send a second message.
        guardianNotifiedAt:
          status === 'ABSENT' && reason === 'UNEXPLAINED' ? day.toISOString() : null,
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

function seedResults(db: MockDb, schoolId: string): void {
  const scheme = db.gradingSchemes.find((entry) => entry.schoolId === schoolId)!;
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);
  const subjects = db.subjects.filter((subject) => subject.schoolId === schoolId).slice(0, 8);

  classes.forEach((schoolClass) => {
    const roster = db.students.filter((student) => student.currentClassId === schoolClass.id);

    subjects.forEach((subject, subjectIndex) => {
      // Sheets sit at different points in the workflow so the approval and
      // publishing screens have realistic work in them.
      const status =
        subjectIndex < 3 ? 'PUBLISHED' : subjectIndex < 5 ? 'APPROVED' : subjectIndex < 7 ? 'SUBMITTED' : 'DRAFT';

      const rows = roster.map((student) => {
        const ability = random.score(62, 14);
        const scores = scheme.components.map((component) => ({
          componentId: component.id,
          score:
            status === 'DRAFT' && random.bool(0.4)
              ? null
              : Math.min(
                  component.maxScore,
                  Math.round((ability / 100) * component.maxScore + (random.next() - 0.5) * 6),
                ),
        }));

        const complete = scores.every((cell) => cell.score !== null);
        const total = complete ? scores.reduce((sum, cell) => sum + (cell.score ?? 0), 0) : null;
        const band = total === null ? null : scheme.bands.find((b) => total >= b.minScore && total <= b.maxScore);

        return {
          id: id('ssr'),
          studentId: student.id,
          studentName: student.fullName,
          admissionNo: student.admissionNo,
          photoUrl: null,
          scores,
          total,
          grade: band?.label ?? null,
          remark: band?.remark ?? null,
          position: null as number | null,
          isAbsent: false,
          version: 1,
        };
      });

      const scored = rows.filter((row) => row.total !== null);
      scored
        .slice()
        .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
        .forEach((row, index) => {
          const match = rows.find((candidate) => candidate.id === row.id);
          if (match) match.position = index + 1;
        });

      const totals = scored.map((row) => row.total ?? 0);

      db.scoreSheets.push({
        id: id('shs'),
        schoolId,
        classId: schoolClass.id,
        className: schoolClass.name,
        subjectId: subject.id,
        subjectName: subject.name,
        termId: currentTerm.id,
        termName: currentTerm.name,
        sessionName: currentTerm.sessionName,
        gradingSchemeId: scheme.id,
        components: scheme.components,
        status: status as ScoreSheet['status'],
        submittedByName: status === 'DRAFT' ? null : schoolClass.formTeacherName,
        submittedAt: status === 'DRAFT' ? null : addDays(TODAY, -random.int(3, 14)).toISOString(),
        approvedByName: status === 'APPROVED' || status === 'PUBLISHED' ? 'Dr Emeka Nwosu' : null,
        approvedAt:
          status === 'APPROVED' || status === 'PUBLISHED'
            ? addDays(TODAY, -random.int(1, 5)).toISOString()
            : null,
        publishedAt: status === 'PUBLISHED' ? addDays(TODAY, -random.int(0, 3)).toISOString() : null,
        rows,
        classAverage: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null,
        highest: totals.length ? Math.max(...totals) : null,
        lowest: totals.length ? Math.min(...totals) : null,
        version: 1,
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Behaviour, houses, discipline, collection                                   */
/* -------------------------------------------------------------------------- */

function seedBehaviour(db: MockDb, schoolId: string): void {
  const scaleId = `${schoolId}_scale_5`;
  db.behaviourScales.push({
    id: scaleId,
    schoolId,
    name: '5-point scale',
    min: 1,
    max: 5,
    points: [
      { value: 1, label: 'Needs attention' },
      { value: 2, label: 'Developing' },
      { value: 3, label: 'Satisfactory' },
      { value: 4, label: 'Good' },
      { value: 5, label: 'Excellent' },
    ],
  });

  const levels = db.levels.filter((level) => level.schoolId === schoolId);

  BEHAVIOUR_TRAITS.forEach((trait, index) => {
    db.behaviourTraits.push({
      id: id('trt'),
      schoolId,
      name: trait.name,
      category: trait.category,
      description: null,
      scaleId,
      scaleName: '5-point scale',
      levelIds: levels.map((level) => level.id),
      appearsOnReportCard: true,
      sequence: index + 1,
      isActive: true,
    });
  });

  const traits = db.behaviourTraits.filter((trait) => trait.schoolId === schoolId);
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const staff = db.staff.filter((member) => member.schoolId === schoolId);
  const students = db.students.filter((student) => student.schoolId === schoolId);
  const houses = db.houses.filter((house) => house.schoolId === schoolId);

  // Observations recorded through the term, not all in one sitting.
  students.slice(0, 90).forEach((student) => {
    traits.slice(0, 6).forEach((trait) => {
      const occasions = random.int(2, 4);
      for (let index = 0; index < occasions; index += 1) {
        db.observations.push({
          id: id('obs'),
          schoolId,
          studentId: student.id,
          studentName: student.fullName,
          admissionNo: student.admissionNo,
          traitId: trait.id,
          traitName: trait.name,
          termId: currentTerm.id,
          rating: random.int(2, 5),
          scaleMax: 5,
          note: null,
          observedByName: random.pick(staff).fullName,
          observedAt: addDays(TODAY, -random.int(1, 70)).toISOString(),
        });
      }
    });
  });

  students.slice(0, 140).forEach((student) => {
    const awards = random.int(0, 4);
    for (let index = 0; index < awards; index += 1) {
      const house = houses.find((entry) => entry.id === student.houseId) ?? random.pick(houses);
      const reason = random.pick([
        'ACADEMIC', 'BEHAVIOUR', 'READING', 'SPORTS', 'PUNCTUALITY', 'SERVICE', 'PENALTY',
      ] as const);
      const points = reason === 'PENALTY' ? -random.int(1, 5) : random.int(1, 10);
      house.points += points;

      db.housePoints.push({
        id: id('hpt'),
        schoolId,
        studentId: student.id,
        studentName: student.fullName,
        admissionNo: student.admissionNo,
        houseId: house.id,
        houseName: house.name,
        houseColor: house.color,
        points,
        reason,
        note: null,
        awardedByName: random.pick(staff).fullName,
        awardedAt: addDays(TODAY, -random.int(1, 60)).toISOString(),
        termId: currentTerm.id,
      });
    }
  });
}

function seedDiscipline(db: MockDb, schoolId: string): void {
  const students = db.students.filter((student) => student.schoolId === schoolId);
  const staff = db.staff.filter((member) => member.schoolId === schoolId);

  const categories = ['Lateness', 'Fighting', 'Damage to property', 'Rudeness to staff', 'Truancy', 'Bullying'];

  for (let index = 0; index < 14; index += 1) {
    const student = random.pick(students);
    const reporter = random.pick(staff);
    const status = random.pick([
      'REPORTED', 'REFERRED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED',
    ] as const);
    const occurredAt = addDays(TODAY, -random.int(1, 60));

    const timeline: DisciplineTimelineEvent[] = [
      {
        id: id('dtl'),
        status: 'REPORTED',
        actorName: reporter.fullName,
        occurredAt: occurredAt.toISOString(),
        note: 'Incident reported by the class teacher.',
      },
    ];
    if (status !== 'REPORTED') {
      timeline.push({
        id: id('dtl'),
        status: 'REFERRED' as const,
        actorName: reporter.fullName,
        occurredAt: addDays(occurredAt, 1).toISOString(),
        note: 'Referred to the vice principal for review.',
      });
    }
    if (status === 'ACTION_TAKEN' || status === 'RESOLVED') {
      timeline.push({
        id: id('dtl'),
        status: 'ACTION_TAKEN' as const,
        actorName: 'Dr Emeka Nwosu',
        occurredAt: addDays(occurredAt, 2).toISOString(),
        note: 'Parents invited and a written warning issued.',
      });
    }

    db.incidents.push({
      id: id('inc'),
      schoolId,
      referenceNo: `DSC/${CURRENT_YEAR}/${String(index + 1).padStart(4, '0')}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      className: student.currentClassName,
      category: random.pick(categories),
      severity: random.pick(['MINOR', 'MODERATE', 'MAJOR'] as const),
      description:
        'Reported during the mid-morning break. Two students were involved; statements were taken from both and from a witness.',
      occurredAt: occurredAt.toISOString(),
      location: random.pick(['Playground', 'Classroom', 'Corridor', 'School bus']),
      reportedByName: reporter.fullName,
      reportedById: reporter.id,
      status,
      referredToName: status === 'REPORTED' ? null : 'Dr Emeka Nwosu',
      reviewerName: status === 'REPORTED' ? null : 'Dr Emeka Nwosu',
      reviewNote: null,
      resolution: status === 'RESOLVED' ? 'Written warning issued and parents informed.' : null,
      resolvedAt: status === 'RESOLVED' ? addDays(occurredAt, 3).toISOString() : null,
      evidence: [],
      actions:
        status === 'ACTION_TAKEN' || status === 'RESOLVED'
          ? [
              {
                id: id('act'),
                type: 'PARENT_MEETING',
                description: 'Parents invited to a meeting with the vice principal.',
                startDate: isoDate(addDays(occurredAt, 3)),
                endDate: null,
                issuedByName: 'Dr Emeka Nwosu',
                issuedAt: addDays(occurredAt, 2).toISOString(),
              },
            ]
          : [],
      timeline,
      guardianNotified: status !== 'REPORTED',
      version: 1,
    });
  }
}

function seedCollection(db: MockDb, schoolId: string): void {
  const students = db.students.filter((student) => student.schoolId === schoolId);
  const staff = db.staff.filter((member) => member.schoolId === schoolId);

  students.slice(0, 80).forEach((student) => {
    const links = db.studentGuardians.filter((link) => link.studentId === student.id);
    links.forEach((link) => {
      db.pickupPersons.push({
        id: id('pkp'),
        schoolId,
        studentId: student.id,
        name: link.guardianName,
        relationship: link.relationship === 'FATHER' ? 'Father' : link.relationship === 'MOTHER' ? 'Mother' : 'Guardian',
        phone: link.guardianPhone,
        photoUrl: null,
        authorizationStatus: 'AUTHORIZED',
        authorizedByName: 'Adaeze Okonkwo',
        authorizedAt: addDays(TODAY, -random.int(30, 300)).toISOString(),
        note: null,
      });
    });

    if (random.bool(0.3)) {
      db.pickupPersons.push({
        id: id('pkp'),
        schoolId,
        studentId: student.id,
        name: `${random.pick(MALE_FIRST_NAMES)} ${random.pick(SURNAMES)}`,
        relationship: random.pick(['Driver', 'Aunt', 'Uncle', 'Grandparent']),
        phone: `+234 90${random.int(10000000, 99999999)}`,
        photoUrl: null,
        authorizationStatus: random.bool(0.8) ? 'AUTHORIZED' : 'PENDING',
        authorizedByName: 'Adaeze Okonkwo',
        authorizedAt: addDays(TODAY, -random.int(1, 90)).toISOString(),
        note: null,
      });
    }
  });

  const days = previousSchoolDays(TODAY, 5);
  students.slice(0, 60).forEach((student) => {
    days.forEach((day) => {
      if (!random.bool(0.6)) return;
      const persons = db.pickupPersons.filter((person) => person.studentId === student.id);
      if (persons.length === 0) return;
      const person = random.pick(persons);
      const releasedBy = random.pick(staff);
      const releaseTime = new Date(day);
      releaseTime.setHours(14, random.int(0, 59));

      db.collectionEvents.push({
        id: id('col'),
        schoolId,
        studentId: student.id,
        studentName: student.fullName,
        studentAdmissionNo: student.admissionNo,
        className: student.currentClassName,
        pickupPersonId: person.id,
        pickupPersonName: person.name,
        relationship: person.relationship,
        releasedByStaffId: releasedBy.id,
        releasedByName: releasedBy.fullName,
        releasedAt: releaseTime.toISOString(),
        method: random.pick(['GATE', 'BUS'] as const),
        parentNotified: true,
        note: null,
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Admissions                                                                  */
/* -------------------------------------------------------------------------- */

function seedAdmissions(db: MockDb, schoolId: string): void {
  const currentSession = db.sessions.find(
    (session) => session.schoolId === schoolId && session.isCurrent,
  )!;
  const levels = db.levels.filter((level) => level.schoolId === schoolId);
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId);

  const statuses: AdmissionApplication['status'][] = [
    'SUBMITTED', 'SUBMITTED', 'SCREENING', 'SCREENING', 'SHORTLISTED',
    'OFFERED', 'OFFERED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED',
    'REJECTED', 'WITHDRAWN', 'DRAFT',
  ];

  for (let index = 0; index < 34; index += 1) {
    const gender = random.bool() ? 'MALE' : 'FEMALE';
    const firstName = random.pick(gender === 'MALE' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const lastName = random.pick(SURNAMES);
    const level = random.pick(levels);
    const status = random.pick(statuses);
    const submittedAt = addDays(TODAY, -random.int(3, 90));
    const guardianFirst = random.pick(FEMALE_FIRST_NAMES);

    const timeline: AdmissionStageEvent[] = [
      {
        id: id('ast'),
        status: 'SUBMITTED',
        actorName: `${guardianFirst} ${lastName}`,
        occurredAt: submittedAt.toISOString(),
        note: 'Application submitted online.',
      },
    ];
    if (['SCREENING', 'SHORTLISTED', 'OFFERED', 'ACCEPTED', 'REJECTED'].includes(status)) {
      timeline.push({
        id: id('ast'),
        status: 'SCREENING' as const,
        actorName: 'Admissions office',
        occurredAt: addDays(submittedAt, 3).toISOString(),
        note: 'Documents verified; invited for screening.',
      });
    }

    db.admissions.push({
      id: id('adm'),
      schoolId,
      applicationNo: `APP/${CURRENT_YEAR}/${String(index + 1).padStart(4, '0')}`,
      sessionId: currentSession.id,
      sessionName: currentSession.name,
      levelId: level.id,
      levelName: level.name,
      applicant: {
        firstName,
        middleName: random.pick(MIDDLE_NAMES) || null,
        lastName,
        gender,
        dateOfBirth: isoDate(new Date(TODAY.getFullYear() - (4 + level.sequence * 2), random.int(0, 11), random.int(1, 28))),
        photoUrl: null,
        nationality: 'Nigerian',
        stateOfOrigin: random.pick(STATES),
        address: `${random.int(1, 90)} ${random.pick(SURNAMES)} Street`,
        previousSchool: random.bool(0.7) ? `${random.pick(SURNAMES)} Nursery & Primary School` : null,
        bloodGroup: random.pick(['O+', 'A+', 'B+']),
        medicalNotes: null,
      },
      guardians: [
        {
          title: 'Mrs',
          firstName: guardianFirst,
          lastName,
          relationship: 'MOTHER',
          email: `${guardianFirst.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
          phone: `+234 81${random.int(10000000, 99999999)}`,
          occupation: random.pick(OCCUPATIONS),
          address: null,
          isPrimaryContact: true,
        },
      ],
      documents: [
        {
          id: id('doc'),
          name: 'Birth certificate.pdf',
          category: 'BIRTH_CERTIFICATE',
          storagePath: `admissions/${schoolId}/birth-${index}.pdf`,
          downloadUrl: null,
          mimeType: 'application/pdf',
          sizeBytes: random.int(80_000, 900_000),
          uploadedAt: submittedAt.toISOString(),
        },
      ],
      status,
      screeningScore: ['SHORTLISTED', 'OFFERED', 'ACCEPTED', 'REJECTED'].includes(status)
        ? random.int(35, 95)
        : null,
      interviewDate: ['SHORTLISTED', 'OFFERED', 'ACCEPTED'].includes(status)
        ? isoDate(addDays(submittedAt, 10))
        : null,
      interviewNote: null,
      decisionNote: status === 'REJECTED' ? 'Did not meet the screening benchmark for this level.' : null,
      offeredClassId: ['OFFERED', 'ACCEPTED'].includes(status)
        ? random.pick(classes.filter((c) => c.levelId === level.id)).id
        : null,
      offeredClassName: null,
      offerExpiresOn: ['OFFERED'].includes(status) ? isoDate(addDays(TODAY, 14)) : null,
      submittedAt: status === 'DRAFT' ? null : submittedAt.toISOString(),
      decidedAt: ['OFFERED', 'ACCEPTED', 'REJECTED'].includes(status)
        ? addDays(submittedAt, 14).toISOString()
        : null,
      acceptedAt: status === 'ACCEPTED' ? addDays(submittedAt, 18).toISOString() : null,
      convertedStudentId: null,
      timeline,
      version: 1,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* CBT                                                                         */
/* -------------------------------------------------------------------------- */

function seedCbt(db: MockDb, schoolId: string): void {
  const subjects = db.subjects.filter((subject) => subject.schoolId === schoolId).slice(0, 5);
  const classes = db.classes.filter((schoolClass) => schoolClass.schoolId === schoolId).slice(0, 4);
  const currentTerm = db.terms.find((term) => term.schoolId === schoolId && term.isCurrent)!;
  const staff = db.staff.filter((member) => member.schoolId === schoolId);

  const questionBank: [string, string[], number][] = [
    ['Which gas is taken in by plants during photosynthesis?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 1],
    ['The word equation for photosynthesis produces glucose and…', ['Water', 'Oxygen', 'Carbon dioxide', 'Starch'], 1],
    ['Convert 1011 (base 2) to base 10.', ['9', '10', '11', '13'], 2],
    ['Solve: 3x + 5 = 20', ['x = 3', 'x = 5', 'x = 15', 'x = 25'], 1],
    ['Which of these is a noun?', ['Quickly', 'Beautiful', 'Happiness', 'Running'], 2],
    ['The area of a rectangle 8 cm by 5 cm is…', ['13 cm²', '26 cm²', '40 cm²', '45 cm²'], 2],
    ['Which organelle is found only in plant cells?', ['Nucleus', 'Chloroplast', 'Mitochondrion', 'Ribosome'], 1],
    ['A triangle has angles 60°, 60° and…', ['30°', '45°', '60°', '90°'], 2],
  ];

  subjects.forEach((subject) => {
    const curriculum = db.curricula.find(
      (entry) => entry.schoolId === schoolId && entry.subjectId === subject.id,
    );
    const topics = curriculum ? db.topics.filter((topic) => topic.curriculumId === curriculum.id) : [];

    questionBank.forEach(([text, options, correctIndex]) => {
      const topic = topics.length > 0 ? random.pick(topics) : null;
      const objective = topic ? random.pick(topic.objectives) : null;

      db.questions.push({
        id: id('qst'),
        schoolId,
        subjectId: subject.id,
        subjectName: subject.name,
        topicId: topic?.id ?? null,
        topicTitle: topic?.title ?? null,
        objectiveId: objective?.id ?? null,
        objectiveStatement: objective?.statement ?? null,
        levelId: null,
        type: 'MULTIPLE_CHOICE',
        difficulty: random.pick(['EASY', 'MEDIUM', 'HARD'] as const),
        text,
        imageUrl: null,
        options: options.map((option, index) => ({
          id: id('opt'),
          label: String.fromCharCode(65 + index),
          text: option,
          isCorrect: index === correctIndex,
        })),
        correctAnswer: null,
        explanation: null,
        marks: 1,
        usageCount: random.int(0, 12),
        createdByName: random.pick(staff).fullName,
        createdAt: addDays(TODAY, -random.int(10, 200)).toISOString(),
      });
    });
  });

  subjects.slice(0, 3).forEach((subject, index) => {
    const questions = db.questions.filter(
      (question) => question.schoolId === schoolId && question.subjectId === subject.id,
    );
    const mode = index === 0 ? 'PRACTICE' : 'EXAM';
    const state = index === 0 ? 'OPEN' : index === 1 ? 'SCHEDULED' : 'CLOSED';

    db.assessments.push({
      id: id('asm'),
      schoolId,
      title: `${subject.name} ${mode === 'PRACTICE' ? 'practice set' : 'mid-term test'}`,
      mode,
      subjectId: subject.id,
      subjectName: subject.name,
      classIds: classes.map((schoolClass) => schoolClass.id),
      classNames: classes.map((schoolClass) => schoolClass.name),
      termId: currentTerm.id,
      questionIds: questions.map((question) => question.id),
      questionCount: questions.length,
      totalMarks: questions.length,
      durationMinutes: mode === 'PRACTICE' ? 20 : 45,
      attemptsAllowed: mode === 'PRACTICE' ? 5 : 1,
      startsAt: state === 'SCHEDULED' ? addDays(TODAY, 3).toISOString() : addDays(TODAY, -2).toISOString(),
      endsAt: state === 'CLOSED' ? addDays(TODAY, -1).toISOString() : addDays(TODAY, 7).toISOString(),
      shuffleQuestions: true,
      shuffleOptions: mode === 'EXAM',
      showResultImmediately: mode === 'PRACTICE',
      passScore: 50,
      state: state as CbtAssessment['state'],
      createdByName: random.pick(staff).fullName,
      submissionCount: state === 'CLOSED' ? random.int(20, 60) : random.int(0, 20),
      averageScore: state === 'CLOSED' ? random.int(45, 80) : null,
      version: 1,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Engagement                                                                  */
/* -------------------------------------------------------------------------- */

function seedEngagement(db: MockDb, schoolId: string): void {
  const staff = db.staff.filter((member) => member.schoolId === schoolId);
  const guardians = db.guardians.filter((guardian) => guardian.schoolId === schoolId);
  const students = db.students.filter((student) => student.schoolId === schoolId);

  const announcements: [string, string, Announcement['audience']][] = [
    ['Resumption date for the new term', 'School resumes on Monday. Students should come with their complete uniform and all textbooks.', 'EVERYONE'],
    ['PTA meeting this Saturday', 'The termly PTA meeting holds at 10am in the school hall. Attendance is important.', 'PARENTS'],
    ['Second instalment of fees now due', 'Parents paying in instalments should settle the second instalment before the end of the month.', 'PARENTS'],
    ['Inter-house sports — house captains needed', 'Students interested in leading their house should see their form teacher.', 'STUDENTS'],
    ['Staff briefing moved to Thursday', 'The weekly briefing has moved to Thursday 7:30am.', 'STAFF'],
  ];

  announcements.forEach(([title, body, audience], index) => {
    db.announcements.push({
      id: id('ann'),
      schoolId,
      title,
      body,
      audience,
      classIds: [],
      publishAt: addDays(TODAY, -index * 3).toISOString(),
      expiresAt: null,
      pinned: index === 0,
      authorName: 'Adaeze Okonkwo',
      channels: index < 2 ? ['IN_APP', 'PUSH', 'SMS'] : ['IN_APP'],
      status: 'PUBLISHED',
      readCount: random.int(20, 400),
      recipientCount: random.int(400, 700),
    });
  });

  const newsPosts: [string, string, NewsPost['category']][] = [
    ['Our students sweep the state science fair', 'Three of our JSS 2 students took first and second place in the state science fair with a project on solar-powered irrigation.', 'ACHIEVEMENT'],
    ['New science laboratory opens', 'The new laboratory was commissioned last week and is now in use by senior classes.', 'NEWS'],
    ['Inter-house sports 2026', 'A full day of athletics, relays and tug-of-war. Green House took the trophy.', 'EVENT'],
    ['Reading week photo gallery', 'Pictures from a week of reading aloud, book swaps and the dress-as-your-favourite-character day.', 'GALLERY'],
  ];

  newsPosts.forEach(([title, body, category], index) => {
    db.news.push({
      id: id('nws'),
      schoolId,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      excerpt: body.slice(0, 120),
      body,
      coverImageUrl: null,
      gallery: [],
      category,
      audience: 'PUBLIC',
      publishedAt: addDays(TODAY, -index * 6).toISOString(),
      status: 'PUBLISHED',
      authorName: 'Adaeze Okonkwo',
      containsStudentPhotos: category === 'GALLERY',
      likeCount: random.int(3, 60),
      commentCount: random.int(0, 12),
    });
  });

  // Parent–teacher conversations, always anchored to a specific child.
  guardians.slice(0, 12).forEach((guardian) => {
    const link = db.studentGuardians.find((entry) => entry.guardianId === guardian.id);
    if (!link) return;
    const student = students.find((entry) => entry.id === link.studentId);
    const teacher = random.pick(staff);
    const conversationId = id('cnv');
    const lastMessageAt = addDays(TODAY, -random.int(0, 20));

    db.conversations.push({
      id: conversationId,
      schoolId,
      subject: random.pick([
        'Question about the maths homework',
        'Absence on Friday',
        'Request for a meeting',
        'Fees instalment plan',
        'Concern about reading progress',
      ]),
      studentId: student?.id ?? null,
      studentName: student?.fullName ?? null,
      participants: [
        { userId: `user_${guardian.id}`, name: guardian.fullName, role: 'Parent', photoUrl: null },
        { userId: `user_${teacher.id}`, name: teacher.fullName, role: 'Teacher', photoUrl: null },
      ],
      lastMessagePreview: 'Thank you, I will speak with him this evening.',
      lastMessageAt: lastMessageAt.toISOString(),
      unreadCount: random.int(0, 3),
      status: 'OPEN',
    });

    const thread = [
      { sender: guardian, body: 'Good afternoon. I wanted to ask about the homework that was set on Tuesday.' },
      { sender: teacher, body: 'Good afternoon. It was exercise 4 in the textbook, questions 1 to 8. It is due on Friday.' },
      { sender: guardian, body: 'Thank you, I will speak with him this evening.' },
    ];

    thread.forEach((entry, index) => {
      const isGuardian = 'studentCount' in entry.sender;
      db.messages.push({
        id: id('msg'),
        conversationId,
        senderId: `user_${entry.sender.id}`,
        senderName: entry.sender.fullName,
        senderRole: isGuardian ? 'Parent' : 'Teacher',
        senderPhotoUrl: null,
        body: entry.body,
        sentAt: addDays(lastMessageAt, index - thread.length + 1).toISOString(),
        readBy: [],
        attachments: [],
      });
    });
  });

  const notificationBlueprints: [AppNotification['category'], string, string, AppNotification['severity']][] = [
    ['ATTENDANCE', 'Chidinma was marked absent today', 'No reason has been recorded. Please contact the school if this is unexpected.', 'WARNING'],
    ['RESULT', 'First term results published', 'Results for JSS 2 Silver are now available in the portal.', 'SUCCESS'],
    ['FEE', 'Fee balance outstanding', 'A balance of ₦92,000 remains on the current term invoice.', 'WARNING'],
    ['CALENDAR', 'PTA meeting on Saturday', 'The termly PTA meeting holds at 10am in the school hall.', 'INFO'],
    ['MESSAGE', 'New message from Mrs Adeyemi', 'Regarding this week’s homework.', 'INFO'],
    ['ADMISSION', 'Application moved to screening', 'Application APP/2026/0012 has been moved to screening.', 'INFO'],
    ['COLLECTION', 'Tobenna was collected at 2:15pm', 'Collected by Mrs Chioma Eze and released by the gate staff.', 'INFO'],
  ];

  notificationBlueprints.forEach(([category, title, body, severity], index) => {
    db.notifications.push({
      id: id('ntf'),
      schoolId,
      category,
      title,
      body,
      actionUrl:
        category === 'FEE' ? '/family/finance' : category === 'MESSAGE' ? '/messages' : null,
      readAt: index > 2 ? addDays(TODAY, -index).toISOString() : null,
      createdAt: addDays(TODAY, -index).toISOString(),
      severity,
      entityType: null,
      entityId: null,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Audit and roles                                                             */
/* -------------------------------------------------------------------------- */

function seedAudit(db: MockDb, schoolId: string): void {
  const actions: [string, string, string, AuditLogEntry['severity']][] = [
    ['result.published', 'ScoreSheet', 'JSS 2 Silver · Mathematics', 'CRITICAL'],
    ['result.amended', 'ScoreSheet', 'JSS 1 Gold · English Language', 'CRITICAL'],
    ['payment.recorded', 'Payment', 'PAY-2026-000341', 'INFO'],
    ['invoice.adjusted', 'Invoice', 'INV/2026/00187', 'WARNING'],
    ['student.status_changed', 'Student', 'Chidi Okafor — withdrawn', 'WARNING'],
    ['role.permissions_changed', 'Role', 'Form teacher', 'CRITICAL'],
    ['admission.decision', 'AdmissionApplication', 'APP/2026/0021 — offered', 'INFO'],
    ['discipline.action_taken', 'DisciplineIncident', 'DSC/2026/0004', 'WARNING'],
    ['student.created', 'Student', 'Amarachi Nnaji', 'INFO'],
    ['settings.updated', 'School', 'Absence alert cutoff', 'INFO'],
  ];

  actions.forEach(([action, entityType, entityLabel, severity], index) => {
    db.auditLog.push({
      id: id('aud'),
      schoolId,
      actorUserId: `user_admin_${schoolId}`,
      actorName: random.pick(['Adaeze Okonkwo', 'Dr Emeka Nwosu', 'Ibrahim Sule']),
      actorRole: random.pick(['School administrator', 'Principal', 'Bursar']),
      action,
      entityType,
      entityId: id('ent'),
      entityLabel,
      before: action.includes('amended') ? { total: 62 } : null,
      after: action.includes('amended') ? { total: 68 } : null,
      ipAddress: `102.89.${random.int(0, 255)}.${random.int(1, 254)}`,
      userAgent: 'Mozilla/5.0',
      requestId: id('req'),
      occurredAt: addDays(TODAY, -index).toISOString(),
      severity,
    });
  });
}

function seedImports(db: MockDb, schoolId: string): void {
  const jobs: [ImportJob['entity'], string, ImportJob['status'], number, number, number][] = [
    ['STUDENTS', 'jss1-register-2025.xlsx', 'COMPLETED', 42, 42, 0],
    ['STAFF', 'teaching-staff.xlsx', 'PARTIAL', 15, 13, 2],
  ];

  jobs.forEach(([entity, fileName, status, totalRows, created, failed], index) => {
    const occurredAt = addDays(TODAY, -(21 - index * 9));
    db.importJobs.push({
      id: id('imp'),
      schoolId,
      entity,
      fileName,
      status,
      totalRows,
      created,
      failed,
      startedByName: 'Adaeze Okonkwo',
      startedAt: occurredAt.toISOString(),
      completedAt: occurredAt.toISOString(),
    });
  });
}

function seedRoles(db: MockDb, schoolId: string): void {
  const roleBlueprints: [string, string, string][] = [
    ['School administrator', 'SCHOOL_ADMIN', 'Full access to the school'],
    ['Principal', 'PRINCIPAL', 'Academic oversight, approvals and analytics'],
    ['Vice principal', 'VICE_PRINCIPAL', 'Supports the principal; reviews discipline'],
    ['Teacher', 'TEACHER', 'Teaches classes, marks registers and enters scores'],
    ['Form teacher', 'FORM_TEACHER', 'A teacher with responsibility for one class'],
    ['Bursar', 'BURSAR', 'Fees, invoices, payments and reconciliation'],
    ['Admissions officer', 'ADMISSION_OFFICER', 'Runs the admissions pipeline'],
    ['Parent', 'PARENT', 'Sees their own children only'],
    ['Student', 'STUDENT', 'Sees their own record only'],
  ];

  roleBlueprints.forEach(([name, key, description]) => {
    db.roles.push({
      id: `${schoolId}_role_${key}`,
      schoolId,
      name,
      key,
      description,
      isSystem: true,
      permissions: permissionsForRoles([key as never]),
      memberCount: random.int(1, 18),
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Users and memberships                                                       */
/* -------------------------------------------------------------------------- */

function seedUsers(db: MockDb): void {
  DEMO_PERSONAS.forEach((persona) => {
    const school = db.schools[persona.schoolIndex];
    const schoolStudents = db.students.filter((student) => student.schoolId === school.id);
    const schoolGuardians = db.guardians.filter((guardian) => guardian.schoolId === school.id);
    const schoolStaff = db.staff.filter((member) => member.schoolId === school.id);

    let guardianId: string | null = null;
    let studentId: string | null = null;
    let staffId: string | null = null;

    if (persona.link?.type === 'guardian') {
      // Give the demo parent several children so the child switcher is exercised.
      const guardian = schoolGuardians[persona.link.index];
      guardianId = guardian.id;
      guardian.fullName = persona.name;
      guardian.email = persona.email;
      guardian.hasPortalAccess = true;

      const existing = db.studentGuardians.filter((link) => link.guardianId === guardian.id);
      const needed = Math.max(0, 3 - existing.length);
      for (let index = 0; index < needed; index += 1) {
        const student = schoolStudents[index * 7 + 2];
        if (!student) break;
        if (db.studentGuardians.some((l) => l.guardianId === guardian.id && l.studentId === student.id)) {
          continue;
        }
        student.guardianCount += 1;
        guardian.studentCount += 1;
        db.studentGuardians.push({
          id: id('sgl'),
          studentId: student.id,
          studentName: student.fullName,
          studentAdmissionNo: student.admissionNo,
          studentPhotoUrl: null,
          guardianId: guardian.id,
          guardianName: guardian.fullName,
          guardianPhone: guardian.phone,
          guardianEmail: guardian.email,
          relationship: 'MOTHER',
          isPrimaryContact: index === 0,
          isEmergencyContact: true,
          isFinanciallyResponsible: true,
          canPickUp: true,
        });
      }
      db.studentGuardians
        .filter((link) => link.guardianId === guardian.id)
        .forEach((link) => {
          link.guardianName = persona.name;
          link.guardianEmail = persona.email;
        });
    }

    if (persona.link?.type === 'student') {
      const student = schoolStudents[persona.link.index];
      studentId = student.id;
    }

    const userId = `user_${persona.email}`;

    if (persona.link?.type === 'staff') {
      const member = schoolStaff[persona.link.index];
      staffId = member.id;
      member.fullName = persona.name;
      member.email = persona.email;
      member.userId = userId;

      // Anything seeded against the staff record before this login existed now
      // belongs to the person, so "who wrote this" and "is this mine" agree.
      db.curricula
        .filter((curriculum) => curriculum.createdById === member.id)
        .forEach((curriculum) => {
          curriculum.createdById = userId;
          curriculum.createdByName = persona.name;
        });
    }

    const membership: SchoolMembership = {
      id: id('mbr'),
      schoolId: school.id,
      schoolName: school.name,
      schoolShortName: school.shortName,
      schoolSlug: school.slug,
      branchId: null,
      branchName: null,
      roles: persona.roles,
      customRoleNames: [],
      permissions: permissionsForRoles(persona.roles),
      branding: school.branding,
      status: 'ACTIVE',
      guardianId,
      studentId,
      staffId,
    };

    db.users.push({
      id: userId,
      firebaseUid: `mock-${persona.email.split('@')[0]}`,
      email: persona.email,
      displayName: persona.name,
      phone: null,
      photoUrl: null,
      isPlatformAdmin: persona.roles.includes('SUPER_ADMIN'),
      memberships: [membership],
      createdAt: new Date(CURRENT_YEAR - 1, 7, 1).toISOString(),
    });
  });
}
