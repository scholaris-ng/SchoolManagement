/**
 * Generates the Postman collection and environment.
 *
 * Generated rather than hand-edited because the collection carries a saved
 * example for every status code every endpoint can return (spec section 21.5) —
 * around 180 of them. Keeping those consistent by hand across a growing API is
 * not realistic; describing each endpoint once and emitting the rest is.
 *
 * Run with `npm run postman -w @school/api` after adding or changing a route.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Defaults to this file's own directory, so `node postman/build.mjs` works from
// the server root with no argument.
const OUT_DIR = process.argv[2] ?? path.dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT_DIR, { recursive: true });

const json = (o) => JSON.stringify(o, null, 2);

/** Success envelope, matching ApiResponse.ok. */
const ok = (data, message) =>
  json(message === undefined ? { success: true, data } : { success: true, data, message });

/** Failure envelope, matching ApiResponse.error. */
const fail = (code, message, details) =>
  json({ success: false, error: details ? { code, message, details } : { code, message } });

const HEADERS = [{ key: 'Content-Type', value: 'application/json' }];

function url(rawPath, query) {
  const clean = rawPath.replace(/^\//, '');
  const out = {
    raw: `{{baseUrl}}/${clean}${query?.length ? `?${query.map((q) => `${q.key}=${q.value}`).join('&')}` : ''}`,
    host: ['{{baseUrl}}'],
    path: clean.split('/'),
  };
  if (query?.length) out.query = query;
  return out;
}

function example(name, code, status, originalRequest, bodyStr) {
  return {
    name,
    originalRequest,
    status,
    code,
    header: HEADERS,
    _postman_previewlanguage: 'json',
    body: bodyStr,
  };
}

const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
};

/** Standard failures, derived from the route's middleware chain (spec 21.5). */
const STD = {
  401: () => ['401 Not signed in', 401, fail('UNAUTHENTICATED', 'You are not signed in.')],
  '401.expired': () => ['401 Token expired', 401, fail('UNAUTHENTICATED', 'Your session has expired. Please sign in again.')],
  403: () => ['403 Forbidden', 403, fail('FORBIDDEN', 'You do not have permission to do that.')],
  '403.school': () => ['403 No access to that school', 403, fail('FORBIDDEN', 'You do not have access to that school.')],
  404: (what) => [`404 Not found`, 404, fail('NOT_FOUND', `${what} was not found.`)],
  409: (msg) => ['409 Conflict', 409, fail('CONFLICT', msg)],
  '409.version': () => ['409 Version conflict', 409, fail('VERSION_CONFLICT', 'Someone else changed this record while you were editing it.')],
  422: (field, msg) => ['422 Validation failed', 422, fail('VALIDATION_ERROR', 'Validation failed', [{ field, path: `body.${field}`, message: msg, code: 'too_small' }])],
  429: () => ['429 Rate limited', 429, fail('RATE_LIMITED', 'Too many requests. Please slow down.')],
};

// ── Sample payloads ─────────────────────────────────────────────────────────
const SESSION = {
  user: {
    id: '3f1c1e60-1f2a-4c9b-9a01-2b7d4e5f6a01',
    firebaseUid: 'uid_adaeze',
    email: 'admin@brightfield.edu.ng',
    displayName: 'Adaeze Okonkwo',
    phone: null,
    photoUrl: null,
    isPlatformAdmin: false,
    memberships: [
      {
        id: '8a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        schoolId: '11111111-2222-4333-8444-555555555555',
        schoolName: 'Brightfield Academy',
        schoolShortName: 'Brightfield',
        schoolSlug: 'brightfield-academy',
        branchId: null,
        branchName: null,
        roles: ['SCHOOL_ADMIN'],
        customRoleNames: [],
        permissions: ['school.read', 'settings.manage', 'academics.read', 'academics.manage', 'role.manage', 'audit.read'],
        branding: { primaryColor: '#1d4ed8', accentColor: '#f59e0b', logoUrl: null, faviconUrl: null, motto: 'Knowledge, Character, Service' },
        status: 'ACTIVE',
        guardianId: null,
        studentId: null,
        staffId: null,
      },
    ],
    createdAt: '2025-09-01T08:00:00.000Z',
  },
  activeSchoolId: '11111111-2222-4333-8444-555555555555',
};

