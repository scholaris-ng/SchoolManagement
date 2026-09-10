import type { DataSource } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS, ROLES, ROLE_LABEL, type RoleName } from '../../../config/constants';
import { School } from '../../../modules/school/entities/school.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import { SchoolMembership } from '../../../modules/auth/entities/schoolMembership.entity';
import { Role } from '../../../modules/rbac/entities/role.entity';
import { MembershipRole } from '../../../modules/rbac/entities/membershipRole.entity';
import { Staff } from '../../../modules/staff/entities/staff.entity';
import { TeachingAssignment } from '../../../modules/staff/entities/teachingAssignment.entity';
import { AcademicSession } from '../../../modules/academics/entities/academicSession.entity';
import { Term } from '../../../modules/academics/entities/term.entity';
import { SchoolLevel } from '../../../modules/academics/entities/schoolLevel.entity';
import { SchoolClass } from '../../../modules/academics/entities/schoolClass.entity';
import { ClassFormTeacher } from '../../../modules/academics/entities/classFormTeacher.entity';
import { Subject } from '../../../modules/academics/entities/subject.entity';
import { SubjectLevel } from '../../../modules/academics/entities/subjectLevel.entity';
import { Room } from '../../../modules/academics/entities/room.entity';
import { House } from '../../../modules/academics/entities/house.entity';
import { TimetablePeriod } from '../../../modules/academics/entities/timetablePeriod.entity';
import { teachingWeeksBetween } from '../../../shared/utils/weekdays';

/**
 * Development seed.
 *
 * Two schools, not one, and deliberately so: a single-tenant seed cannot catch
 * a query that forgot its `schoolId` predicate, because every row belongs to the
 * only school there is. The second school exists to make that class of bug fail
 * a test rather than reach production.
 *
 * Emails match the personas in `client/src/mocks/personas.ts`, so with
 * `DEV_AUTH_ENABLED=true` the finished UI signs in against this data unchanged.
 *
 * Idempotent: re-running finds the schools by code and does nothing.
 */
