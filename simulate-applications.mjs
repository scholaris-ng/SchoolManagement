// Submits one public admission application per guardian email against a
// running Scholaris API, the same way the website's registration form does
// (POST /public/schools/:slug/applications). A guardian may apply for more
// than one child in the same submission — each `children` entry becomes its
// own applicant on the same application, sharing one contact. Ad-hoc testing
// script — not part of the app itself.
//
// Usage: node simulate-applications.mjs

const API_BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const SLUG = process.env.SCHOOL_SLUG ?? 'abschool';

const GUARDIANS = [
  {
    email: 'saser32600@bowlfuel.com',
    guardian: {
      firstName: 'Grace',
      lastName: 'Umeh',
      relationship: 'MOTHER',
      occupation: 'Trader',
      address: '14 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
    },
    children: [
      {
        firstName: 'Ada',
        lastName: 'Umeh',
        gender: 'FEMALE',
        dateOfBirth: '2019-05-12',
        className: 'Primary 2',
        bloodGroup: 'O+',
        medicalNotes: 'Mild asthma — carries an inhaler.',
        previousSchool: 'Sunrise Montessori',
        previousClass: 'Primary 1',
        stateOfOrigin: 'Anambra',
      },
      {
        firstName: 'Chukwuemeka',
        lastName: 'Umeh',
        gender: 'MALE',
        dateOfBirth: '2022-11-03',
        className: 'Nursery 1',
        bloodGroup: 'A+',
        medicalNotes: '',
        previousSchool: '',
        previousClass: '',
        stateOfOrigin: 'Anambra',
      },
    ],
  },
  {
    email: 'xahiwel361@crybio.com',
    guardian: {
      firstName: 'Chinedu',
      lastName: 'Okoro',
      relationship: 'FATHER',
      occupation: 'Civil servant',
      address: '22 Aso Drive',
      city: 'Abuja',
      state: 'FCT',
    },
    children: [
      {
        firstName: 'Ifeoma',
        lastName: 'Okoro',
        gender: 'FEMALE',
        dateOfBirth: '2020-02-18',
        className: 'Primary 1',
        bloodGroup: 'B+',
        medicalNotes: '',
        previousSchool: '',
        previousClass: '',
        stateOfOrigin: 'Imo',
      },
      {
        firstName: 'Obinna',
        lastName: 'Okoro',
        gender: 'MALE',
        dateOfBirth: '2015-07-22',
        className: 'Junior Secondary 2',
        bloodGroup: 'O-',
        medicalNotes: 'Allergic to peanuts.',
        previousSchool: 'Capital City College',
        previousClass: 'JSS 1',
        stateOfOrigin: 'Imo',
      },
      {
        firstName: 'Chidera',
        lastName: 'Okoro',
        gender: 'FEMALE',
        dateOfBirth: '2012-09-30',
        className: 'Senior Secondary 1',
        bloodGroup: 'AB+',
        medicalNotes: '',
        previousSchool: 'Capital City College',
        previousClass: 'JSS 3',
        stateOfOrigin: 'Imo',
      },
    ],
  },
  {
    email: 'panohog351@crybio.com',
    guardian: {
      firstName: 'Aisha',
      lastName: 'Bello',
      relationship: 'MOTHER',
      occupation: 'Nurse',
      address: '5 Zaria Road',
      city: 'Kano',
      state: 'Kano',
    },
    children: [
      {
        firstName: 'Fatima',
        lastName: 'Bello',
        gender: 'FEMALE',
        dateOfBirth: '2014-04-09',
        className: 'Junior Secondary 3',
        bloodGroup: 'A-',
        medicalNotes: '',
        previousSchool: 'Kano International School',
        previousClass: 'JSS 2',
        stateOfOrigin: 'Kano',
      },
    ],
  },
  {
    email: 'bocaw10695@crybio.com',
    guardian: {
      firstName: 'Peter',
      lastName: 'Effiong',
      relationship: 'FATHER',
      occupation: 'Engineer',
      address: '9 Aba Road',
      city: 'Port Harcourt',
      state: 'Rivers',
    },
    children: [
      {
        firstName: 'Daniel',
        lastName: 'Effiong',
        gender: 'MALE',
        dateOfBirth: '2021-08-15',
        className: 'Nursery 3',
        bloodGroup: 'O+',
        medicalNotes: '',
        previousSchool: '',
        previousClass: '',
        stateOfOrigin: 'Akwa Ibom',
      },
      {
        firstName: 'Grace',
        lastName: 'Effiong',
        gender: 'FEMALE',
        dateOfBirth: '2018-01-27',
        className: 'Primary 3',
        bloodGroup: 'B-',
        medicalNotes: 'Wears glasses for reading.',
        previousSchool: 'Bright Stars Academy',
        previousClass: 'Primary 2',
        stateOfOrigin: 'Akwa Ibom',
      },
      {
        firstName: 'Samuel',
        lastName: 'Effiong',
        gender: 'MALE',
        dateOfBirth: '2016-06-11',
        className: 'Junior Secondary 1',
        bloodGroup: 'AB-',
        medicalNotes: '',
        previousSchool: 'Bright Stars Academy',
        previousClass: 'Primary 6',
        stateOfOrigin: 'Akwa Ibom',
      },
    ],
  },
  {
    email: 'wacah77617@bowlfuel.com',
    guardian: {
      firstName: 'Ronke',
      lastName: 'Adebayo',
      relationship: 'MOTHER',
      occupation: 'Teacher',
      address: '3 Ring Road',
      city: 'Ibadan',
      state: 'Oyo',
    },
    children: [
      {
        firstName: 'Tolu',
        lastName: 'Adebayo',
        gender: 'MALE',
        dateOfBirth: '2011-03-05',
        className: 'Senior Secondary 2',
        bloodGroup: 'O+',
        medicalNotes: '',
        previousSchool: 'Ibadan Grammar School',
        previousClass: 'SS 1',
        stateOfOrigin: 'Oyo',
      },
      {
        firstName: 'Bisi',
        lastName: 'Adebayo',
        gender: 'FEMALE',
        dateOfBirth: '2020-10-19',
        className: 'Primary 1',
        bloodGroup: 'A+',
        medicalNotes: '',
        previousSchool: '',
        previousClass: '',
        stateOfOrigin: 'Oyo',
      },
    ],
  },
];