const SCHOOL = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Brightfield Academy',
  shortName: 'Brightfield',
  code: 'BFA',
  slug: 'brightfield-academy',
  email: 'hello@brightfield.edu.ng',
  phone: '+2348030000001',
  website: null,
  addressLine1: '14 Awolowo Road',
  addressLine2: null,
  city: 'Ikoyi',
  state: 'Lagos',
  branding: { primaryColor: '#1d4ed8', accentColor: '#f59e0b', logoUrl: null, faviconUrl: null, motto: 'Knowledge, Character, Service' },
  settings: {
    timezone: 'Africa/Lagos', currency: 'NGN', currencySymbol: '₦', country: 'NG', locale: 'en-NG',
    requirePhotoConsent: true, absenceAlertEnabled: true, absenceAlertCutoff: '09:30',
    resultPublishNotification: true, allowParentTeacherMessaging: true, publicWebsiteEnabled: true,
  },
  status: 'ACTIVE',
  version: 3,
  createdAt: '2025-09-01T08:00:00.000Z',
  updatedAt: '2025-09-10T09:12:00.000Z',
};

const SESSION_ROW = {
  id: 'aaaa1111-2222-4333-8444-555555555555',
  schoolId: '11111111-2222-4333-8444-555555555555',
  name: '2025/2026',
  startDate: '2025-09-08',
  endDate: '2026-07-24',
  isCurrent: true,
  status: 'ACTIVE',
  termCount: 3,
};

const TERM = {
  id: 'bbbb1111-2222-4333-8444-555555555555',
  schoolId: '11111111-2222-4333-8444-555555555555',
  sessionId: 'aaaa1111-2222-4333-8444-555555555555',
  sessionName: '2025/2026',
  name: 'First Term',
  sequence: 1,
  startDate: '2025-09-08',
  endDate: '2025-12-12',
  teachingWeeks: 14,
  isCurrent: true,
  status: 'ACTIVE',
};

const LEVEL = {
  id: 'cccc1111-2222-4333-8444-555555555555',
  schoolId: '11111111-2222-4333-8444-555555555555',
  name: 'JSS 1', code: 'JSS1', sequence: 1,
  gradingSchemeId: null, gradingSchemeName: null, classCount: 2,
};

const CLASS = {
  id: 'dddd1111-2222-4333-8444-555555555555',
  schoolId: '11111111-2222-4333-8444-555555555555',
  levelId: 'cccc1111-2222-4333-8444-555555555555',
  levelName: 'JSS 1',
  name: 'JSS 1 Gold', arm: 'Gold', code: 'JSS1-01',
  capacity: 40, enrolledCount: 0,
  formTeacherIds: ['eeee1111-2222-4333-8444-555555555555'],
  formTeacherNames: ['Funmilayo Adeyemi'],
  roomId: null, isActive: true,
};

const SUBJECT = {
  id: 'ffff1111-2222-4333-8444-555555555555',
  schoolId: '11111111-2222-4333-8444-555555555555',
  name: 'Mathematics', code: 'MTH', category: 'Core', isCore: true,
  levelIds: ['cccc1111-2222-4333-8444-555555555555'],
  levelNames: ['JSS 1'],
  teacherCount: 1, isActive: true, schedule: [],
};

const ROOM = { id: '1a1a1111-2222-4333-8444-555555555555', schoolId: SCHOOL.id, name: 'Block A — Room 1', code: 'A1', capacity: 35, type: 'CLASSROOM' };
const HOUSE = { id: '2b2b1111-2222-4333-8444-555555555555', schoolId: SCHOOL.id, name: 'Blue House', color: '#2563eb', motto: 'Steady and true', captainStudentId: null, captainName: null, memberCount: 0, points: 0 };
const PERIOD = { id: '3c3c1111-2222-4333-8444-555555555555', schoolId: SCHOOL.id, name: 'Period 1', startTime: '08:00', endTime: '08:40', sequence: 1, isBreak: false };

const ROLE = {
  id: '4d4d1111-2222-4333-8444-555555555555',
  schoolId: SCHOOL.id,
  name: 'Teacher', key: 'TEACHER', description: null, isSystem: true,
  permissions: ['academics.read', 'student.read', 'attendance.manage', 'result.enter'],
  memberCount: 12,
};

const AUDIT_PAGE = {
  items: [
    {
      id: '5e5e1111-2222-4333-8444-555555555555',
      schoolId: SCHOOL.id,
      actorUserId: SESSION.user.id,
      actorName: 'Adaeze Okonkwo',
      actorRole: 'SCHOOL_ADMIN',
      action: 'role.permissions_changed',
      entityType: 'Role',
      entityId: ROLE.id,
      entityLabel: 'Teacher',
      before: { permissions: ['academics.read'] },
      after: { permissions: ['academics.read', 'result.enter'] },
      ipAddress: '102.89.0.1',
      userAgent: 'Mozilla/5.0',
      requestId: 'req_01J8Z9',
      severity: 'CRITICAL',
      occurredAt: '2025-09-10T09:12:00.000Z',
    },
  ],
  meta: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
};