export async function seedFoundation(dataSource: DataSource): Promise<void> {
  const existing = await dataSource.getRepository(School).findOne({
    where: { code: 'BFA' },
  });
  if (existing) {
    console.info('[seed] Already seeded — nothing to do.');
    return;
  }

  await dataSource.transaction(async (manager) => {
    // ─── Brightfield Academy ─────────────────────────────────────────────────
    const brightfield = await manager.save(
      manager.create(School, {
        name: 'Brightfield Academy',
        shortName: 'Brightfield',
        code: 'BFA',
        slug: 'brightfield-academy',
        email: 'hello@brightfield.edu.ng',
        phone: '+2348030000001',
        addressLine1: '14 Awolowo Road',
        city: 'Ikoyi',
        state: 'Lagos',
        status: 'ACTIVE',
        branding: {
          primaryColor: '#1d4ed8',
          accentColor: '#f59e0b',
          logoUrl: null,
          faviconUrl: null,
          motto: 'Knowledge, Character, Service',
        },
        settings: {
          timezone: 'Africa/Lagos',
          currency: 'NGN',
          currencySymbol: '₦',
          country: 'NG',
          locale: 'en-NG',
          requirePhotoConsent: true,
          absenceAlertEnabled: true,
          absenceAlertCutoff: '09:30',
          resultPublishNotification: true,
          allowParentTeacherMessaging: true,
          publicWebsiteEnabled: true,
        },
      }),
    );

    // A second tenant, so cross-tenant leaks have something to leak into.
    const rivercrest = await manager.save(
      manager.create(School, {
        name: 'Rivercrest School',
        shortName: 'Rivercrest',
        code: 'RCS',
        slug: 'rivercrest-school',
        email: 'hello@rivercrest.edu.ng',
        phone: '+2348030000002',
        addressLine1: '2 Rumuola Close',
        city: 'Port Harcourt',
        state: 'Rivers',
        status: 'ACTIVE',
        branding: {
          primaryColor: '#047857',
          accentColor: '#0ea5e9',
          logoUrl: null,
          faviconUrl: null,
          motto: 'Rise and Build',
        },
        settings: {
          timezone: 'Africa/Lagos',
          currency: 'NGN',
          currencySymbol: '₦',
          country: 'NG',
          locale: 'en-NG',
          requirePhotoConsent: true,
          absenceAlertEnabled: false,
          absenceAlertCutoff: '09:00',
          resultPublishNotification: true,
          allowParentTeacherMessaging: false,
          publicWebsiteEnabled: false,
        },
      }),
    );

    // ─── Roles ───────────────────────────────────────────────────────────────
    // Each school gets its own copy of every built-in role, so one school
    // editing "Teacher" cannot change what a teacher elsewhere may do.
    const roleIndex = new Map<string, Role>();
    for (const school of [brightfield, rivercrest]) {
      for (const key of ROLES) {
        const role = await manager.save(
          manager.create(Role, {
            schoolId: school.id,
            name: ROLE_LABEL[key],
            key,
            description: null,
            isSystem: true,
            permissions: DEFAULT_ROLE_PERMISSIONS[key],
          }),
        );
        roleIndex.set(`${school.id}:${key}`, role);
      }
    }

    // ─── Academic year ───────────────────────────────────────────────────────
    const session = await manager.save(
      manager.create(AcademicSession, {
        schoolId: brightfield.id,
        name: '2025/2026',
        startDate: '2025-09-08',
        endDate: '2026-07-24',
        isCurrent: true,
        status: 'ACTIVE',
      }),
    );

    const termSeeds: { name: string; startDate: string; endDate: string; current: boolean }[] = [
      { name: 'First Term', startDate: '2025-09-08', endDate: '2025-12-12', current: true },
      { name: 'Second Term', startDate: '2026-01-05', endDate: '2026-04-02', current: false },
      { name: 'Third Term', startDate: '2026-04-20', endDate: '2026-07-24', current: false },
    ];

    for (const [index, seed] of termSeeds.entries()) {
      await manager.save(
        manager.create(Term, {
          schoolId: brightfield.id,
          sessionId: session.id,
          name: seed.name,
          sequence: index + 1,
          startDate: seed.startDate,
          endDate: seed.endDate,
          teachingWeeks: teachingWeeksBetween(seed.startDate, seed.endDate),
          isCurrent: seed.current,
          status: seed.current ? 'ACTIVE' : 'PLANNED',
        }),
      );
    }

    // ─── Level ladder ────────────────────────────────────────────────────────
    const levelSeeds = [
      { name: 'JSS 1', code: 'JSS1' },
      { name: 'JSS 2', code: 'JSS2' },
      { name: 'JSS 3', code: 'JSS3' },
      { name: 'SSS 1', code: 'SSS1' },
    ];
    const levels: SchoolLevel[] = [];
    for (const [index, seed] of levelSeeds.entries()) {
      levels.push(
        await manager.save(
          manager.create(SchoolLevel, {
            schoolId: brightfield.id,
            name: seed.name,
            code: seed.code,
            sequence: index + 1,
            gradingSchemeId: null,
          }),
        ),
      );
    }

    // ─── Facilities ──────────────────────────────────────────────────────────
    const room = await manager.save(
      manager.create(Room, {
        schoolId: brightfield.id,
        name: 'Block A — Room 1',
        code: 'A1',
        capacity: 35,
        type: 'CLASSROOM',
      }),
    );
    await manager.save(
      manager.create(Room, {
        schoolId: brightfield.id,
        name: 'Science Laboratory',
        code: 'LAB1',
        capacity: 30,
        type: 'LABORATORY',
      }),
    );

    for (const house of [
      { name: 'Blue House', color: '#2563eb', motto: 'Steady and true' },
      { name: 'Gold House', color: '#f59e0b', motto: 'Shine brightly' },
      { name: 'Green House', color: '#059669', motto: 'Grow together' },
    ]) {
      await manager.save(
        manager.create(House, {
          schoolId: brightfield.id,
          ...house,
          captainStudentId: null,
          points: 0,
        }),
      );
    }

    const periodSeeds = [
      { name: 'Period 1', startTime: '08:00', endTime: '08:40', isBreak: false },
      { name: 'Period 2', startTime: '08:40', endTime: '09:20', isBreak: false },
      { name: 'Break', startTime: '09:20', endTime: '09:40', isBreak: true },
      { name: 'Period 3', startTime: '09:40', endTime: '10:20', isBreak: false },
      { name: 'Period 4', startTime: '10:20', endTime: '11:00', isBreak: false },
    ];
    for (const [index, seed] of periodSeeds.entries()) {
      await manager.save(
        manager.create(TimetablePeriod, {
          schoolId: brightfield.id,
          ...seed,
          sequence: index + 1,
        }),
      );
    }

    // ─── Subjects ────────────────────────────────────────────────────────────
    const subjectSeeds = [
      { name: 'Mathematics', code: 'MTH', category: 'Core', isCore: true },
      { name: 'English Language', code: 'ENG', category: 'Core', isCore: true },
      { name: 'Basic Science', code: 'BSC', category: 'Science', isCore: true },
      { name: 'Civic Education', code: 'CIV', category: 'Humanities', isCore: false },
    ];
    const subjects: Subject[] = [];
    for (const seed of subjectSeeds) {
      const subject = await manager.save(
        manager.create(Subject, {
          schoolId: brightfield.id,
          ...seed,
          isActive: true,
          schedule: [],
        }),
      );
      subjects.push(subject);

      // Offered at every level in this seed.
      for (const level of levels) {
        await manager.save(
          manager.create(SubjectLevel, {
            schoolId: brightfield.id,
            subjectId: subject.id,
            levelId: level.id,
          }),
        );
      }
    }

    // ─── Staff ───────────────────────────────────────────────────────────────
    const teacher = await manager.save(
      manager.create(Staff, {
        schoolId: brightfield.id,
        staffNo: 'BFA/STF/001',
        firstName: 'Funmilayo',
        lastName: 'Adeyemi',
        email: 'teacher@brightfield.edu.ng',
        phone: '+2348030000011',
        gender: 'FEMALE',
        designation: 'Teacher',
        department: 'Sciences',
        employmentType: 'FULL_TIME',
        employmentDate: '2021-09-01',
        status: 'ACTIVE',
      }),
    );

    const bursar = await manager.save(
      manager.create(Staff, {
        schoolId: brightfield.id,
        staffNo: 'BFA/STF/002',
        firstName: 'Ibrahim',
        lastName: 'Sule',
        email: 'bursar@brightfield.edu.ng',
        phone: '+2348030000012',
        gender: 'MALE',
        designation: 'Bursar',
        department: 'Finance',
        employmentType: 'FULL_TIME',
        employmentDate: '2020-01-13',
        status: 'ACTIVE',
      }),
    );

    // ─── Classes ─────────────────────────────────────────────────────────────
    const classSeeds = [
      { level: levels[0], name: 'JSS 1 Gold', arm: 'Gold' },
      { level: levels[0], name: 'JSS 1 Silver', arm: 'Silver' },
      { level: levels[1], name: 'JSS 2 Silver', arm: 'Silver' },
      { level: levels[3], name: 'SSS 1 Science', arm: 'Science' },
    ];
    const classes: SchoolClass[] = [];
    for (const [index, seed] of classSeeds.entries()) {
      classes.push(
        await manager.save(
          manager.create(SchoolClass, {
            schoolId: brightfield.id,
            levelId: seed.level.id,
            name: seed.name,
            arm: seed.arm,
            code: `${seed.level.code}-${String(index + 1).padStart(2, '0')}`,
            capacity: 40,
            enrolledCount: 0,
            roomId: index === 0 ? room.id : null,
            isActive: true,
          }),
        ),
      );
    }

    // Funmilayo is form teacher of JSS 1 Gold. The persona list describes her
    // exactly that way, so the teacher-scoped screens have something to narrow to.
    await manager.save(
      manager.create(ClassFormTeacher, {
        schoolId: brightfield.id,
        classId: classes[0].id,
        staffId: teacher.id,
      }),
    );

    // Verified pairs, not a cross-product: she teaches Mathematics and Basic
    // Science to JSS 1 Gold, and Mathematics only to JSS 2 Silver. That
    // asymmetry is what makes the pair check in `academicScope` testable.
    const assignments = [
      { classId: classes[0].id, subjectId: subjects[0].id },
      { classId: classes[0].id, subjectId: subjects[2].id },
      { classId: classes[2].id, subjectId: subjects[0].id },
    ];
    for (const assignment of assignments) {
      await manager.save(
        manager.create(TeachingAssignment, {
          schoolId: brightfield.id,
          staffId: teacher.id,
          ...assignment,
        }),
      );
    }

    // ─── Users and memberships ───────────────────────────────────────────────
    const personas: {
      email: string;
      displayName: string;
      schoolId: string;
      roles: RoleName[];
      staffId?: string;
    }[] = [
      {
        email: 'admin@brightfield.edu.ng',
        displayName: 'Adaeze Okonkwo',
        schoolId: brightfield.id,
        roles: ['SCHOOL_ADMIN'],
      },
      {
        email: 'principal@brightfield.edu.ng',
        displayName: 'Dr Emeka Nwosu',
        schoolId: brightfield.id,
        roles: ['PRINCIPAL'],
      },
      {
        email: 'teacher@brightfield.edu.ng',
        displayName: 'Funmilayo Adeyemi',
        schoolId: brightfield.id,
        roles: ['TEACHER', 'FORM_TEACHER'],
        staffId: teacher.id,
      },
      {
        email: 'bursar@brightfield.edu.ng',
        displayName: 'Ibrahim Sule',
        schoolId: brightfield.id,
        roles: ['BURSAR'],
        staffId: bursar.id,
      },
      {
        email: 'admin@rivercrest.edu.ng',
        displayName: 'Grace Bello',
        schoolId: rivercrest.id,
        roles: ['SCHOOL_ADMIN'],
      },
    ];

    for (const persona of personas) {
      const user = await manager.save(
        manager.create(User, {
          // A placeholder until the person signs in with Firebase for real, at
          // which point `SessionService.ensureUser` adopts this row by email and
          // replaces this with the genuine uid.
          firebaseUid: `seed:${persona.email}`,
          email: persona.email,
          firstName: persona.displayName.split(' ').slice(0, -1).join(' '),
          lastName: persona.displayName.split(' ').slice(-1)[0],
          displayName: persona.displayName,
          // Seeded accounts skip the code flow — they exist to be signed in as.
          emailVerified: true,
          phone: null,
          photoUrl: null,
          isPlatformAdmin: false,
        }),
      );

      const membership = await manager.save(
        manager.create(SchoolMembership, {
          userId: user.id,
          schoolId: persona.schoolId,
          branchId: null,
          status: 'ACTIVE',
          staffId: persona.staffId ?? null,
          guardianId: null,
          studentId: null,
          acceptedAt: new Date(),
        }),
      );

      for (const key of persona.roles) {
        const role = roleIndex.get(`${persona.schoolId}:${key}`);
        if (!role) continue;
        await manager.save(
          manager.create(MembershipRole, { membershipId: membership.id, roleId: role.id }),
        );
      }
    }

    // Link the staff rows back to their users now that both exist.
    for (const [staffId, email] of [
      [teacher.id, 'teacher@brightfield.edu.ng'],
      [bursar.id, 'bursar@brightfield.edu.ng'],
    ] as const) {
      const user = await manager.findOne(User, { where: { email } });
      if (user) await manager.update(Staff, staffId, { userId: user.id });
    }
  });

  console.info('[seed] Seeded 2 schools, 5 users, 20 roles and the academic structure.');
}