function randomNgPhone() {
  const n = String(Math.floor(70000000 + Math.random() * 29999999));
  return `+234${n}`;
}

async function fetchOptions() {
  const res = await fetch(`${API_BASE}/public/schools/${SLUG}/admissions`);
  if (!res.ok) throw new Error(`Failed to load admission options: ${res.status}`);
  const body = await res.json();
  return body.data;
}

function buildApplicant(options, guardian, child) {
  const schoolClass = options.classes.find((c) => c.name === child.className);
  if (!schoolClass) {
    throw new Error(`No class named "${child.className}" is published for this school.`);
  }

  return {
    firstName: child.firstName,
    lastName: child.lastName,
    gender: child.gender,
    dateOfBirth: child.dateOfBirth,
    classId: schoolClass.id,
    bloodGroup: child.bloodGroup ?? '',
    medicalNotes: child.medicalNotes ?? '',
    previousSchool: child.previousSchool ?? '',
    previousClass: child.previousClass ?? '',
    nationality: 'Nigeria',
    stateOfOrigin: child.stateOfOrigin ?? '',
    // A child applying through a guardian is assumed to live with them,
    // unless the dummy data says otherwise.
    address: child.address ?? guardian.address ?? '',
    city: child.city ?? guardian.city ?? '',
    state: child.state ?? guardian.state ?? '',
  };
}

async function submit(options, entry) {
  const session = options.sessions.find((s) => s.isCurrent) ?? options.sessions[0];
  if (!session) throw new Error('No academic session is published for this school.');

  const payload = {
    applicantType: 'GUARDIAN',
    sessionId: session.id,
    applicants: entry.children.map((child) => buildApplicant(options, entry.guardian, child)),
    contacts: [
      {
        firstName: entry.guardian.firstName,
        lastName: entry.guardian.lastName,
        relationship: entry.guardian.relationship,
        email: entry.email,
        phone: randomNgPhone(),
        occupation: entry.guardian.occupation ?? '',
        address: entry.guardian.address ?? '',
        city: entry.guardian.city ?? '',
        state: entry.guardian.state ?? '',
        isPrimaryContact: true,
      },
    ],
    consentGiven: true,
  };

  const res = await fetch(`${API_BASE}/public/schools/${SLUG}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return body.data;
}

async function main() {
  const options = await fetchOptions();
  if (!options.open) {
    throw new Error('This school is not currently open to applications.');
  }

  for (const entry of GUARDIANS) {
    try {
      const receipt = await submit(options, entry);
      console.log(`OK  ${entry.email}`);
      for (const app of receipt.applications) {
        console.log(`      -> ${app.applicationNo}  ${app.applicantName}  (${app.className})`);
      }
    } catch (error) {
      console.error(`FAIL ${entry.email} -> ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
