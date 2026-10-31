// Computes what the dashboard and other screens show, directly from saved records.
import { addDays, diffDays, startOfWeek } from './dates';
import type { ISODate, StudySession, Task, Workspace, ChecklistItem } from './types';

export interface Priority {
  id: string;
  kind: 'task' | 'session' | 'checklist';
  title: string;
  why: string;
  tone: 'overdue' | 'today' | 'soon' | 'study';
  ref: Task | StudySession | ChecklistItem;
}

export function overdueTasks(ws: Workspace, today: ISODate): Task[] {
  return ws.tasks.filter((t) => t.status === 'todo' && t.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function upcomingTasks(ws: Workspace, today: ISODate, days = 14): Task[] {
  const end = addDays(today, days);
  return ws.tasks
    .filter((t) => t.status === 'todo' && t.dueDate >= today && t.dueDate <= end)
    .sort((a, b) => (a.dueDate + (a.dueTime || '99')).localeCompare(b.dueDate + (b.dueTime || '99')));
}

export function sessionsOn(ws: Workspace, date: ISODate): StudySession[] {
  return ws.sessions.filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

export function nextPlannedSessions(ws: Workspace, today: ISODate, limit = 3): StudySession[] {
  return ws.sessions
    .filter((s) => s.status === 'planned' && s.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, limit);
}

/** Today's priorities, most urgent first. Every item explains why it is here. */
export function todaysPriorities(ws: Workspace, today: ISODate): Priority[] {
  const out: Priority[] = [];
  for (const t of overdueTasks(ws, today)) {
    out.push({ id: t.id, kind: 'task', title: t.title, why: diffDays(t.dueDate, today) === 1 ? 'Was due yesterday' : `Overdue by ${diffDays(t.dueDate, today)} days`, tone: 'overdue', ref: t });
  }
  for (const t of ws.tasks.filter((t) => t.status === 'todo' && t.dueDate === today)) {
    out.push({ id: t.id, kind: 'task', title: t.title, why: 'Due today', tone: 'today', ref: t });
  }
  for (const s of sessionsOn(ws, today).filter((s) => s.status === 'planned')) {
    out.push({ id: s.id, kind: 'session', title: s.topic, why: s.reason, tone: 'study', ref: s });
  }
  for (const t of ws.tasks.filter((t) => t.status === 'todo' && t.dueDate === addDays(today, 1))) {
    out.push({ id: t.id, kind: 'task', title: t.title, why: 'Due tomorrow — finish or get ahead today', tone: 'soon', ref: t });
  }
  for (const c of ws.checklist.filter((c) => !c.done && c.dueDate && c.dueDate <= addDays(today, 3))) {
    out.push({ id: c.id, kind: 'checklist', title: c.title, why: c.dueDate < today ? 'Program checklist item past its date' : `Program checklist item due ${c.dueDate === today ? 'today' : 'within 3 days'}`, tone: c.dueDate < today ? 'overdue' : 'soon', ref: c });
  }
  return out;
}

export interface StageProgress {
  tasksDone: number;
  tasksTotal: number;
  checklistDone: number;
  checklistTotal: number;
  sessionsDoneThisWeek: number;
  sessionsPlannedThisWeek: number;
  studyMinutesThisWeek: number;
  programWeek: number | null;
  programPercent: number | null;
}

export function stageProgress(ws: Workspace, today: ISODate): StageProgress {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const week = ws.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd && s.status !== 'skipped');
  const { programStart, anticipatedGraduation } = ws.profile;
  let programWeek: number | null = null;
  let programPercent: number | null = null;
  if (programStart && programStart <= today) {
    programWeek = Math.floor(diffDays(programStart, today) / 7) + 1;
    if (anticipatedGraduation && anticipatedGraduation > programStart) {
      programPercent = Math.min(100, Math.round((diffDays(programStart, today) / diffDays(programStart, anticipatedGraduation)) * 100));
    }
  }
  return {
    tasksDone: ws.tasks.filter((t) => t.status === 'done').length,
    tasksTotal: ws.tasks.length,
    checklistDone: ws.checklist.filter((c) => c.done).length,
    checklistTotal: ws.checklist.length,
    sessionsDoneThisWeek: week.filter((s) => s.status === 'done').length,
    sessionsPlannedThisWeek: week.length,
    studyMinutesThisWeek: week.filter((s) => s.status === 'done').reduce((n, s) => n + s.durationMinutes, 0),
    programWeek,
    programPercent,
  };
}

export function pct(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}
