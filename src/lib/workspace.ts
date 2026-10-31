// Pure functions for creating, validating, and changing workspaces. No browser APIs here,
// so they can be unit-tested directly.
import { SCHEMA_VERSION } from './types';
import type { Profile, Workspace, WeeklyAvailability, Task, StudySession } from './types';

export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function emptyAvailability(): WeeklyAvailability {
  return [[], [], [], [], [], [], []];
}

export function emptyProfile(): Profile {
  return {
    preferredName: '',
    pathway: 'undecided',
    stage: 'nursing',
    schoolName: '',
    programName: '',
    programStart: '',
    anticipatedGraduation: '',
    availability: emptyAvailability(),
    challengingTopics: [],
    onboardedAt: null,
  };
}

export function emptyWorkspace(kind: Workspace['kind']): Workspace {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    kind,
    profile: emptyProfile(),
    courses: [],
    tasks: [],
    checklist: [],
    sessions: [],
    reflections: [],
    quizAttempts: [],
    goals: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Accepts unknown JSON (from storage or an imported backup) and returns a well-formed
 * workspace, or throws an Error with a plain-language message.
 */
export function normalizeWorkspace(raw: unknown, kind: Workspace['kind']): Workspace {
  if (!raw || typeof raw !== 'object') throw new Error('This file does not contain NursePath data.');
  const r = raw as Partial<Workspace> & { app?: string; workspace?: unknown };
  // Accept the export wrapper format too.
  if (r.app === 'NursePath' && r.workspace) return normalizeWorkspace(r.workspace, kind);
  if (typeof r.schemaVersion !== 'number' || !r.profile) {
    throw new Error('This file does not look like a NursePath export.');
  }
  if (r.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This file was made by a newer version of NursePath.');
  }
  const base = emptyWorkspace(kind);
  const profile = { ...base.profile, ...(r.profile as Profile) };
  if (!Array.isArray(profile.availability) || profile.availability.length !== 7) {
    profile.availability = emptyAvailability();
  }
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ...base,
    profile,
    courses: arr(r.courses),
    tasks: arr<Task>(r.tasks).map((t) => ({ ...t, topics: t.topics ?? [], notes: t.notes ?? '', dueTime: t.dueTime ?? '' })),
    checklist: arr(r.checklist),
    sessions: arr<StudySession>(r.sessions),
    reflections: arr(r.reflections),
    quizAttempts: arr(r.quizAttempts),
    goals: arr(r.goals),
    createdAt: r.createdAt ?? base.createdAt,
    updatedAt: r.updatedAt ?? base.updatedAt,
    kind,
  };
}

/** Deleting a course removes its tasks and the planner sessions tied to them. */
export function deleteCourse(ws: Workspace, courseId: string): Workspace {
  const removedTaskIds = new Set(ws.tasks.filter((t) => t.courseId === courseId).map((t) => t.id));
  return {
    ...ws,
    courses: ws.courses.filter((c) => c.id !== courseId),
    tasks: ws.tasks.filter((t) => t.courseId !== courseId),
    sessions: ws.sessions
      .filter((s) => !(s.taskId && removedTaskIds.has(s.taskId) && s.status === 'planned'))
      .map((s) => (s.courseId === courseId ? { ...s, courseId: null, taskId: null } : s)),
  };
}

/** Deleting a task removes its future planned sessions; finished sessions stay in history. */
export function deleteTask(ws: Workspace, taskId: string): Workspace {
  return {
    ...ws,
    tasks: ws.tasks.filter((t) => t.id !== taskId),
    sessions: ws.sessions
      .filter((s) => !(s.taskId === taskId && s.status === 'planned'))
      .map((s) => (s.taskId === taskId ? { ...s, taskId: null } : s)),
  };
}

/** Completing a task clears its remaining planned study sessions (the work is done). */
export function setTaskDone(ws: Workspace, taskId: string, done: boolean): Workspace {
  const now = new Date().toISOString();
  return {
    ...ws,
    tasks: ws.tasks.map((t) =>
      t.id === taskId ? { ...t, status: done ? 'done' : 'todo', completedAt: done ? now : null } : t,
    ),
    sessions: done
      ? ws.sessions.filter((s) => !(s.taskId === taskId && s.status === 'planned' && !s.pinned))
      : ws.sessions,
  };
}

/** Changing a due date removes unpinned planned sessions that now fall after the new deadline. */
export function updateTask(ws: Workspace, task: Task): Workspace {
  return {
    ...ws,
    tasks: ws.tasks.map((t) => (t.id === task.id ? task : t)),
    sessions: ws.sessions.filter(
      (s) => !(s.taskId === task.id && s.status === 'planned' && !s.pinned && s.date > task.dueDate),
    ),
  };
}
