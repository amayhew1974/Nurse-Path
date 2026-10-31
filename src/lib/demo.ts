// Fictional demo student. All dates are relative to "today" so the demo stays useful.
// Nothing here describes a real school, program, or person.
import { addDays, startOfWeek, todayISO } from './dates';
import type { Course, Task, ChecklistItem, TopicReflection, LearningGoal, Workspace, TaskType } from './types';
import { emptyWorkspace } from './workspace';
import { planWeek } from './planner';

export const DEMO_SCHOOL = 'Riverbend Community College (fictional)';

export function buildDemoWorkspace(now: Date = new Date()): Workspace {
  const today = todayISO(now);
  const d = (n: number) => addDays(today, n);
  const ts = now.toISOString();
  const ws = emptyWorkspace('demo');

  ws.profile = {
    preferredName: 'Jordan',
    pathway: 'ADN',
    stage: 'nursing',
    schoolName: DEMO_SCHOOL,
    programName: 'Associate Degree in Nursing (fictional program)',
    programStart: d(-24),
    anticipatedGraduation: addDays(today, 600),
    availability: [
      [{ start: '13:00', end: '16:00' }], // Sun
      [{ start: '18:30', end: '21:00' }], // Mon
      [{ start: '07:00', end: '08:30' }, { start: '19:00', end: '21:00' }], // Tue
      [{ start: '18:30', end: '21:00' }], // Wed
      [{ start: '19:00', end: '21:00' }], // Thu
      [{ start: '15:00', end: '17:00' }], // Fri
      [{ start: '09:00', end: '12:00' }], // Sat
    ],
    challengingTopics: ['Fluid and electrolyte balance', 'Prioritization questions'],
    onboardedAt: ts,
  };

  const course = (id: string, code: string, name: string, color: Course['color']): Course => ({
    id, code, name, color, term: 'Semester 1', notes: '', stage: 'nursing', createdAt: ts,
  });
  ws.courses = [
    course('demo_c1', 'NUR 101', 'Fundamentals of Nursing', 'teal'),
    course('demo_c2', 'NUR 102', 'Health Assessment', 'navy'),
    course('demo_c3', 'NUR 103', 'Pharmacology Concepts I', 'plum'),
    course('demo_c4', 'NUR 104', 'Nursing Skills Lab', 'gold'),
  ];

  let n = 0;
  const task = (courseId: string, title: string, type: TaskType, due: number, minutes: number, extra: Partial<Task> = {}): Task => ({
    id: `demo_t${++n}`,
    title,
    type,
    courseId,
    dueDate: d(due),
    dueTime: type === 'exam' ? '09:00' : '23:59',
    estimatedMinutes: minutes,
    status: 'todo',
    completedAt: null,
    notes: '',
    topics: [],
    source: 'demo',
    createdAt: ts,
    ...extra,
  });
  ws.tasks = [
    task('demo_c1', 'Nursing process care plan (fictional case)', 'assignment', 3, 150, { topics: ['Nursing process'] }),
    task('demo_c1', 'Exam 1: Safety, infection prevention, nursing process', 'exam', 6, 300, { topics: ['Infection prevention', 'Nursing process'] }),
    task('demo_c2', 'Vital signs quiz', 'quiz', 2, 90, { topics: ['Vital signs'] }),
    task('demo_c2', 'Head-to-toe assessment video submission', 'assignment', 9, 120),
    task('demo_c3', 'Drug classification flashcards (chapter 4)', 'reading', 5, 60),
    task('demo_c3', 'Unit 1 exam: principles of pharmacology', 'exam', 12, 240),
    task('demo_c4', 'Skills check-off: hand hygiene & PPE', 'skills', 4, 45, { topics: ['Infection prevention'] }),
    task('demo_c4', 'Pre-lab reading: body mechanics', 'reading', -1, 30),
    task('demo_c1', 'Therapeutic communication reflection', 'assignment', -3, 60, { status: 'done', completedAt: ts }),
    task('demo_c2', 'Chapter 1–2 reading: health history', 'reading', -6, 45, { status: 'done', completedAt: ts }),
    task('demo_c4', 'Clinical orientation paperwork', 'clinical', 8, 40),
  ];

  const item = (title: string, category: ChecklistItem['category'], due: number | null, done: boolean, sourceNote: string): ChecklistItem => ({
    id: `demo_k${++n}`, title, category, dueDate: due === null ? '' : d(due), done, notes: '', sourceNote, source: 'demo', createdAt: ts,
  });
  ws.checklist = [
    item('Upload immunization records', 'health', -10, true, 'Fictional handbook, section 4'),
    item('TB screening result', 'health', 7, false, 'Fictional handbook, section 4'),
    item('Background check and drug screen', 'documents', -5, true, 'Fictional admission letter'),
    item('Current BLS (CPR) card', 'clinical', 10, false, 'Fictional handbook, section 4'),
    item('Buy uniform and stethoscope', 'clinical', 14, false, 'Fictional orientation slides'),
    item('Sign handbook acknowledgment', 'academic', -15, true, 'Fictional orientation'),
    item('HIPAA training module', 'documents', 5, false, 'Fictional clinical coordinator email'),
  ];

  const refl = (topic: string, confidence: number, revisit: boolean, notes = ''): TopicReflection => ({
    id: `demo_r${++n}`, topic, confidence, revisit, notes, updatedAt: ts,
  });
  ws.reflections = [
    refl('Fluid and electrolyte balance', 2, true, 'Mixing up hypo- and hypertonic.'),
    refl('Chain of infection', 3, true),
    refl('Nursing process', 4, false),
    refl('Therapeutic communication', 3, false),
  ];

  const goal = (text: string, target: number | null, done = false): LearningGoal => ({
    id: `demo_g${++n}`, text, targetDate: target === null ? '' : d(target), done, createdAt: ts,
  });
  ws.goals = [
    goal('Explain each step of the nursing process without notes', 6),
    goal('Study 8 hours per week during the semester', null),
    goal('Practice 10 NCLEX-style prioritization questions each week', null),
  ];

  ws.quizAttempts = [
    { id: 'demo_q1', conceptId: 'nursing-process', conceptTitle: 'The nursing process', correct: 3, total: 4, takenAt: addDays(today, -2) + 'T19:00:00' },
  ];

  // Build a realistic week of study sessions with the real planner, then mark past ones done.
  // Earlier days this week: sessions the demo student already completed.
  const weekStart = startOfWeek(today);
  ws.sessions = planWeek(ws, weekStart, weekStart)
    .sessions.filter((s) => s.date < today)
    .map((s) => ({ ...s, status: 'done' as const, reason: 'Planned earlier this week. Completed.' }));
  // Rest of the week: planned from today with the real planner, so every reason is current.
  ws.sessions = planWeek(ws, weekStart, today).sessions;
  return ws;
}
