import type { SiteContent } from './site-content';

/**
 * AB.10 Schools — the shipped default content for the public site.
 *
 * Photographs live in `public/site/` and are the school's own. Anything a
 * school will realistically want to change lives in this object rather than in
 * a component, so wiring it to the Website settings screen later is a data
 * change, not a rewrite.
 *
 * TODO(content): `contact.email` is a placeholder — the live site obfuscates
 * its address, so confirm it with the school before launch.
 */
export const defaultContent: SiteContent = {
  brand: {
    name: 'AB.10 Schools',
    shortName: 'AB.10',
    legalName: 'AB.10 Schools, Lagos',
    motto: 'Knowledge, Godliness & Greatness',
    tagline: "God's establishment for raising children",
    crestUrl: '/site/logo.png',
    colors: {
      brand: '#16307A',
      brandDark: '#0C1B49',
      brandSoft: '#EEF2FC',
      accent: '#C62031',
      gold: '#E0A526',
    },
  },

  hero: {
    slides: [
      {
        eyebrow: 'Creche · Nursery · Primary · High School',
        title: 'Where able, brilliant children become worthy champions',
        body: 'A Christian co-educational school in Ifako-Ijaiye, Lagos, teaching the Nigerian and British curricula since 2014.',
        image: { src: '/site/carousel-7.jpeg', alt: 'AB.10 pupils singing at morning assembly' },
      },
      {
        eyebrow: 'Academic excellence',
        title: 'Curiosity in the classroom, confidence in the laboratory',
        body: 'Small classes, specialist teachers and fully equipped science, ICT and language laboratories from Year 7 upwards.',
        image: { src: '/site/carousel-5.jpeg', alt: 'High school students working with a microscope' },
      },
      {
        eyebrow: 'Character and faith',
        title: 'Raising knowledgeable and Godly leaders',
        body: 'Mentoring, weekly fellowship and a pastoral system that knows every child by name.',
        image: { src: '/site/carousel-1.jpeg', alt: 'Pupils at an AB.10 Schools graduation ceremony' },
      },
    ],
    primaryCta: { label: 'Apply for admission', href: 'admissions' },
    secondaryCta: { label: 'Book a school tour', href: 'contact' },
    stats: [
      { value: '2014', label: 'Founded in Lagos' },
      { value: '4', label: 'Schools on one campus' },
      { value: '2', label: 'Curricula: Nigerian & British' },
      { value: '9', label: 'Examination boards prepared for' },
    ],
  },

  welcome: {
    eyebrow: 'Welcome to AB.10',
    title: 'A school built around the child, not the timetable',
    body: [
      'AB.10 Schools opened on 13 January 2014 as a Christian co-educational institution with a single purpose: to raise children who are academically outstanding and morally upright. The High School followed on 9 September 2019.',
      'We believe every learner carries potential greater than any obstacle in their way. Our work is to find it, name it and train it — through smart teaching, honest discipline and a partnership with parents that lasts the whole journey from creche to pre-university.',
    ],
    signatory: {
      name: 'Pastor (Mrs) Olayinka Akinoso',
      role: 'Chief Executive Officer',
      photo: { src: '/site/ab10-school-ceo.jpg', alt: 'Pastor (Mrs) Olayinka Akinoso' },
    },
    images: [
      { src: '/site/carousel-9.jpeg', alt: 'Students in the AB.10 science laboratory' },
      { src: '/site/ab10-school-computing.jpg', alt: 'Pupils in the ICT laboratory' },
    ],
  },

  about: {
    foundedOn: '13 January 2014',
    history: [
      'AB.10 Schools was established on 13 January 2014 by Dr. Olukunle Akinoso and Pastor (Mrs) Olayinka Akinoso, who set out to build a school where academic ambition and Godly character were taught with equal seriousness.',
      'What began as a creche, nursery and primary school on Idowu Street has grown into a full campus. The High School admitted its first cohort on 9 September 2019, and the school now prepares learners from their earliest years through to university entrance.',
      'Today AB.10 serves families across Ifako-Ijaiye, Agege and the wider College Road corridor, teaching a broad-based Nigerian and British curriculum and entering candidates for WASSCE, NECO, UTME and Cambridge IGCSE.',
    ],
    vision:
      'To raise knowledgeable and Godly leaders who are determined to make positive national and global impacts.',
    mission:
      'To achieve academic and moral excellence, through smart and hard work, for the intellectual, spiritual and social development of learners.',
    philosophy:
      'We believe that all learners have inherent potential greater than any obstacle to their success. At AB.10 Schools, we train worthy champions.',
    aspiration:
      'To nurture an educational system that holds high academic and moral standards, inculcates Godliness in a generation, and — in partnership with parents — offers children a stepping stone to a prosperous future.',
    acronym: [
      {
        letter: 'A',
        word: 'Able',
        meaning: 'Confident learners who can be trusted with responsibility.',
      },
      { letter: 'B', word: 'Brilliant', meaning: 'Minds trained to question, reason and solve.' },
      {
        letter: 'T',
        word: 'Top-Class',
        meaning: 'Standards that hold whether anyone is watching or not.',
      },
      {
        letter: 'E',
        word: 'Enviable Scholars',
        meaning: 'Results that open doors at home and abroad.',
      },
      {
        letter: 'N',
        word: 'Nurtured in Godly Character',
        meaning: 'Faith lived out in conduct, not recited.',
      },
    ],
    milestones: [
      {
        year: '2014',
        title: 'AB.10 Schools opens',
        description: 'Creche, nursery and primary sections admit their first pupils on 13 January.',
      },
      {
        year: '2017',
        title: 'Campus expansion',
        description: 'Purpose-built science, ICT and music rooms are added on Idowu Street.',
      },
      {
        year: '2019',
        title: 'High School founded',
        description: 'The secondary section opens on 9 September with a British-Nigerian curriculum.',
      },
      {
        year: '2023',
        title: 'Pre-university programme',
        description: 'IJMB and JUPEB preparation is introduced alongside SAT and TOEFL coaching.',
      },
    ],
    leadership: [
      {
        name: 'Pastor (Mrs) Olayinka Akinoso',
        role: 'Chief Executive Officer',
        photo: { src: '/site/ab10-school-ceo.jpg', alt: 'Pastor (Mrs) Olayinka Akinoso' },
        bio: 'Co-founder of AB.10 Schools and the driving force behind its character and faith formation programme.',
      },
      {
        name: 'Mr Tosin Fabiyi',
        role: 'Principal, High School',
        photo: { src: '/site/ab10-schools-headmaster.png', alt: 'Mr Tosin Fabiyi' },
        bio: 'Leads the secondary school, its examination preparation and the pre-university programme.',
      },
      {
        name: 'Mrs Isong Ekaette',
        role: 'Headmistress, Nursery & Primary',
        photo: { src: '/site/ab10-school-headmistress.jpeg', alt: 'Mrs Isong Ekaette' },
        bio: 'Responsible for early years and primary teaching, pastoral care and parent partnership.',
      },
    ],
  },

  values: [
    {
      name: 'Godliness',
      description:
        'Faith is taught, modelled and lived — in assembly, in class and in how we treat one another.',
      icon: 'church',
    },
    {
      name: 'Integrity',
      description: 'We hold the same standard when no one is watching. Honesty is not negotiable here.',
      icon: 'shield',
    },
    {
      name: 'Teamwork',
      description:
        'Children learn to carry one another. Staff and parents work as one body around each learner.',
      icon: 'handshake',
    },
    {
      name: 'Faith',
      description:
        'Inner strength that carries a child through examinations, setbacks and the years after school.',
      icon: 'heart',
    },
    {
      name: 'Discipline',
      description: 'Structure, routine and correction given in love, not in rage.',
      icon: 'target',
    },
    {
      name: 'Excellence',
      description: 'Smart work and hard work together. Good enough is never the finish line.',
      icon: 'trophy',
    },
  ],

  programmes: [
    {
      slug: 'creche-and-after-school',
      name: 'Creche & After-School',
      ageRange: '3 months – 2 years',
      summary:
        'A warm, secure first step away from home, with trained caregivers, structured play and full after-school care for working parents.',
      image: { src: '/site/carousel-3.jpeg', alt: 'Nursery children at their graduation ceremony' },
      highlights: [
        'Low child-to-carer ratio',
        'Structured play and early language',
        'After-school care until 6pm',
        'Daily report to every parent',
      ],
      overview:
        'Our creche is built for the youngest members of the AB.10 family. Rooms are bright, safe and supervised at all times, and every day follows a rhythm of feeding, rest, sensory play and gentle early language work. The after-school service extends the same care into the evening for parents whose working day runs longer than the school day.',
      curriculum: [
        'Sensory and motor development',
        'Early language and listening',
        'Social play and sharing',
        'Songs, rhymes and Bible stories',
        'Toilet training and self-help skills',
      ],
      dayInTheLife: [
        { time: '7:30am', activity: 'Arrival, health check and free play' },
        { time: '9:00am', activity: 'Circle time — songs, rhymes and stories' },
        { time: '10:30am', activity: 'Snack, then sensory and motor activities' },
        { time: '12:30pm', activity: 'Lunch and rest period' },
        { time: '3:00pm', activity: 'Outdoor play and creative activities' },
        { time: '4:00pm', activity: 'After-school care begins' },
      ],
    },
    {
      slug: 'nursery-and-primary',
      name: 'Nursery & Primary School',
      ageRange: '2 – 11 years',
      summary:
        'Where reading, number and character are built. Phonics-led literacy, hands-on numeracy and a class teacher who knows every child.',
      image: { src: '/site/carousel-2.jpeg', alt: 'Primary pupils reading together in class' },
      highlights: [
        'Phonics-led reading programme',
        'French, music and ICT from Nursery',
        'Weekly assessment sent home',
        'Annual graduation and prize giving',
      ],
      overview:
        'The Nursery and Primary School is where the habits of a scholar are formed. Children learn to read through a structured phonics programme, to reason through concrete and then abstract numeracy, and to work with others through project and club activity. Class sizes are kept small so that a teacher can track every child rather than the class average.',
      curriculum: [
        'English language and literacy',
        'Mathematics and problem solving',
        'Basic science and technology',
        'Social studies and civic education',
        'French and computer studies',
        'Christian religious studies',
        'Music, art and physical education',
      ],
      dayInTheLife: [
        { time: '7:45am', activity: 'Assembly — anthem, prayer and notices' },
        { time: '8:15am', activity: 'Core lessons: English and Mathematics' },
        { time: '10:30am', activity: 'Break and supervised play' },
        { time: '11:00am', activity: 'Science, social studies and French' },
        { time: '1:00pm', activity: 'Lunch' },
        { time: '2:00pm', activity: 'Clubs, music, ICT and games' },
        { time: '3:00pm', activity: 'Close of day / after-school care' },
      ],
    },
    {
      slug: 'high-school',
      name: 'High School',
      ageRange: '11 – 18 years',
      summary:
        'Junior and senior secondary with specialist teaching, laboratory science, trade subjects and full examination preparation.',
      image: { src: '/site/carousel-5.jpeg', alt: 'High school students in the science laboratory' },
      highlights: [
        'WASSCE, NECO and UTME preparation',
        'Cambridge IGCSE pathway',
        'AutoCAD and trade subjects',
        'Boarding and day places',
      ],
      overview:
        'The High School opened in September 2019 and takes learners from Junior Secondary through to university entrance. Teaching is by subject specialists, science is taught in the laboratory rather than from the board, and every senior student is assigned a mentor who follows their progress through the examination years. Boarding places are available for families who need them.',
      curriculum: [
        'Sciences: biology, chemistry, physics, further mathematics',
        'Arts: literature, government, history, CRS',
        'Social sciences: economics, commerce, accounting',
        'Computer studies, AutoCAD and data processing',
        'French and trade subjects',
        'Music and creative arts',
      ],
      dayInTheLife: [
        { time: '7:30am', activity: 'Assembly and form-room registration' },
        { time: '8:00am', activity: 'Period 1–4: core subjects' },
        { time: '11:00am', activity: 'Break' },
        { time: '11:30am', activity: 'Period 5–8: electives and laboratory work' },
        { time: '1:30pm', activity: 'Lunch' },
        { time: '2:15pm', activity: 'Prep, clubs, sports or examination coaching' },
        { time: '4:00pm', activity: 'Close of day / boarders to hostel' },
      ],
    },
  ],

  academics: {
    intro:
      'AB.10 teaches a broad-based curriculum drawn from both the Nigerian and British systems, so a learner can sit national examinations and international ones without changing school.',
    curricula: [
      {
        name: 'Nigerian National Curriculum',
        description:
          'The full NERDC scheme from nursery through senior secondary, leading to WASSCE, NECO-SSCE and the UTME.',
      },
      {
        name: 'British Curriculum',
        description:
          'Cambridge-aligned teaching in English, mathematics and the sciences, leading to IGCSE entry for candidates who choose it.',
      },
    ],
    subjects: [
      'English Language',
      'Mathematics',
      'Biology',
      'Chemistry',
      'Physics',
      'Further Mathematics',
      'Economics',
      'Government',
      'Literature in English',
      'Christian Religious Studies',
      'Commerce',
      'Financial Accounting',
      'Agricultural Science',
      'Computer Studies',
      'Data Processing',
      'AutoCAD',
      'French',
      'Civic Education',
      'Music',
      'Fine Art',
      'Physical & Health Education',
    ],
    examinations: [
      'WASSCE',
      'NECO-SSCE',
      'JAMB UTME',
      'Cambridge IGCSE',
      'SAT',
      'TOEFL',
      'GMAT',
      'JUPEB',
      'IJMB',
    ],
    enrichment: [
      {
        name: 'Global Awareness',
        description: 'Saturday sessions on world affairs, culture and current events.',
        icon: 'globe',
      },
      {
        name: 'Creativity & Skills for Life',
        description: 'Practical skills, entrepreneurship and making — from coding to catering.',
        icon: 'sparkles',
      },
      {
        name: 'Community Service',
        description: 'Termly outreach that takes learning outside the gate.',
        icon: 'users',
      },
      {
        name: 'Business School',
        description: 'Enterprise, money sense and pitching for senior students.',
        icon: 'award',
      },
    ],
  },

  facilities: {
    intro:
      'One secure campus on Idowu Street, purpose-fitted for teaching rather than adapted from housing.',
    items: [
      {
        name: 'Science laboratories',
        description: 'Separate biology, chemistry and physics benches with practical apparatus.',
        icon: 'flask',
      },
      {
        name: 'ICT laboratory',
        description: 'Networked workstations for computer studies, data processing and AutoCAD.',
        icon: 'laptop',
      },
      {
        name: 'Library',
        description: 'Print collection alongside digital resources and a quiet study area.',
        icon: 'library',
      },
      {
        name: 'Music room',
        description: 'Keyboards, percussion and choir practice space.',
        icon: 'music',
      },
      {
        name: 'Art studio',
        description: 'Dedicated space for fine art, craft and design work.',
        icon: 'palette',
      },
      {
        name: 'Sports field',
        description: 'Football, athletics and inter-house sports.',
        icon: 'trees',
      },
      {
        name: 'Hostel accommodation',
        description: 'Supervised boarding for high school students.',
        icon: 'bed',
      },
      {
        name: 'Water and power',
        description: 'Industrial borehole and treated water throughout the campus.',
        icon: 'droplet',
      },
      {
        name: 'Security',
        description: 'CCTV coverage, controlled access and a police post beside the campus.',
        icon: 'shield',
      },
    ],
    image: { src: '/site/ab10school-building.jpg', alt: 'The AB.10 Schools campus on Idowu Street' },
  },

  gallery: [
    { src: '/site/carousel-7.jpeg', alt: 'Pupils singing at assembly' },
    { src: '/site/carousel-9.jpeg', alt: 'Students in the chemistry laboratory' },
    { src: '/site/ab10-school-music.jpg', alt: 'Music lesson in progress' },
    { src: '/site/carousel-1.jpeg', alt: 'Graduation ceremony' },
    { src: '/site/ab10-school-computing.jpg', alt: 'ICT laboratory session' },
    { src: '/site/carousel-4.jpeg', alt: 'Students at a school event' },
    { src: '/site/ab10-school-uniform.jpg', alt: 'The AB.10 school uniform' },
    { src: '/site/carousel-11.jpeg', alt: 'Inter-house sports day' },
  ],

  news: [
    {
      id: 'news-graduation',
      title: 'Class of 2025 graduates with full university placement',
      excerpt:
        'Our senior secondary leavers were presented at the annual graduation and prize giving, with the majority already holding admission offers.',
      date: '2025-07-18',
      category: 'Achievement',
      image: { src: '/site/carousel-1.jpeg', alt: 'Graduation ceremony at AB.10 Schools' },
    },
    {
      id: 'news-science',
      title: 'Science laboratories refitted ahead of the new session',
      excerpt:
        'New microscopes, reagents and safety equipment have been installed across the biology, chemistry and physics benches.',
      date: '2025-09-02',
      category: 'Campus',
      image: { src: '/site/carousel-5.jpeg', alt: 'Students using new laboratory equipment' },
    },
    {
      id: 'news-music',
      title: 'School choir takes first place at the district festival',
      excerpt:
        'The AB.10 choir returned with the trophy after a season of Friday rehearsals in the music room.',
      date: '2025-06-06',
      category: 'Arts',
      image: { src: '/site/ab10-school-music.jpg', alt: 'The school choir rehearsing' },
    },
  ],

  events: [
    {
      id: 'ev-resumption',
      title: 'First term resumption',
      date: '2025-09-15',
      location: 'Main campus',
      description: 'All classes resume for the 2025/2026 academic session.',
    },
    {
      id: 'ev-open-day',
      title: 'Open day and campus tour',
      date: '2025-10-04',
      location: 'Main campus',
      description: 'Meet the teachers, see the laboratories and ask us anything.',
    },
    {
      id: 'ev-entrance',
      title: 'High school entrance examination',
      date: '2025-10-18',
      location: 'Examination hall',
      description: 'For candidates seeking JSS1 and SSS1 places.',
    },
    {
      id: 'ev-carol',
      title: 'Carol service and prize giving',
      date: '2025-12-12',
      location: 'School hall',
      description: 'Families are warmly invited to close the term with us.',
    },
  ],

  testimonials: [
    {
      id: 't1',
      quote:
        'Our son came to AB.10 struggling with reading. Two terms later he was reading to his younger sister at home. The teachers actually track each child.',
      author: 'Mrs A. Adeyemi',
      role: 'Parent · Data Analyst',
    },
    {
      id: 't2',
      quote:
        'What convinced us was the balance. The academics are serious, but so is the character training. Our daughter is confident without being rude.',
      author: 'Mr E. Okoro',
      role: 'Parent · Health Professional',
    },
    {
      id: 't3',
      quote:
        'The ICT and AutoCAD work is well beyond what we expected at secondary level, and the campus is genuinely secure. We have recommended the school twice.',
      author: 'Mr T. Balogun',
      role: 'Parent · IT Professional',
    },
  ],

  admissions: {
    open: true,
    session: '2025/2026',
    intro:
      'We admit into Creche, Nursery, Primary, Junior and Senior Secondary, and the pre-university programme. Places are limited by class size, so early application is advised.',
    steps: [
      {
        title: 'Enquire',
        description:
          'Call, message us on WhatsApp or send the enquiry form. We will answer with fees, available classes and the next assessment date.',
      },
      {
        title: 'Visit the campus',
        description:
          'Tour the classrooms and laboratories, meet the head of the relevant section and ask your questions in person.',
      },
      {
        title: 'Apply',
        description:
          'Complete the application form and submit it with the required documents and the application fee.',
      },
      {
        title: 'Assessment',
        description:
          'Nursery and primary candidates have a short readiness interview. Secondary candidates sit an entrance examination in English and Mathematics.',
      },
      {
        title: 'Offer and enrolment',
        description:
          'Successful candidates receive an offer letter. Enrolment is confirmed once fees are paid and records are complete.',
      },
    ],
    requirements: [
      'Completed application form',
      'Birth certificate or sworn declaration of age',
      'Two recent passport photographs',
      'Last school report or transfer certificate (for transfers)',
      'Immunisation record (creche, nursery and primary)',
      'Parent or guardian identification',
    ],
    faqs: [
      {
        question: 'When does the academic session begin?',
        answer:
          'The first term of the 2025/2026 session resumes on 15 September 2025. Mid-session admission is possible where a place is available.',
      },
      {
        question: 'Do you offer boarding?',
        answer:
          'Yes. Supervised hostel accommodation is available for High School students, with day places offered across all sections.',
      },
      {
        question: 'What curriculum do you teach?',
        answer:
          'A broad-based Nigerian and British curriculum. Learners are prepared for WASSCE, NECO and the UTME, with a Cambridge IGCSE pathway available.',
      },
      {
        question: 'Is transport provided?',
        answer:
          'A school bus service covers the Ifako-Ijaiye, Agege and College Road routes. Ask the front office for the current route map and fees.',
      },
      {
        question: 'How much are the fees?',
        answer:
          'Fees vary by section and by day or boarding status. Send an enquiry and we will email the current fee schedule the same working day.',
      },
    ],
  },

  subsidiaries: [
    {
      name: 'AB.10 Specialist Hospital',
      description: 'Full-service hospital beside the campus, and our first call in any medical emergency.',
      href: 'https://ab10specialisthospital.com',
      icon: 'stethoscope',
    },
    {
      name: 'Fertigold Fertility Clinic',
      description: 'Fertility care and family medicine within the AB.10 group.',
      href: 'https://fertigoldfertility.com',
      icon: 'heart',
    },
    {
      name: 'Healthpoint Diagnostics',
      description: 'Laboratory and imaging diagnostics serving the wider community.',
      href: 'https://healthpointdiagnostics.com',
      icon: 'flask',
    },
  ],

  contact: {
    addressLines: [
      '3/5 Idowu Street, Karaole Estate',
      'Beside AB.10 Specialist Hospital',
      'College Road, Ifako-Ijaiye',
      'Lagos, Nigeria',
    ],
    phones: ['+234 806 321 9815', '+234 706 570 3175', '+234 903 445 9880'],
    whatsapp: '2348063219815',
    email: 'info@ab10schools.com',
    officeHours: [
      { days: 'Monday – Friday', hours: '7:30am – 4:30pm' },
      { days: 'Saturday', hours: '9:00am – 1:00pm' },
      { days: 'Sunday', hours: 'Closed' },
    ],
    mapEmbedUrl:
      'https://www.google.com/maps?q=Karaole+Estate+College+Road+Ifako-Ijaiye+Lagos&output=embed',
    socials: [
      { platform: 'Facebook', url: 'https://www.facebook.com/AB10HighSchool' },
      { platform: 'Instagram', url: 'https://www.instagram.com/ab10schools' },
      { platform: 'YouTube', url: 'https://www.youtube.com/@ab10schools' },
    ],
  },

  portals: [
    {
      name: 'High School portal',
      description: 'Results, attendance, fees and messages for secondary students and their parents.',
      href: '/sign-in',
    },
    {
      name: 'Primary School portal',
      description: 'Reports, assignments and school notices for nursery and primary families.',
      href: '/sign-in',
    },
  ],
};
