import type { StageId } from '../lib/types';

export interface StageFeature {
  name: string;
  detail: string;
  status: 'available' | 'planned';
  /** Route of the working feature, when available. */
  route?: string;
}

export interface StageInfo {
  id: StageId;
  order: number;
  title: string;
  short: string;
  purpose: string;
  /** Overall availability of the stage in this release. */
  availability: 'full' | 'preview';
  features: StageFeature[];
  guidance: string[];
  officialSources: { label: string; note: string }[];
}

export const STAGES: StageInfo[] = [
  {
    id: 'prereq',
    order: 1,
    title: 'Prerequisites & admission',
    short: 'Prerequisites',
    purpose: 'Finish prerequisite courses, prepare for an entrance exam, and apply to the programs that fit you.',
    availability: 'preview',
    features: [
      { name: 'Track courses and deadlines', detail: 'The course and deadline organizer works for prerequisite courses too. Set a course’s stage to “Prerequisites.”', status: 'available', route: 'courses' },
      { name: 'Application checklist', detail: 'Use the program checklist to record each school’s application steps from their official materials.', status: 'available', route: 'checklist' },
      { name: 'Prerequisite grade tracker & GPA calculator', detail: 'Record grades and see the GPA calculations each program uses.', status: 'planned' },
      { name: 'Compare programs side by side', detail: 'Enter each program’s requirements (from its official website) with the date you checked them.', status: 'planned' },
      { name: 'Entrance exam study plan', detail: 'A study planner tuned for entrance exams your target programs require.', status: 'planned' },
    ],
    guidance: [
      'Requirements differ widely between schools, and they change. Always confirm them on the program’s official website or with an advisor.',
      'NursePath does not include any real school’s requirements. Anything you enter is your own record.',
    ],
    officialSources: [
      { label: 'Each program’s official admissions page', note: 'The authoritative source for prerequisites, grade minimums, and deadlines.' },
      { label: 'Your academic advisor', note: 'Can confirm which of your courses transfer and count.' },
    ],
  },
  {
    id: 'nursing',
    order: 2,
    title: 'Nursing school',
    short: 'Nursing school',
    purpose: 'Organize courses, exams, clinicals, and skills — and understand what you are learning.',
    availability: 'full',
    features: [
      { name: 'Today dashboard', detail: 'Priorities, deadlines, and recommended study sessions from your own data.', status: 'available', route: 'today' },
      { name: 'Courses & deadlines', detail: 'Courses, assignments, exams, and prep tasks in list and calendar views.', status: 'available', route: 'courses' },
      { name: 'Program checklist', detail: 'Build it by hand, or paste or upload syllabus text and review each suggestion before saving.', status: 'available', route: 'checklist' },
      { name: 'Study planner', detail: 'A transparent weekly plan built from your availability and deadlines.', status: 'available', route: 'planner' },
      { name: 'Explain It My Way', detail: 'Six ways to learn a concept, from plain language to practice questions.', status: 'available', route: 'learn' },
      { name: 'Progress & reflection', detail: 'Confidence ratings, topics to revisit, goals, and completed work, kept separate.', status: 'available', route: 'progress' },
      { name: 'Clinical day prep templates', detail: 'Structured prep sheets for fictional practice cases.', status: 'planned' },
      { name: 'Semester rollover', detail: 'Archive one semester and carry goals into the next.', status: 'planned' },
    ],
    guidance: [
      'Your syllabus and program handbook are the official sources for your deadlines and requirements.',
      'Practice quizzes and confidence ratings help you study. They do not measure clinical competence.',
    ],
    officialSources: [
      { label: 'Your course syllabi and learning management system', note: 'Official due dates and grading.' },
      { label: 'Your program’s student handbook', note: 'Clinical, health, and progression requirements.' },
    ],
  },
  {
    id: 'licensure',
    order: 3,
    title: 'Graduation & licensure',
    short: 'Licensure',
    purpose: 'Complete graduation steps, apply for licensure in your state, and prepare for the NCLEX-RN.',
    availability: 'preview',
    features: [
      { name: 'Graduation task list', detail: 'You can track graduation tasks now with the program checklist.', status: 'available', route: 'checklist' },
      { name: 'Licensure requirements by jurisdiction', detail: 'Each requirement will show the state board it comes from, a link to the official page, and the date it was last verified. Nothing will appear without a source.', status: 'planned' },
      { name: 'NCLEX study plan', detail: 'A study planner for the licensure exam, using the same transparent rules.', status: 'planned' },
      { name: 'Application status tracker', detail: 'Track each step of your board application and exam registration.', status: 'planned' },
    ],
    guidance: [
      'Licensure rules, fees, and timelines are set by each state or territory’s board of nursing and can change.',
      'NursePath will not show deadlines or eligibility rules it cannot tie to an official source and a verification date.',
    ],
    officialSources: [
      { label: 'Your state or territory board of nursing', note: 'Sets licensure application requirements.' },
      { label: 'NCSBN (National Council of State Boards of Nursing)', note: 'Publishes official NCLEX information and the test plan.' },
    ],
  },
  {
    id: 'firstjob',
    order: 4,
    title: 'First nursing job',
    short: 'First job',
    purpose: 'Prepare a résumé, practice interviewing, track applications, and set goals for orientation.',
    availability: 'preview',
    features: [
      { name: 'Learning goals', detail: 'You can already set personal goals in Progress.', status: 'available', route: 'progress' },
      { name: 'Résumé builder', detail: 'Turn clinical rotations and experience into a new-graduate résumé.', status: 'planned' },
      { name: 'Interview practice', detail: 'Practice common behavioral questions using fictional situations.', status: 'planned' },
      { name: 'Job application tracker', detail: 'Track applications, interviews, and follow-ups.', status: 'planned' },
      { name: 'Specialty explorer & orientation goals', detail: 'Explore specialties and set goals for your first months.', status: 'planned' },
    ],
    guidance: [
      'NursePath helps you organize and prepare. It does not place you in a job or certify competence.',
    ],
    officialSources: [
      { label: 'Employer career pages and nurse residency programs', note: 'Official application requirements and dates.' },
    ],
  },
];

export const stageById = (id: StageId) => STAGES.find((s) => s.id === id)!;
