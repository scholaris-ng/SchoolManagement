/** Name pools for the development seed — plausible Nigerian school registers. */

export const MALE_FIRST_NAMES = [
  'Chidi', 'Emeka', 'Tunde', 'Ibrahim', 'Segun', 'Obinna', 'Kelechi', 'Yusuf', 'Damilola',
  'Chukwuemeka', 'Adewale', 'Ifeanyi', 'Musa', 'Olumide', 'Nnamdi', 'Babajide', 'Uche',
  'Abdulrahman', 'Tobenna', 'Ekene', 'Ayodeji', 'Chinedu', 'Sadiq', 'Femi', 'Ugochukwu',
];

export const FEMALE_FIRST_NAMES = [
  'Adaeze', 'Chioma', 'Funmilayo', 'Aisha', 'Ngozi', 'Temitope', 'Amaka', 'Halima', 'Bukola',
  'Ifeoma', 'Yewande', 'Zainab', 'Chinyere', 'Folake', 'Nneka', 'Oluwaseun', 'Adanna',
  'Fatima', 'Chidinma', 'Bisola', 'Ozioma', 'Ronke', 'Hauwa', 'Ebele', 'Simisola',
];

export const SURNAMES = [
  'Okonkwo', 'Adeyemi', 'Eze', 'Bello', 'Nwosu', 'Balogun', 'Okafor', 'Sule', 'Oyelaran',
  'Chukwu', 'Ogunleye', 'Abubakar', 'Ibeh', 'Adebayo', 'Nnaji', 'Lawal', 'Uzoma', 'Danjuma',
  'Olawale', 'Anyanwu', 'Mohammed', 'Ojo', 'Emenike', 'Salami', 'Ekwueme',
];

export const MIDDLE_NAMES = [
  'Chinaza', 'Oluwaseyi', 'Amarachi', 'Ayomide', 'Chukwudi', 'Toluwani', 'Somtochukwu',
  'Adaobi', 'Ifeanyichukwu', 'Oluwatobi', '', '', '',
];

export const STATES = [
  'Lagos', 'Anambra', 'Kano', 'Oyo', 'Rivers', 'Enugu', 'Kaduna', 'Delta', 'Ogun', 'Imo',
];

export const OCCUPATIONS = [
  'Trader', 'Civil servant', 'Teacher', 'Engineer', 'Nurse', 'Accountant', 'Banker',
  'Business owner', 'Doctor', 'Lawyer', 'Farmer', 'Software developer',
];

export const SUBJECT_CATALOG = [
  { name: 'Mathematics', code: 'MTH', core: true },
  { name: 'English Language', code: 'ENG', core: true },
  { name: 'Basic Science', code: 'BSC', core: true },
  { name: 'Biology', code: 'BIO', core: false },
  { name: 'Chemistry', code: 'CHM', core: false },
  { name: 'Physics', code: 'PHY', core: false },
  { name: 'Civic Education', code: 'CIV', core: true },
  { name: 'Social Studies', code: 'SOS', core: false },
  { name: 'Agricultural Science', code: 'AGR', core: false },
  { name: 'Computer Studies', code: 'CMP', core: true },
  { name: 'Business Studies', code: 'BUS', core: false },
  { name: 'Christian Religious Studies', code: 'CRS', core: false },
  { name: 'Home Economics', code: 'HEC', core: false },
  { name: 'Fine Art', code: 'ART', core: false },
  { name: 'Physical & Health Education', code: 'PHE', core: false },
];

export const BEHAVIOUR_TRAITS = [
  { name: 'Punctuality', category: 'AFFECTIVE' as const },
  { name: 'Neatness', category: 'AFFECTIVE' as const },
  { name: 'Honesty', category: 'AFFECTIVE' as const },
  { name: 'Politeness', category: 'AFFECTIVE' as const },
  { name: 'Attentiveness in class', category: 'AFFECTIVE' as const },
  { name: 'Handwriting', category: 'PSYCHOMOTOR' as const },
  { name: 'Sports', category: 'PSYCHOMOTOR' as const },
  { name: 'Musical skills', category: 'PSYCHOMOTOR' as const },
  { name: 'Leadership', category: 'SKILL' as const },
  { name: 'Teamwork', category: 'SKILL' as const },
];
