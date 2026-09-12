import type { SiteContent } from './site-content';

/**
 * AB.10 Schools — the site's content.
 *
 * The copy here is the school's own, taken verbatim from ab10schools.com, and
 * the photographs in `public/site/` are theirs too. Nothing in this file is
 * written on the school's behalf: where their site says something awkwardly, it
 * still says it, because the words are theirs to change and not ours.
 *
 * Two deliberate departures from the source, both noted where they occur:
 * the Hostel and Dress facility descriptions are swapped back to the headings
 * they belong to, and the AB.10 Specialist Hospital link is left empty because
 * the school's own menu has no address for it.
 */
export const defaultContent: SiteContent = {
  brand: {
    name: 'AB.10 Schools',
    shortName: 'AB.10',
    legalName: 'AB.10 Schools',
    motto: 'Knowledge, Godliness & Greatness',
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
        title: "God's establishment for raising children",
        body: 'Kids taught moral principles. Love, not rage, is the motivation behind discipline. Abundant materials to raise kids in accordance with faith',
        image: { src: '/site/carousel-1.jpeg', alt: 'AB.10 Schools pupils at a graduation ceremony' },
        links: [
          { label: 'About Us', href: 'about' },
          { label: 'Nursery/Primary', href: 'schools/nursery-primary-creche' },
        ],
      },
      {
        title: 'Kids Whose Brilliance Go Beyond Academics',
        body: 'We develop talent and provide people the chance to pursue their creative, athletic, musical, mechanical, social, entrepreneurial, and leadership brilliance.',
        image: { src: '/site/carousel-2.jpeg', alt: 'AB.10 pupils reading together in the corridor' },
        links: [
          { label: 'Contact Us', href: 'contact' },
          { label: 'High School', href: 'schools/high-school' },
        ],
      },
      {
        title: 'Children who Are Assets to Society, Not Liabilities',
        body: "kids who are sensitive to and cognizant of others' feelings. Youngsters who are raised to model responsible behavior, build strong relationships and are likely to be responsible citizens.",
        image: { src: '/site/carousel-3.jpeg', alt: 'Young AB.10 pupils seated in graduation gowns' },
        links: [
          { label: 'About Us', href: 'about' },
          { label: 'Creche/After School', href: 'schools/nursery-primary-creche' },
        ],
      },
      {
        title: 'Pupils Who Will be Paragons of Knowledge',
        body: 'Insatiable curiosity pushes them to look for fresh information. Keep an enormous amount of information and are able to quickly retrieve it.',
        image: { src: '/site/carousel-4.jpeg', alt: 'AB.10 pupils at a school event' },
        links: [
          { label: 'Contact Us', href: 'contact' },
          { label: 'High School', href: 'schools/high-school' },
        ],
      },
      {
        title: "Kids with God's Strength destined for Greatness",
        body: "Our children's faith in God gives them tremendous inner fortitude, bravery, and tenacity. They are empowered to overcome obstacles, confront their concerns, and tenaciously pursue their goals.",
        image: { src: '/site/carousel-5.jpeg', alt: 'AB.10 students working with a microscope' },
        links: [
          { label: 'About Us', href: 'about' },
          { label: 'Nursery/Primary', href: 'schools/nursery-primary-creche' },
        ],
      },
      {
        title: 'Deep affection and dedication for pupils',
        body: 'Commitment and love for educating and developing young minds. Beyond academics, the CEO provides students with a personal connection, mentoring, and the ability to inspire and enable students to realize their greatest potential.',
        image: { src: '/site/carousel-6.jpeg', alt: 'AB.10 Schools pupils with a member of staff' },
        links: [
          { label: 'Contact Us', href: 'contact' },
          { label: 'High School', href: 'schools/high-school' },
        ],
      },
      {
        title: "A child's 1st step to a Successful Future",
        body: 'Our pupils experience love, safety, and support. As a result, they can confidently investigate their surroundings. They cultivate a stable sense of security and a healthy sense of self-worth.',
        image: { src: '/site/carousel-7.jpeg', alt: 'AB.10 pupils singing at morning assembly' },
        links: [
          { label: 'About Us', href: 'about' },
          { label: 'Creche/After School', href: 'schools/nursery-primary-creche' },
        ],
      },
      {
        title: 'Exploring the limitless possibilities of knowledge',
        body: 'Amazingly amazing! Our pupils go out on an endless journey through the immense universe of information, delving into subjects that pique their interest.',
        image: { src: '/site/carousel-8.jpeg', alt: 'AB.10 pupils at work in class' },
        links: [
          { label: 'Contact Us', href: 'contact' },
          { label: 'High School', href: 'schools/high-school' },
        ],
      },
      {
        title: 'Students using Science to Sharpen their Minds',
        body: 'As they hone their critical thinking abilities, our students recognize issues, formulate theories, create solutions, and analyze outcomes. Their ability to solve problems carries over into other facets of life, enabling them to meet obstacles head-on.',
        image: { src: '/site/carousel-9.jpeg', alt: 'AB.10 students in the science laboratory' },
        links: [
          { label: 'Learn More', href: 'about' },
          { label: 'Nursery/Primary', href: 'schools/nursery-primary-creche' },
        ],
      },
      {
        title: 'Student Delivering their Best performance to Date',
        body: 'Fully concentrated, responding to each exam question. Our pupils have worked hard in their studies, and it has paid off. Every exam they take, they come away from it confident.',
        image: { src: '/site/carousel-10.jpeg', alt: 'AB.10 students writing an examination' },
        links: [
          { label: 'About US', href: 'about' },
          { label: 'High School', href: 'schools/high-school' },
        ],
      },
      {
        title: 'Student Entrepreneurs Out to Create Diverse Jobs',
        body: 'Students that are passionate about providing solutions, identified gaps in the job market. Naturally motivated to invent and construct new things, our student business owners use technology to develop original solutions.',
        image: { src: '/site/carousel-11.jpeg', alt: 'AB.10 students presenting their enterprise work' },
        links: [
          { label: 'Contact Us', href: 'contact' },
          { label: 'High School', href: 'schools/high-school' },
        ],
      },
    ],
  },

  facilities: {
    title: 'AB.10 Facilities',
    intro:
      'For propelling our students into the frontiers of knowledge and the pleasure of self-discovery, we have the State-of-the-Art Classrooms, Well-Furnished Library, Science Laboratories, Music Room, Visual Arts Studio, Well-Equipped ICT Laboratory, Standard Sports Field, Well-Treated Industrial Bore-Hole Water System, Well-Equipped Security Network (with a stand-by Police Post) as well as good Transportation Network, amongst others.',
    items: [
      {
        name: 'ICT',
        description:
          'State-of-the-art computer lab provides students with the required exposure to ICT of the millennium.',
        icon: 'laptop',
      },
      {
        name: 'Classroom',
        description:
          'Modern classrooms, designed to optimize learning, that goes beyond just furniture and whiteboards',
        icon: 'school',
      },
      {
        name: 'CBT',
        description:
          'Students get accustomed to using the CBT platform, answering question, and managing time constraints in a real-time.',
        icon: 'monitor',
      },
      {
        name: 'Library',
        description:
          'Learning Hub, designed with Collaborative Zones, Digital Resources and Interactive Displays',
        icon: 'library',
      },
      {
        name: 'Laboratory',
        description:
          'Easy-to-reconfiguration Benches, Microscopes with Digital Cameras, Sensors and Probes fostering exploration',
        icon: 'flask',
      },
      {
        name: 'Music',
        description:
          'Student music Practice rooms, Recording Equipment & Movable Acoustic Panels for adjusting acoustics.',
        icon: 'music',
      },
      {
        name: 'Art Studio',
        description:
          'Designated Areas for specific activities like drawing, painting, sculpting, and showcasing student work',
        icon: 'palette',
      },
      {
        name: 'Sport Field',
        description:
          'Well-maintained field suitable for a variety of sports like soccer, football, rugby, or field hockey.',
        icon: 'trees',
      },
      {
        name: 'Industrial Bore-Hole Water',
        description:
          'Testing protocol for a well-treated industrial Bore-Hole Water, exceeding the minimum requirements set by government.',
        icon: 'droplet',
      },
      {
        name: 'Security',
        description:
          'School Secure fence, monitored entry, strategical security cameras, de-escalation techniques & stand-by Police Post',
        icon: 'shield',
      },
      {
        // The school's own page pairs this heading with the dress-code text and
        // vice versa; the two are restored to their headings here.
        name: 'Hostel',
        description:
          'Our hostel is a typical home away from home. Our hostel masters & mistresses are unique guardians',
        icon: 'bed',
      },
      {
        name: 'Dress',
        description:
          'Students are expected to be properly dressed at all time and maintain an appearance that conforms to the school dress code',
        icon: 'shirt',
      },
      {
        name: 'Meals',
        description:
          'Fresh and healthy meals and refreshment are served on request. We prioritize good nutrition for our kids',
        icon: 'utensils',
      },
      {
        name: 'Communications',
        description:
          'Newsletter, SMS, email, Calls, Whatsapp and Social Media Platforms are mediums we use in passing information',
        icon: 'megaphone',
      },
      {
        name: 'Health',
        description:
          'Learners develop the habit of covering their nose and mouth when sneezing or coughing and regular washing of hands',
        icon: 'stethoscope',
      },
    ],
  },

  offers:
    'AB.10 Schools offers Day Nursery, Primary, High School Education and Pre-University Programme',

  about: {
    title: 'Learn More About AB.10 Schools',
    body: [
      'AB.10 Schools, Lagos is one of the institutions that God has set up to raise children who will be paragons of knowledge and greatness, whose excellence will surpass academics to include Godly character and a penchant for being solutions rather than problems to the society. The vision of AB.10 Schools, Lagos was born from deep passion and love for young children and a burning desire to raise them into a generation chosen and destined for greatness by the power of God.',
      'AB.10 Schools, Lagos is a co-educational Christian institution. It was founded on 13th January, 2014 by Dr Olukunle Akinoso and Pastor (Mrs) Olayinka Akinoso to nurture an educational system with high academic and moral standard via hard work by seasoned staff and to inculcate the fear of God into the younger generation, in a world where Godliness is fast fading away (a world endangered with corruption, killings, kidnapping, rape, drug trafficking, drug addiction amongst others).',
      'In collaboration with the parents, we will provide the right stepping-stone to children for a prosperous and fulfilling future. On 9th September, 2019 the High School came to existence, in order to quench the thirst of Million Nigerians yarning for quality Education.',
    ],
    founder: {
      name: 'Dr Olukunle Akinoso',
      role: 'Chairman & Founder',
      photo: {
        src: '/site/dro-olukunle-akinoso-ab10-hospital.jpeg',
        alt: 'Dr Olukunle Akinoso, Chairman and Founder',
      },
    },
    images: [
      { src: '/site/ab10-school-music.jpg', alt: 'Music lesson at AB.10 Schools' },
      { src: '/site/ab10-school-computing.jpg', alt: 'Pupils in the AB.10 ICT laboratory' },
      { src: '/site/ab10-school-uniform.jpg', alt: 'AB.10 Schools pupils in uniform' },
      { src: '/site/ab10-school-student.jpg', alt: 'An AB.10 Schools student' },
    ],
    excursions: {
      title: 'Go for Excursions',
      body: 'As part of our Real-Life Training Program, we organize Periodic and/or Annual Local and International Excursions for our students to broaden their knowledge',
    },
    vision:
      'To raise knowledgeable and Godly leaders who are determined to make positive national and global impacts.',
    mission:
      'To achieve academic and moral excellence, through smart and hard work for intellectual, spiritual and social development of Learners.',
    philosophy:
      'We believe that all learners have inherent potentials and virtuous inside of them that is greater than any obstacle for them to achieve academic and moral excellence',
    philosophyStrap: 'AT AB.10 SCHOOLS, WE TRAIN WORTHY CHAMPIONS.',
    aspiration:
      'Our aspiration is to nurture an educational system with high academic and moral standard via smart and hard work by seasoned staff and to inculcate the fear of God into the younger generation, in a world where Godliness is fast fading away (a world endangered with corruption, killings, kidnapping, rape, drug trafficking, drug addiction amongst others). In collaboration with the parents, we will provide the right stepping-stone to children for a prosperous and fulfilling future.',
    location:
      'AB.10 Schools, Lagos is situated within the culturally rich and serene environment beside AB.10 Specialist Hospital, 3/5 Idowu Street, Karaole Estate, College Road, Ifako Ijaiye, Lagos. The School is blessed with qualified, competent, experienced and motivated educators under the supervision of a dedicated Principal, versed in both Nigerian and British curricula. The Governing Board also works in consistent and close collaboration with the staff members in designing and executing programmes and activities.',
    curriculum: [
      'At AB.10 Schools, Lagos our standard is very high with a broad-based Nigerian and British curricula which cover all subjects in every field of study. Apart from General Subjects in Sciences, Arts & Social Sciences, our curricula are enriched with Computer Studies, French Language, Auto Cad, Trade Subjects, Music, amongst others.',
      'We equally have an enriched weekend programs for our students. These include Global Awareness, Creativity/Skills for Life, Community Support Service, as well as Business School',
      'Apart from the Internal and External Examinations like National and State Common Entrance, JAMB-UTME, WASSCE, NECO-SSCE, BECE, State BECE, Cambridge IGCSE & Checkpoints, SAT, TOEFL and GMAT, we also have facilities for preparing candidates for JUPEB and IJMB',
    ],
    religiousBelief: [
      'AB.10 Schools, Lagos is a Christian Co- Educational Citadel.',
      'Hence, on our school timetable, Fellowship for Christians is inculcated on Friday afternoon programme every week.',
    ],
    nameMeaning: [
      {
        letter: 'A',
        word: 'Able',
        image: { src: '/site/abto-m.jpg', alt: 'AB.10 Schools pupils' },
      },
      {
        letter: 'B',
        word: 'Brilliant',
        image: { src: '/site/ab10-school-b.jpg', alt: 'AB.10 Schools pupils' },
      },
      {
        letter: 'T',
        word: 'Top-Class',
        image: { src: '/site/ab10-able.jpg', alt: 'AB.10 Schools pupils' },
      },
      {
        letter: 'E',
        word: 'Excellent\\Enviable Scholars',
        image: { src: '/site/ab10-t.png', alt: 'AB.10 Schools pupils' },
      },
      {
        letter: 'N',
        word: 'Nurtured with Godly Character',
        image: { src: '/site/ab10-girl.jpg', alt: 'An AB.10 Schools pupil' },
      },
    ],
    values: [
      { name: 'GODLINESS', icon: 'church' },
      { name: 'INTEGRITY', icon: 'shield' },
      { name: 'TEAMWORK', icon: 'handshake' },
      { name: 'FAITH', icon: 'heart' },
      { name: 'DISCIPLINE', icon: 'target' },
      { name: 'EXCELLENCE', icon: 'trophy' },
    ],
    management: {
      title: 'AB.10 Schools Management Team',
      intro:
        'Our school management team is a well-oiled personalty working together to ensure a thriving learning environment for students, staff, and the entire school community. Strong Principal, team clear Vision and Goals, Data-Driven Decisions, Communication with Stakeholders are some of the aspects where our team excell.',
      people: [
        {
          name: 'Olayinka Akinoso',
          role: 'CEO',
          photo: { src: '/site/ab10-school-ceo.jpg', alt: 'Olayinka Akinoso, CEO' },
        },
        {
          name: 'Tosin Fabiyi',
          role: 'Principal',
          photo: { src: '/site/tosin-fabiyi.jpeg', alt: 'Tosin Fabiyi, Principal' },
        },
        {
          name: 'Isong Ekaete',
          role: 'Headmistress',
          photo: { src: '/site/ab10-school-headmistress.jpeg', alt: 'Isong Ekaete, Headmistress' },
        },
      ],
    },
  },

  programmes: [
    {
      slug: 'high-school',
      name: 'AB.10 Schools High School',
      navLabel: 'High School',
      summary:
        'AB. 10 High School provides pupils with a smooth transition from primary school to higher education.',
      image: { src: '/site/high-school-students.jpg', alt: 'AB.10 High School students' },
      overview: [
        'AB. 10 High School provides pupils with a smooth transition from primary school to higher education. JSS 1, JSS 2, and JSS 3 offer a fundamental education in core areas such as English, Mathematics, Integrated Science, Social Studies, and basic pre-vocational courses. SSS 1, SSS 2, and SSS 3 provide a more specialized education. Students select an academic track that focuses on arts, sciences, or commercial topics to prepare for the Senior Secondary School Certificate Examination (SSCE).',
        'At AB.10 Schools, Lagos our standard is very high with a broad-based Nigerian and British curricula which cover all subjects in every field of study. Apart from General Subjects in Sciences, Arts & Social Sciences, our curricula are enriched with Computer Studies, French Language, Auto Cad, Trade Subjects, Music, amongst others.',
        'We equally have an enriched weekend programs for our students. These include Global Awareness, Creativity/Skills for Life, Community Support Service, as well as Business School',
        'Apart from the Internal and External Examinations like National and State Common Entrance, JAMB-UTME, WASSCE, NECO-SSCE, BECE, State BECE, Cambridge IGCSE & Checkpoints, SAT, TOEFL and GMAT, we also have facilities for preparing candidates for JUPEB and IJMB.',
      ],
      head: {
        name: 'Mr Tosin Fabiyi',
        role: 'Principal',
        photo: { src: '/site/ab10-schools-headmaster.png', alt: 'Mr Tosin Fabiyi, Principal' },
      },
      features: [
        {
          name: 'Our Evaluation Device',
          description:
            'To evaluate our students’ work daily and/or weekly, we have some evaluation policies put in place to check them through the Class Project, In-loco-parentis Program, Note-Grading Exercise, Evaluation Dossier Checklist, and Progress Test on CBT among',
          icon: 'clipboard',
        },
        {
          name: 'Sports',
          description:
            'In addition to Physical & Health Education classes, every Wednesday and Saturday are scheduled for Sports and Aerobics. This programme is referred to as “Keep-Fit Exercise” where every one of our students is trained to exercise their bodies and showcase their sporting skills early in the morning, under the tutelage of our educators.',
          icon: 'trophy',
        },
        {
          name: 'Discipline',
          description:
            'AB.10 High School is noted for promoting responsible behavior in a Godly manner. We lay more emphasis on self-discipline and respect for rules and regulations. Flouting of the school rules and regulations with impunity will always attract the appropriate discipline. Bringing of Toys and Games is highly prohibited in this Citadel of Learning.',
          icon: 'target',
        },
        {
          name: 'Parents Teacher Forum',
          description:
            'The School has a vibrant Parent Teacher Forum which has been of great support. The Parents automatically belongs to this forum on registration of their wards. The forum meet once a term and more regularly as the case may be.',
          icon: 'users',
        },
        {
          name: 'High School Library',
          description:
            'Our School has many high quality books, fiction and non-fiction. Donation of books by Parents and Cooperate Bodies are welcome',
          icon: 'library',
        },
      ],
      gallery: [
        {
          src: '/site/secondaryschool/294942690_816794766361327_5133383183469422626_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/308453696_859754205398716_6727126189153316092_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/311982588_877875323586604_8759158611556618325_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/328986604_544838254381809_626314430098663796_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/335210473_710825217454391_8459416365994218579_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/336104611_719223503323431_6157666255997692866_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/336130236_576068211165757_4139663582501147082_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/349170439_207358815004171_6877742358883521486_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/350476535_149977484731522_5747183263563976469_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/365264682_787710963363702_6299270406954594169_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/375763149_815421310592667_4928628893414261253_n.jpg',
          alt: 'AB.10 High School students',
        },
        {
          src: '/site/secondaryschool/383978791_833013132166818_2086877505725700345_n.jpg',
          alt: 'AB.10 High School students',
        },
      ],
    },
    {
      slug: 'nursery-primary-creche',
      name: 'AB.10 Nursery, Primary, Creche and After School',
      navLabel: 'Nursery/Primary & Creche',
      summary:
        'With regard to programs offered, AB.10 is categorized as a comprehensive or full-service school since it provides Nursery, Primary, Creche, and After School.',
      image: { src: '/site/primary-school.jpg', alt: 'AB.10 primary school pupils' },
      overview: [
        'With regard to programs offered, AB.10 is categorized as a comprehensive or full-service school since it provides Nursery, Primary, Creche, and After School.',
        'Creche (ages 0-3): AB.10 creches, also referred to as daycare or baby care, offer early childhood education in a secure and supportive setting. Playing, singing, and storytelling are some of the early learning activities that we emphasize at Creche, along with basic needs and socializing.',
        'Nursery (ages 3 to 5): AB.10 nursery programs build on the basis given by AB.10 creches. We use play-based learning to teach basic academic ideas such as numbers, alphabet, shapes, and colors. Nursery programs often prepare AB.10 children for the transition to AB.10 primary school.',
        'Primary School (ages 5-11): AB.10 Primary school is the first phase of formal education, with a structured curriculum covering fundamental courses such as arithmetic, language arts, science, and social studies. AB.10 students gain basic reading, writing, and critical thinking abilities.',
      ],
      head: {
        name: 'Mrs Isong Ekaete',
        role: 'Headmistress',
        photo: { src: '/site/ab10-school-headmistress.jpeg', alt: 'Mrs Isong Ekaete, Headmistress' },
      },
      features: [
        {
          name: 'Happy Kids',
          description:
            'Having your children attend AB.10 school can be heartwarming! These are joyful children.',
          icon: 'heart',
        },
        {
          name: 'Engaging Learning',
          description:
            'AB.10 Kids find the lessons engaging and difficult, and they are engaged in the subjects being taught. This includes interactive exercises, practical assignments, or educators who make learning enjoyable.',
          icon: 'sparkles',
        },
        {
          name: 'Positive Relationships',
          description:
            'These kids sense that their classmates and teachers are there for them. They feel free to be themselves with their classmates both within and outside of the school, and they enjoy close friendships.',
          icon: 'handshake',
        },
        {
          name: 'Sense of Accomplishment',
          description:
            'Our children are succeeding academically and taking pride in their work. They are finishing a difficult project, getting good grades, or learning a new skill.',
          icon: 'award',
        },
        {
          name: 'Extracurricular Activities',
          description:
            'AB.10 Nursery, Primary, Creche and After School pupils take pleasure in becoming involved in groups or after-school activities that relate to their interests. Sports teams, music teams, drama plays, or any other endeavor that enables them to pursue their interests',
          icon: 'music',
        },
        {
          name: 'Positive AB.10 School Culture',
          description:
            'It feels safe, friendly, and courteous to be at AB.10 school. Positive reinforcement, teamwork, and acknowledging both individual and collective accomplishments are prioritized in our school.',
          icon: 'school',
        },
      ],
      gallery: [
        { src: '/site/creche/happychild-1.jpg', alt: 'Happy Kid' },
        { src: '/site/creche/happychild-2.jpg', alt: 'Happy Kid' },
        { src: '/site/creche/happychild-3.jpg', alt: 'Happy Kid' },
        { src: '/site/creche/happychild-4.jpg', alt: 'Happy Kid' },
        { src: '/site/creche/happychild-5.jpg', alt: 'Happy Kid' },
        { src: '/site/creche/happychild-6.jpg', alt: 'Happy Kid' },
        {
          src: '/site/primaryschool/10177493_766804390045948_8579979109486494141_n.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10473776_766803840046003_2142351606806708978_n.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10520667_766367953422925_1324670779285751363_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/1052986_766281033431617_4748607954821515757_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10658684_766369016756152_2156349598857878570_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10658798_766350053424715_8064156092253029666_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10662094_766368633422857_1103271481458841919_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10700544_766272206765833_8843902469685719595_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10700694_766272476765806_2074938270122276697_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/10708555_766369143422806_4392730352858291768_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/1412363_766348533424867_8931560028368964850_o.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/1959812_766765903383130_7489137220291274152_n.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
        {
          src: '/site/primaryschool/300752300_372592381729859_377123783547945061_n.jpg',
          alt: 'AB.10 nursery and primary pupils',
        },
      ],
    },
  ],

  testimonials: {
    title: 'AB.10 Schools Parents Say!',
    intro:
      "Parents chose AB.10 Schools due to their stellar academic standing. Kids have been encouraged, and their academic performance has significantly increased. The AB.10 Schools' teachers are fantastic at adjusting their lessons to meet the needs of each individual student. Kids feel self-assured and ready for adulthood. At AB.10 Schools, the after-school activities are excellent. The child pursued their interests, which has been an excellent way for them to meet new people. These parent endorsements emphasize several facets of AB.10 Schools.",
    items: [
      {
        id: 'udoh-imeh-victor',
        quote:
          'Our child is ready for success in college and beyond thanks to AB.10 Schools. Teachers that are passionate about their subject. We adore the welcoming and diversified atmosphere at the high school for AB.10 Schools. Our youngster has made friends for life and feels at ease being themselves. AB.10 Schools offers a great balance of academics and extracurricular activities.',
        author: 'Udoh Imeh Victor',
        role: 'Data Analyst',
        photo: { src: '/site/ab10-school-parent.jpeg', alt: 'Udoh Imeh Victor' },
      },
      {
        id: 'ogundana-olajumoke',
        quote:
          "We were very impressed by AB.10 Schools' creche's emphasis on early development. Our youngster has learned a lot via play and is now thriving in nursery class. AB.10 Schools's creche gives us so much peace of mind. We know our child is being well cared for while we're at work. The staff at AB.10 Schools's creche are amazing. They create a loving and nurturing environment where our child feels safe and secure",
        author: 'Ogundana Olajumoke',
        role: 'Health Professional',
        photo: { src: '/site/ab10school-parent.jpg', alt: 'Ogundana Olajumoke' },
      },
      {
        id: 'abiola-damilola',
        quote:
          "Our child has a solid understanding of reading, writing, and math owing to the attentive teachers. We admire AB.10 Schools' emphasis on the entire child. They provide a variety of programs to help our child's academic, social, and emotional development. The visual arts and music offerings at AB.10 Schools are excellent. Our child has acquired a passion for acoustics and has blossomed creatively.",
        author: 'Abiola Damilola',
        role: 'IT Professional',
        photo: { src: '/site/ab10-school-parents.jpeg', alt: 'Abiola Damilola' },
      },
    ],
  },

  news: {
    title: 'Our Media & Coverage',
    subtitle: 'AB.10 Schools 360 & Media',
    items: [
      {
        id: 'excellent-academic-performance',
        title: 'Excellent Academic Performance',
        excerpt: 'What a marvelous God. AB.10 High School Students came out excellently in ...',
        dateLabel: 'Tue 11 Nov 2025 1:09pm',
        author: 'TOSIN FABIYI TIFAB',
        image: {
          src: '/site/article_head/blg-10078-1922025-11-11-01-11-00.jpg',
          alt: 'Excellent Academic Performance',
        },
      },
      {
        id: 'best-school',
        title: 'AB.10 Schools rated the Best School in ...',
        excerpt: 'The BEST legacy you can give your Child is Education. Why is ...',
        dateLabel: 'Tue 11 Nov 2025 1:05pm',
        author: 'TOSIN FABIYI TIFAB',
        image: {
          src: '/site/article_head/blg-10078-1922025-11-11-01-11-01.jpg',
          alt: 'AB.10 Schools rated the Best School',
        },
      },
    ],
  },

  gallery: [
    { src: '/site/about/_MG_3039.jpg', alt: 'AB.10 Schools' },
    { src: '/site/about/_MG_3097.jpg', alt: 'AB.10 Schools' },
    { src: '/site/about/_MG_3169.jpg', alt: 'AB.10 Schools' },
    { src: '/site/about/_MG_3171.jpg', alt: 'AB.10 Schools' },
    { src: '/site/about/_MG_3248.jpg', alt: 'AB.10 Schools' },
    { src: '/site/about/_MG_3275.jpg', alt: 'AB.10 Schools' },
    { src: '/site/about/lab.jpg', alt: 'AB.10 Schools laboratory' },
    {
      src: '/site/about/375763149_815421310592667_4928628893414261253_n.jpg',
      alt: 'AB.10 Schools',
    },
    { src: '/site/contact/IMG-20210624-WA0006.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0007.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0008.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0014.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0015.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0017.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0018.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0019.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0020.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0021.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0022.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/contact/IMG-20210624-WA0023.jpg', alt: 'AB.10 Schools campus' },
    { src: '/site/computer_lab_ab10.jpg', alt: 'AB.10 Schools computer laboratory' },
    { src: '/site/waecresult.JPG', alt: 'AB.10 Schools WAEC result' },
    { src: '/site/nursery.jpeg', alt: 'AB.10 nursery pupils' },
    { src: '/site/creche-ab10.jpg', alt: 'AB.10 creche' },
  ],

  registration: {
    title: 'Student Registration',
    intro:
      'A few minutes is enough to start a journey of becoming a full-fledged student. Apply for your child, for several of your children at once, or for yourself.',
  },

  subsidiaries: [
    { name: 'Fertigold Fertility Clinic', href: 'https://fertigoldfertilityclinic.com.ng/', icon: 'heart' },
    // The school's own menu links this entry nowhere; left empty until they
    // supply an address rather than guessed at.
    { name: 'AB10 Specialist Hopital', href: '', icon: 'stethoscope' },
    { name: 'Healthpoint Diagnostics', href: 'https://healthpointdiagnostic.com/', icon: 'flask' },
  ],

  portals: [
    { name: 'Portal ⇒ High School', href: 'https://app.ajiracad.com/login192' },
    { name: 'Portal ⇒ Primary School', href: 'https://app.ajiracad.com/login190' },
  ],

  contact: {
    title: 'Get In Touch',
    intro:
      'At present, the school offers Day Nursery, Primary, Secondary Education and Pre-University Programme at the permanent site at 3/5 Idowu Street, Karaole Estate, Beside AB.10 Specialist Hospital, College Road, Ifako Ijaiye, Lagos. Application Form is on sale.',
    address:
      '3/5, Idowu Str, Beside Ab.10 Sppecialist Hospital, Karaole Estate, College Road, Ifako- Ijaiye, Lagos',
    phones: ['+23408063219815', '+23407065703175'],
    whatsapp: ['23408063219815', '23407065703175', '23409034459880'],
    // TODO(content): the school's site hides its address behind Cloudflare
    // email protection; confirm this before launch.
    email: 'info@ab10schools.com',
    facebook: { label: 'AB10HighSchool', url: 'https://web.facebook.com/AB10HighSchool' },
    mapEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31704.827458256415!2d3.333308077180076!3d6.634074975050598!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e6!4m5!1s0x103bd1f3e91f564d%3A0x15354cf6c01de3e1!2sBerger%20Bus-Stop%2C%20Ojodu%20Berger!3m2!1d6.6395189!2d3.3710171!4m5!1s0x103b914fdd988b51%3A0x24de0c37a54b00b4!2sab10%20schools%20address!3m2!1d6.6453625999999995!2d3.3277843!5e0!3m2!1sen!2sng!4v1710865347587!5m2!1sen!2sng',
    videoEmbedUrl: 'https://www.youtube.com/embed/KvMEwJM65wY?si=qvsp2yI_Eswhkpui',
  },

  footer: {
    quickLinks: [
      { label: 'About Us', href: 'about' },
      { label: 'Contact Us', href: 'contact' },
      { label: 'High School', href: 'schools/high-school' },
      { label: 'Nursery/Primary', href: 'schools/nursery-primary-creche' },
      { label: 'Creche/After School', href: 'schools/nursery-primary-creche' },
      { label: 'Events', href: 'news-and-events' },
      { label: 'Robotic Class', href: 'news-and-events' },
    ],
    signUp: {
      title: 'Sign Up',
      body: 'A single click is enough to start a journey of becoming a full-fledged student.',
      cta: 'Register',
    },
    policyUrl:
      'https://drive.google.com/file/d/1z5i4wXxtRd9kGtL0ANg9aWDp5LxzKL2V/view?usp=sharing',
  },
};
