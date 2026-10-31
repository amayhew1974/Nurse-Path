// Core data model for NursePath.
// Everything a student saves lives in one `Workspace` object. The personal workspace and the
// demo workspace are stored separately so the demo can be reset without touching real data.

export const SCHEMA_VERSION = 1;

export type StageId = 'prereq' | 'nursing' | 'licensure' | 'firstjob';
export type Pathway = 'ADN' | 'BSN' | 'undecided';

/** A local calendar date, "YYYY-MM-DD". Stored as text so time zones never shift a deadline. */
export type ISODate = string;
/** A local clock time, "HH:MM" (24-hour). */
export type ClockTime = string;

export interface TimeBlock {
  start: ClockTime;
  end: ClockTime;
}

/** Weekly availability: index 0 = Sunday ... 6 = Saturday. */
export type WeeklyAvailability = TimeBlock[][];

export interface Profile {
  preferredName: string;
  pathway: Pathway;
  stage: StageId;
  schoolName: string;
  programName: string;
  programStart: ISODate | '';
  anticipatedGraduation: ISODate | '';
  availability: WeeklyAvailability;
  challengingTopics: string[];
  onboardedAt: string | null;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  term: string;
  color: CourseColor;
  notes: string;
  stage: StageId;
  createdAt: string;
}

export type CourseColor = 'teal' | 'navy' | 'gold' | 'plum' | 'sage' | 'coral';
export const COURSE_COLORS: CourseColor[] = ['teal', 'navy', 'gold', 'plum', 'sage', 'coral'];

export type TaskType =
  | 'assignment'
  | 'exam'
  | 'quiz'
  | 'clinical'
  | 'skills'
  | 'reading'
  | 'prep';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  clinical: 'Clinical prep',
  skills: 'Skills check-off',
  reading: 'Reading',
  prep: 'Preparation task',
};

export type TaskSource = 'manual' | 'import' | 'demo';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  courseId: string | null;
  dueDate: ISODate;
  dueTime: ClockTime | '';
  /** Student's estimate of the work (or study) needed, in minutes. */
  estimatedMinutes: number;
  status: 'todo' | 'done';
  completedAt: string | null;
  notes: string;
  topics: string[];
  source: TaskSource;
  /** When imported, the text the suggestion came from. */
  sourceText?: string;
  createdAt: string;
}

export type ChecklistCategory = 'health' | 'documents' | 'clinical' | 'academic' | 'other';
export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  health: 'Health & immunizations',
  documents: 'Documents & clearances',
  clinical: 'Clinical readiness',
  academic: 'Academic & orientation',
  other: 'Other',
};

export interface ChecklistItem {
  id: string;
  title: string;
  category: ChecklistCategory;
  dueDate: ISODate | '';
  done: boolean;
  notes: string;
  /** Where the requirement came from, in the student's words (e.g., "Student handbook p. 12"). */
  sourceNote: string;
  /** Text this item was extracted from, if imported. */
  sourceText?: string;
  source: TaskSource;
  createdAt: string;
}

export type SessionStatus = 'planned' | 'done' | 'skipped';

export interface StudySession {
  id: string;
  date: ISODate;
  start: ClockTime;
  durationMinutes: number;
  topic: string;
  courseId: string | null;
  taskId: string | null;
  /** Plain-language reason the planner (or student) created this session. */
  reason: string;
  status: SessionStatus;
  /** planner = created by the rules-based planner; manual = added by the student. */
  origin: 'planner' | 'manual';
  /** True once the student moves or edits a planner session — the planner will not overwrite it. */
  pinned: boolean;
}

export interface TopicReflection {
  id: string;
  topic: string;
  /** Self-rated confidence, 1 (not yet) to 5 (very confident). Self-reported only. */
  confidence: number;
  revisit: boolean;
  notes: string;
  updatedAt: string;
}

export interface QuizAttempt {
  id: string;
  conceptId: string;
  conceptTitle: string;
  correct: number;
  total: number;
  takenAt: string;
}

export interface LearningGoal {
  id: string;
  text: string;
  targetDate: ISODate | '';
  done: boolean;
  createdAt: string;
}

export interface Workspace {
  schemaVersion: number;
  kind: 'personal' | 'demo';
  profile: Profile;
  courses: Course[];
  tasks: Task[];
  checklist: ChecklistItem[];
  sessions: StudySession[];
  reflections: TopicReflection[];
  quizAttempts: QuizAttempt[];
  goals: LearningGoal[];
  createdAt: string;
  updatedAt: string;
}