const WEBSITE = {
  id: '6f6f1111-2222-4333-8444-555555555555',
  schoolId: SCHOOL.id,
  enabled: true, slug: 'brightfield-academy',
  tagline: 'Knowledge, Character, Service',
  about: 'Brightfield Academy has served Ikoyi families since 2004.',
  mission: null, vision: null, heroImageUrl: null,
  admissionsIntro: null, admissionsOpen: true,
  contactEmail: 'hello@brightfield.edu.ng', contactPhone: '+2348030000001',
  address: '14 Awolowo Road, Ikoyi, Lagos',
  socialLinks: [], testimonials: [], gallery: [],
  createdAt: '2025-09-01T08:00:00.000Z', updatedAt: '2025-09-10T09:12:00.000Z',
};

// ── Endpoint definitions ────────────────────────────────────────────────────
const folders = [
  {
    name: 'Health',
    description: 'Liveness and readiness probes. Outside the versioned prefix and unauthenticated, so a platform health check never tracks an API version or a token.',
    items: [
      {
        name: 'Liveness',
        req: { method: 'GET', path: '/api/health/live', auth: 'none', absolute: true },
        examples: [['200 Alive', 200, ok({ status: 'ok' })]],
      },
      {
        name: 'Readiness',
        req: { method: 'GET', path: '/api/health/ready', auth: 'none', absolute: true },
        examples: [
          ['200 Ready', 200, ok({ status: 'ok', database: 'ok', firebase: 'ok' })],
          ['503 Database unreachable', 503, fail('INTERNAL_ERROR', 'The API is not ready to serve traffic.')],
        ],
      },
    ],
  },
  {
    name: 'Auth',
    description: 'Session establishment and the signed-in user\'s own profile. `GET /auth/session` is the one authenticated route that is not tenant-scoped: a user with no membership must still be able to load a session and be told so.',
    items: [
      {
        name: 'Get session',
        req: { method: 'GET', path: '/auth/session' },
        script: [
          'const res = pm.response.json();',
          'if (res.success && res.data) {',
          '  if (res.data.activeSchoolId) pm.collectionVariables.set("schoolId", res.data.activeSchoolId);',
          '  if (res.data.user) pm.collectionVariables.set("userId", res.data.user.id);',
          '}',
        ],
        examples: [
          ['200 Signed in', 200, ok(SESSION)],
          ['200 No membership yet', 200, ok({ user: { ...SESSION.user, memberships: [] }, activeSchoolId: null })],
          STD[401](),
          STD['401.expired'](),
          ['403 Staff on leave', 403, fail('FORBIDDEN', 'This staff account is on leave and cannot sign in. Contact your school administrator.')],
          STD[429](),
        ],
      },
      {
        name: 'Update my profile',
        req: {
          method: 'PATCH',
          path: '/users/me',
          body: { firstName: 'Adaeze', lastName: 'Okonkwo', phone: '+2348030000009' },
        },
        examples: [
          ['200 Updated', 200, ok(SESSION.user, 'Profile updated')],
          STD[401](),
          STD['403.school'](),
          STD[422]('firstName', 'Please enter your first name.'),
        ],
      },
      {
        name: 'Forgot password',
        req: {
          method: 'POST',
          path: '/auth/forgot-password',
          body: { email: 'ada@brightfield.edu.ng' },
        },
        examples: [
          [
            '200 Link on its way',
            200,
            ok({ expiresInHours: 1 }, 'If that address has an account, a reset link is on its way.'),
          ],
          [
            '200 No such account',
            200,
            ok({ expiresInHours: 1 }, 'If that address has an account, a reset link is on its way.'),
          ],
          STD[422]('email', 'Enter a valid email address.'),
          STD[429](),
        ],
      },
    ],
  },
  {
    name: 'School',
    description: 'Tenant settings and the public prospectus. `PATCH /schools/current` takes the version the client loaded as `If-Match`, so two administrators saving at once cannot silently overwrite one another.',
    items: [
      {
        name: 'Get current school',
        req: { method: 'GET', path: '/schools/current' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data) pm.collectionVariables.set("schoolVersion", res.data.version);'],
        examples: [['200 OK', 200, ok(SCHOOL)], STD[401](), STD[403](), STD[404]('School')],
      },
      {
        name: 'Update current school',
        req: {
          method: 'PATCH', path: '/schools/current',
          body: { name: 'Brightfield Academy', settings: { absenceAlertCutoff: '09:15' } },
          extraHeaders: [{ key: 'If-Match', value: '{{schoolVersion}}', description: 'The version loaded by the client. Omit to skip the concurrency check.' }],
        },
        examples: [
          ['200 Saved', 200, ok(SCHOOL, 'School settings saved')],
          STD[401](), STD[403](), STD[404]('School'), STD['409.version'](),
          STD[422]('settings.absenceAlertCutoff', 'Use a 24-hour time, such as 09:30'),
        ],
      },
      {
        name: 'Get website content',
        req: { method: 'GET', path: '/website' },
        examples: [['200 OK', 200, ok(WEBSITE)], STD[401](), STD[403]()],
      },
      {
        name: 'Update website content',
        req: { method: 'PATCH', path: '/website', body: { enabled: true, tagline: 'Knowledge, Character, Service', admissionsOpen: true } },
        examples: [
          ['200 Updated', 200, ok(WEBSITE, 'Website updated')],
          STD[401](), STD[403](),
          STD[422]('contactEmail', 'Invalid email'),
        ],
      },
      {
        name: 'Public school page',
        req: { method: 'GET', path: '/public/schools/brightfield-academy', auth: 'none' },
        examples: [
          ['200 OK', 200, ok(WEBSITE)],
          ['404 Not published', 404, fail('NOT_FOUND', 'School was not found.')],
        ],
      },
    ],
  },
  {
    name: 'Roles',
    description: 'Permission bundles. Every check in the API is against a permission, never a role name, so a school may invent roles of its own. A permission change is always audited CRITICAL.',
    items: [
      {
        name: 'List roles',
        req: { method: 'GET', path: '/roles' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("roleId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([ROLE])], STD[401](), STD[403]()],
      },
      {
        name: 'Create role',
        req: { method: 'POST', path: '/roles', body: { name: 'Head of Year', description: 'Pastoral lead for a year group', permissions: ['student.read', 'attendance.read', 'discipline.review'] } },
        script: ['const res = pm.response.json();', 'if (res.success && res.data) pm.collectionVariables.set("createdRoleId", res.data.id);'],
        examples: [
          ['201 Created', 201, ok({ ...ROLE, id: '7a7a1111-2222-4333-8444-555555555555', name: 'Head of Year', key: 'head_of_year', isSystem: false, memberCount: 0 }, 'Role created')],
          STD[401](), STD[403](),
          STD[409]('A role with that name already exists.'),
          ['422 Unknown permission', 422, fail('VALIDATION_ERROR', 'Validation failed', [{ field: 'permissions.0', path: 'body.permissions.0', message: "Invalid enum value. Expected 'platform.manage' | ...", code: 'invalid_enum_value' }])],
        ],
      },
      {
        name: 'Update role',
        req: { method: 'PATCH', path: '/roles/{{roleId}}', body: { permissions: ['academics.read', 'student.read', 'result.enter', 'result.approve'] } },
        examples: [
          ['200 Updated', 200, ok(ROLE, 'Role updated')],
          STD[401](), STD[403](), STD[404]('Role'),
          ['422 Built-in rename', 422, fail('VALIDATION_ERROR', 'Built-in roles cannot be renamed.')],
        ],
      },
    ],
  },
  {
    name: 'Audit',
    description: 'Append-only record of who changed what. Rows are never updated or deleted, and carry the actor\'s name and role as they were at the time so an entry still reads correctly after the person leaves.',
    items: [
      {
        name: 'List audit log',
        req: {
          method: 'GET', path: '/audit',
          query: [
            { key: 'page', value: '1' },
            { key: 'pageSize', value: '25' },
            { key: 'severity', value: 'CRITICAL', disabled: true },
            { key: 'action', value: 'role.permissions_changed', disabled: true },
            { key: 'search', value: '', disabled: true },
          ],
        },
        examples: [['200 OK', 200, ok(AUDIT_PAGE)], STD[401](), STD[403](), STD[422]('pageSize', 'Number must be less than or equal to 100')],
      },
    ],
  },
  {
    name: 'Academics — Sessions & Terms',
    description: 'The shape of the academic year. Making a term current moves the whole school into its session, which is what everything scoped by session then reports on.',
    items: [
      {
        name: 'List sessions',
        req: { method: 'GET', path: '/academics/sessions' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("sessionId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([SESSION_ROW])], STD[401](), STD[403]()],
      },
      {
        name: 'Create session',
        req: {
          method: 'POST', path: '/academics/sessions',
          body: {
            name: '2026/2027', startDate: '2026-09-07', endDate: '2027-07-23',
            terms: [
              { name: 'First Term', startDate: '2026-09-07', endDate: '2026-12-11' },
              { name: 'Second Term', startDate: '2027-01-04', endDate: '2027-04-01' },
            ],
          },
        },
        examples: [
          ['201 Created', 201, ok({ ...SESSION_ROW, id: '8b8b1111-2222-4333-8444-555555555555', name: '2026/2027', startDate: '2026-09-07', endDate: '2027-07-23', isCurrent: false, status: 'PLANNED', termCount: 2 }, 'Academic session created')],
          STD[401](), STD[403](),
          STD[409]('A session with that name already exists.'),
          STD[422]('endDate', 'A session cannot end before it starts.'),
        ],
      },
      {
        name: 'Update session',
        req: { method: 'PATCH', path: '/academics/sessions/{{sessionId}}', body: { name: '2025/2026 (revised)' } },
        examples: [
          ['200 Updated', 200, ok(SESSION_ROW, 'Academic session updated')],
          STD[401](), STD[403](), STD[404]('Academic session'),
          STD[422]('endDate', 'A session cannot end before it starts.'),
        ],
      },
      {
        name: 'Delete session',
        req: { method: 'DELETE', path: '/academics/sessions/{{sessionId}}' },
        examples: [
          ['204 Deleted', 204, ''],
          STD[401](), STD[403](), STD[404]('Academic session'),
          STD[409]('This is the current session. Make another session current before deleting it.'),
        ],
      },
      {
        name: 'List terms',
        req: { method: 'GET', path: '/academics/terms', query: [{ key: 'sessionId', value: '{{sessionId}}', disabled: true }] },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("termId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([TERM])], STD[401](), STD[403]()],
      },
      {
        name: 'Create term',
        req: { method: 'POST', path: '/academics/terms', body: { sessionId: '{{sessionId}}', name: 'Third Term', startDate: '2026-04-20', endDate: '2026-07-24' } },
        examples: [
          ['201 Created', 201, ok({ ...TERM, id: '9c9c1111-2222-4333-8444-555555555555', name: 'Third Term', sequence: 3, isCurrent: false, status: 'PLANNED', teachingWeeks: 14 }, 'Term added')],
          STD[401](), STD[403](), STD[404]('Academic session'),
          STD[422]('endDate', 'A term cannot end before it starts.'),
        ],
      },
      {
        name: 'Update term',
        req: { method: 'PATCH', path: '/academics/terms/{{termId}}', body: { endDate: '2025-12-19' } },
        examples: [
          ['200 Updated — teaching weeks recomputed', 200, ok({ ...TERM, endDate: '2025-12-19', teachingWeeks: 15 }, 'Term updated')],
          STD[401](), STD[403](), STD[404]('Term'),
          STD[422]('endDate', 'A term cannot end before it starts.'),
        ],
      },
      {
        name: 'Set current term',
        req: { method: 'POST', path: '/academics/terms/{{termId}}/set-current' },
        examples: [
          ['200 Current term changed', 200, ok(TERM, 'Current term updated')],
          STD[401](), STD[403](), STD[404]('Term'),
        ],
      },
    ],
  },
  {
    name: 'Academics — Levels & Classes',
    description: 'The school\'s own level ladder and its teaching groups. Nothing is hardcoded to one country\'s system. Class and level lists are narrowed to what the caller can act on, so a subject teacher is offered the classes they teach rather than the school\'s forty.',
    items: [
      {
        name: 'List levels',
        req: { method: 'GET', path: '/academics/levels' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("levelId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([LEVEL])], STD[401](), STD[403]()],
      },
      {
        name: 'Create level',
        req: { method: 'POST', path: '/academics/levels', body: { name: 'SSS 2', code: 'SSS2', sequence: 5 } },
        examples: [
          ['201 Created', 201, ok({ ...LEVEL, id: 'a1a1b2b2-2222-4333-8444-555555555555', name: 'SSS 2', code: 'SSS2', sequence: 5, classCount: 0 }, 'Level added')],
          STD[401](), STD[403](),
          STD[409]('A level with that code already exists.'),
          STD[422]('name', 'A level needs a name.'),
        ],
      },
      {
        name: 'Update level',
        req: { method: 'PATCH', path: '/academics/levels/{{levelId}}', body: { name: 'Junior Secondary 1' } },
        examples: [['200 Updated', 200, ok(LEVEL, 'Level updated')], STD[401](), STD[403](), STD[404]('Level'), STD[409]('A level with that code already exists.')],
      },
      {
        name: 'Delete level',
        req: { method: 'DELETE', path: '/academics/levels/{{levelId}}' },
        examples: [
          ['204 Deleted', 204, ''],
          STD[401](), STD[403](), STD[404]('Level'),
          STD[409]('This level still has 2 classes. Move or delete them first.'),
        ],
      },
      {
        name: 'List classes',
        req: {
          method: 'GET', path: '/academics/classes',
          query: [
            { key: 'levelId', value: '{{levelId}}', disabled: true },
            { key: 'includeInactive', value: 'false', disabled: true },
            { key: 'formTeacherOnly', value: 'true', disabled: true, description: 'Narrows to classes the caller is form teacher of — the attendance register\'s picker.' },
          ],
        },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("classId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([CLASS])], STD[401](), STD[403]()],
      },
      {
        name: 'Get class',
        req: { method: 'GET', path: '/academics/classes/{{classId}}' },
        examples: [
          ['200 OK', 200, ok(CLASS)],
          STD[401](), STD[403](),
          ['404 Not found or out of scope', 404, fail('NOT_FOUND', 'Class was not found.')],
        ],
      },
      {
        name: 'Create class',
        req: { method: 'POST', path: '/academics/classes', body: { name: 'JSS 1 Bronze', levelId: '{{levelId}}', arm: 'Bronze', capacity: 40, formTeacherIds: [] } },
        examples: [
          ['201 Created', 201, ok({ ...CLASS, id: 'b2b2c3c3-2222-4333-8444-555555555555', name: 'JSS 1 Bronze', arm: 'Bronze', code: 'JSS1-03', formTeacherIds: [], formTeacherNames: [] }, 'Class added')],
          STD[401](), STD[403](), STD[404]('Level'),
          STD[422]('levelId', 'A class needs a level.'),
        ],
      },
      {
        name: 'Update class',
        req: { method: 'PATCH', path: '/academics/classes/{{classId}}', body: { capacity: 45, formTeacherIds: ['eeee1111-2222-4333-8444-555555555555'] } },
        examples: [['200 Updated', 200, ok({ ...CLASS, capacity: 45 }, 'Class updated')], STD[401](), STD[403](), STD[404]('Class')],
      },
      {
        name: 'Delete class',
        req: { method: 'DELETE', path: '/academics/classes/{{classId}}' },
        examples: [
          ['204 Deleted', 204, ''],
          STD[401](), STD[403](), STD[404]('Class'),
          STD[409]('This class still has 31 pupils in it. Move them first.'),
        ],
      },
    ],
  },
  {
    name: 'Academics — Subjects, Rooms, Houses, Periods',
    description: 'What the school teaches with. Asking for a class\'s subjects answers with the subjects actually paired with that class, not every subject at its level the caller happens to teach somewhere else.',
    items: [
      {
        name: 'List subjects',
        req: {
          method: 'GET', path: '/academics/subjects',
          query: [
            { key: 'levelId', value: '{{levelId}}', disabled: true },
            { key: 'classId', value: '{{classId}}', disabled: true, description: 'Resolves to the class\'s level, and narrows to verified class/subject pairs.' },
          ],
        },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("subjectId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([SUBJECT])], STD[401](), STD[403]()],
      },
      {
        name: 'Create subject',
        req: { method: 'POST', path: '/academics/subjects', body: { name: 'Further Mathematics', code: 'FMTH', category: 'Science', isCore: false, levelIds: ['{{levelId}}'] } },
        examples: [
          ['201 Created', 201, ok({ ...SUBJECT, id: 'c3c3d4d4-2222-4333-8444-555555555555', name: 'Further Mathematics', code: 'FMTH', category: 'Science', isCore: false, teacherCount: 0 }, 'Subject added')],
          STD[401](), STD[403](),
          STD[409]('A subject with that code already exists.'),
          STD[422]('code', 'A subject needs a code.'),
        ],
      },
      {
        name: 'Update subject',
        req: { method: 'PATCH', path: '/academics/subjects/{{subjectId}}', body: { category: 'Core', levelIds: ['{{levelId}}'] } },
        examples: [['200 Updated', 200, ok(SUBJECT, 'Subject updated')], STD[401](), STD[403](), STD[404]('Subject'), STD[409]('A subject with that code already exists.')],
      },
      {
        name: 'Delete subject',
        req: { method: 'DELETE', path: '/academics/subjects/{{subjectId}}' },
        examples: [['204 Deactivated', 204, ''], STD[401](), STD[403](), STD[404]('Subject')],
      },
      {
        name: 'List rooms',
        req: { method: 'GET', path: '/academics/rooms' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("roomId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([ROOM])], STD[401](), STD[403]()],
      },
      {
        name: 'Create room',
        req: { method: 'POST', path: '/academics/rooms', body: { name: 'Computer Laboratory', code: 'LAB2', capacity: 25, type: 'LABORATORY' } },
        examples: [
          ['201 Created', 201, ok({ ...ROOM, id: 'd4d4e5e5-2222-4333-8444-555555555555', name: 'Computer Laboratory', code: 'LAB2', capacity: 25, type: 'LABORATORY' }, 'Room added')],
          STD[401](), STD[403](), STD[409]('A room with that code already exists.'), STD[422]('name', 'A room needs a name.'),
        ],
      },
      {
        name: 'Update room',
        req: { method: 'PATCH', path: '/academics/rooms/{{roomId}}', body: { capacity: 40 } },
        examples: [['200 Updated', 200, ok(ROOM, 'Room updated')], STD[401](), STD[403](), STD[404]('Room')],
      },
      {
        name: 'List houses',
        req: { method: 'GET', path: '/academics/houses' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("houseId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([HOUSE])], STD[401](), STD[403]()],
      },
      {
        name: 'Create house',
        req: { method: 'POST', path: '/academics/houses', body: { name: 'Red House', color: '#dc2626', motto: 'Bold and bright' } },
        examples: [
          ['201 Created', 201, ok({ ...HOUSE, id: 'e5e5f6f6-2222-4333-8444-555555555555', name: 'Red House', color: '#dc2626', motto: 'Bold and bright' }, 'House added')],
          STD[401](), STD[403](), STD[409]('A house with that name already exists.'),
          STD[422]('color', 'Use a six-digit hex colour.'),
        ],
      },
      {
        name: 'Update house',
        req: { method: 'PATCH', path: '/academics/houses/{{houseId}}', body: { motto: 'Steady, true, unbroken' } },
        examples: [['200 Updated', 200, ok(HOUSE, 'House updated')], STD[401](), STD[403](), STD[404]('House')],
      },
      {
        name: 'List periods',
        req: { method: 'GET', path: '/academics/periods' },
        script: ['const res = pm.response.json();', 'if (res.success && res.data && res.data.length) pm.collectionVariables.set("periodId", res.data[0].id);'],
        examples: [['200 OK', 200, ok([PERIOD])], STD[401](), STD[403]()],
      },
      {
        name: 'Create period',
        req: { method: 'POST', path: '/academics/periods', body: { name: 'Period 5', startTime: '11:00', endTime: '11:40', isBreak: false } },
        examples: [
          ['201 Created', 201, ok({ ...PERIOD, id: 'f6f6a7a7-2222-4333-8444-555555555555', name: 'Period 5', startTime: '11:00', endTime: '11:40', sequence: 6 }, 'Period added')],
          STD[401](), STD[403](),
          STD[422]('endTime', 'A period cannot end before it starts.'),
        ],
      },
      {
        name: 'Update period',
        req: { method: 'PATCH', path: '/academics/periods/{{periodId}}', body: { endTime: '08:45' } },
        examples: [
          ['200 Updated', 200, ok({ ...PERIOD, endTime: '08:45' }, 'Period updated')],
          STD[401](), STD[403](), STD[404]('Period'),
          STD[422]('endTime', 'A period cannot end before it starts.'),
        ],
      },
      {
        name: 'Delete period',
        req: { method: 'DELETE', path: '/academics/periods/{{periodId}}' },
        examples: [['204 Deleted', 204, ''], STD[401](), STD[403](), STD[404]('Period')],
      },
    ],
  },
];

// ── Assemble ────────────────────────────────────────────────────────────────
function buildItem(def) {
  const { method, path: p, body, query, auth, extraHeaders, absolute } = def.req;
  const req = {
    method,
    header: [
      { key: 'Accept', value: 'application/json' },
      ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : []),
      ...(absolute || auth === 'none' ? [] : [{ key: 'X-School-Id', value: '{{schoolId}}', description: 'Which of the caller\'s memberships to act under. Validated against the session; a school they have no membership in is refused.' }]),
      ...(extraHeaders ?? []),
    ],
    url: absolute
      ? { raw: `{{host}}${p}`, host: ['{{host}}'], path: p.replace(/^\//, '').split('/') }
      : url(p, query),
  };
  if (body) req.body = { mode: 'raw', raw: json(body), options: { raw: { language: 'json' } } };
  if (auth === 'none') req.auth = { type: 'noauth' };

  const item = {
    name: def.name,
    request: req,
    response: def.examples.map(([name, code, bodyStr]) =>
      example(name, code, STATUS_TEXT[code] ?? 'Service Unavailable', req, bodyStr),
    ),
  };

  if (def.script) {
    item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: def.script } }];
  }
  return item;
}

const collection = {
  info: {
    _postman_id: 'b2d6f1a4-9c3e-4e77-9f10-3a5c7e9d1b40',
    name: 'Scholaris API — v1',
    description:
      'Scholaris — multi-tenant school management API.\n\n' +
      'Phase 1 (foundation): tenancy, identity, RBAC, audit, school settings and the academic structure. ' +
      'Later phases add students, guardians, attendance, results, finance and the rest.\n\n' +
      '**Envelope.** Every response uses the same shape:\n\n' +
      '- Success: `{ "success": true, "data": ..., "message"?: ... }`\n' +
      '- Failure: `{ "success": false, "error": { "code", "message", "details"? } }`\n\n' +
      '**Getting started.** Set `baseUrl`, then run *Auth → Get session* first: its post-response script ' +
      'captures `schoolId` and `userId` into collection variables, and every later request uses them.\n\n' +
      '**Tokens.** With `DEV_AUTH_ENABLED=true` on the server, set `accessToken` to `mock-token:<email>` ' +
      '(for example `mock-token:admin@brightfield.edu.ng`) to sign in as a seeded user with no Firebase ' +
      'project. In production this is a Firebase ID token, and the development form is refused.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          '// Every request carries a correlation id. The API echoes it back as',
          '// X-Request-Id and writes it into the audit row, so a failed action can',
          '// be traced from a screenshot to the log line.',
          "pm.request.headers.upsert({ key: 'X-Request-Id', value: 'pm_' + Date.now().toString(36) });",
        ],
      },
    },
  ],
  variable: [
    { key: 'host', value: 'http://localhost:4000', type: 'string' },
    { key: 'baseUrl', value: 'http://localhost:4000/api/v1', type: 'string' },
    { key: 'accessToken', value: 'mock-token:admin@brightfield.edu.ng', type: 'string' },
    { key: 'schoolId', value: '', type: 'string' },
    { key: 'userId', value: '', type: 'string' },
    { key: 'schoolVersion', value: '', type: 'string' },
    { key: 'roleId', value: '', type: 'string' },
    { key: 'createdRoleId', value: '', type: 'string' },
    { key: 'sessionId', value: '', type: 'string' },
    { key: 'termId', value: '', type: 'string' },
    { key: 'levelId', value: '', type: 'string' },
    { key: 'classId', value: '', type: 'string' },
    { key: 'subjectId', value: '', type: 'string' },
    { key: 'roomId', value: '', type: 'string' },
    { key: 'houseId', value: '', type: 'string' },
    { key: 'periodId', value: '', type: 'string' },
  ],
  item: folders.map((f) => ({
    name: f.name,
    description: f.description,
    item: f.items.map(buildItem),
  })),
};

const environment = {
  id: 'c7e2f3a1-5b48-4d20-8e6f-1a2b3c4d5e6f',
  name: 'Scholaris — Local',
  values: [
    { key: 'host', value: 'http://localhost:4000', type: 'default', enabled: true },
    { key: 'baseUrl', value: 'http://localhost:4000/api/v1', type: 'default', enabled: true },
    { key: 'accessToken', value: 'mock-token:admin@brightfield.edu.ng', type: 'secret', enabled: true },
    { key: 'schoolId', value: '', type: 'default', enabled: true },
    { key: 'userId', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

writeFileSync(path.join(OUT_DIR, 'Scholaris.postman_collection.json'), json(collection) + '\n');
writeFileSync(path.join(OUT_DIR, 'Scholaris.postman_environment.json'), json(environment) + '\n');

const endpoints = folders.reduce((n, f) => n + f.items.length, 0);
const examples = folders.reduce((n, f) => n + f.items.reduce((m, i) => m + i.examples.length, 0), 0);
console.log(`Wrote collection: ${folders.length} folders, ${endpoints} requests, ${examples} saved examples.`);
