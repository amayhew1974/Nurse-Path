// Transparent, rules-based weekly study planner. No AI.
//
// The rules, in plain language:
//  1. Only plan inside the time blocks the student said they are available.
//  2. Never overlap two sessions. Sessions the student added, moved, finished, or skipped stay put.
//  3. Work is ranked by urgency: exams first (closest first), then assignments and other tasks
//     by due date, then topics the student marked as challenging or low-confidence.
//  4. Exam study is spread over the days before the exam (never on exam day).
//     Assignment work is scheduled on or before the due date.
//  5. Sessions are 25–90 minutes, with at most one session per item per day so work is spread out.
//  6. If the work does not fit, nothing is squeezed in: the planner reports what did not fit.
import { addDays, diffDays, fromMinutes, toMinutes, weekDates, weekday } from './dates';
import type { ISODate, StudySession, Task, Workspace, WeeklyAvailability, TopicReflection, Course } from './types';
import { uid } from './workspace';

export const PLANNER_RULES = [
  'Sessions are placed only inside your weekly availability.',
  'Sessions never overlap. Sessions you added, moved, completed, or skipped are kept as they are.',
  'Exams come first, closest exam first. Then assignments and other tasks, by due date. Then topics you marked as challenging or low-confidence.',
  'Exam study happens on the days before the exam, not on exam day. Assignment work is scheduled on or before the due date.',
  'Each session is 25–90 minutes, with no more than one session per item per day, so work is spread out.',
  'If everything does not fit, the planner tells you what is left instead of overbooking you.',
];

const MAX_SESSION = 90;
const MIN_SESSION = 25;
const BUFFER = 10; // minutes left between sessions
/** How far ahead to look for deadlines that deserve study time this week. */
const EXAM_HORIZON_DAYS = 14;
const TASK_HORIZON_DAYS = 10;
const TOPIC_SESSION = 45;

export interface PlanDemand {
  key: string;
  label: string;
  reason: string;
  minutesNeeded: number;
  earliest: ISODate;
  latest: ISODate;
  taskId: string | null;
  courseId: string | null;
  topic: string;
  priority: number;
}

export interface Unplaced {
  label: string;
  minutesShort: number;
  reason: string;
}

export interface PlanResult {
  sessions: StudySession[];
  unplaced: Unplaced[];
  capacity: CapacitySummary;
}

export interface CapacitySummary {
  availableMinutes: number;
  scheduledMinutes: number;
  demandMinutes: number;
  overCapacity: boolean;
}

/** Total minutes the student is available on a date. */
export function availableMinutesOn(av: WeeklyAvailability, date: ISODate): number {
  return (av[weekday(date)] ?? []).reduce((sum, b) => sum + Math.max(0, toMinutes(b.end) - toMinutes(b.start)), 0);
}

export function weeklyAvailableMinutes(av: WeeklyAvailability): number {
  return av.reduce((sum, day) => sum + day.reduce((s, b) => s + Math.max(0, toMinutes(b.end) - toMinutes(b.start)), 0), 0);
}

export function sessionsOverlap(a: { date: ISODate; start: string; durationMinutes: number }, b: { date: ISODate; start: string; durationMinutes: number }): boolean {
  if (a.date !== b.date) return false;
  const a0 = toMinutes(a.start);
  const b0 = toMinutes(b.start);
  return a0 < b0 + b.durationMinutes && b0 < a0 + a.durationMinutes;
}

/** Is the session fully inside one of the student's availability blocks? */
export function withinAvailability(av: WeeklyAvailability, s: { date: ISODate; start: string; durationMinutes: number }): boolean {
  const s0 = toMinutes(s.start);
  const s1 = s0 + s.durationMinutes;
  return (av[weekday(s.date)] ?? []).some((b) => s0 >= toMinutes(b.start) && s1 <= toMinutes(b.end));
}

export interface SessionCheck {
  overlap: StudySession | null;
  outsideAvailability: boolean;
  dayOverCapacity: boolean;
}

/** Checks a proposed session against existing ones. Used for manual add/move/edit. */
export function checkSession(ws: Workspace, proposed: { id?: string; date: ISODate; start: string; durationMinutes: number }): SessionCheck {
  const others = ws.sessions.filter((s) => s.id !== proposed.id && s.status !== 'skipped');
  const overlap = others.find((s) => sessionsOverlap(s, proposed)) ?? null;
  const outsideAvailability = !withinAvailability(ws.profile.availability, proposed);
  const dayTotal = others.filter((s) => s.date === proposed.date).reduce((n, s) => n + s.durationMinutes, 0) + proposed.durationMinutes;
  const dayOverCapacity = dayTotal > availableMinutesOn(ws.profile.availability, proposed.date);
  return { overlap, outsideAvailability, dayOverCapacity };
}

/** Collect topics the student wants to work on: marked challenging, or confidence ≤ 2, or "revisit". */
export function focusTopics(profileTopics: string[], reflections: TopicReflection[]): { topic: string; why: string }[] {
  const out = new Map<string, string>();
  for (const r of reflections) {
    if (r.revisit) out.set(r.topic.toLowerCase(), `You marked "${r.topic}" to revisit${r.confidence <= 2 ? ` and rated your confidence ${r.confidence} of 5` : ''}.`);
    else if (r.confidence <= 2) out.set(r.topic.toLowerCase(), `You rated your confidence in "${r.topic}" ${r.confidence} of 5.`);
  }
  for (const t of profileTopics) {
    if (!out.has(t.toLowerCase())) out.set(t.toLowerCase(), `You listed "${t}" as a challenging subject.`);
  }
  const names = new Map<string, string>();
  for (const r of reflections) names.set(r.topic.toLowerCase(), r.topic);
  for (const t of profileTopics) if (!names.has(t.toLowerCase())) names.set(t.toLowerCase(), t);
  return [...out.entries()].map(([k, why]) => ({ topic: names.get(k) ?? k, why }));
}

function courseName(courses: Course[], id: string | null): string {
  const c = courses.find((x) => x.id === id);
  return c ? (c.code || c.name) : '';
}

/** Turn saved tasks and topics into a ranked list of study demands for the planning window. */
export function buildDemands(ws: Workspace, windowStart: ISODate, windowEnd: ISODate, today: ISODate): PlanDemand[] {
  const demands: PlanDemand[] = [];
  const openTasks = ws.tasks.filter((t) => t.status === 'todo' && t.dueDate >= today);

  // Minutes already set aside (completed or still-planned, kept sessions) for each task.
  const committed = (taskId: string) =>
    ws.sessions.filter((s) => s.taskId === taskId && s.status !== 'skipped' && (s.status === 'done' || s.pinned || s.origin === 'manual')).reduce((n, s) => n + s.durationMinutes, 0);

  for (const t of openTasks) {
    const isExam = t.type === 'exam' || t.type === 'quiz';
    const daysAway = diffDays(today, t.dueDate);
    const horizon = isExam ? EXAM_HORIZON_DAYS : TASK_HORIZON_DAYS;
    if (daysAway > horizon + 7) continue;
    const latest = isExam ? addDays(t.dueDate, -1) : t.dueDate;
    if (latest < windowStart || latest < today) continue;
    const total = Math.max(t.estimatedMinutes || 0, isExam ? 60 : 30);
    // For deadlines past this week, plan only this week's fair share of the work.
    const daysUntilLatest = Math.max(1, diffDays(today, latest) + 1);
    const daysInWindow = Math.max(1, diffDays(today < windowStart ? windowStart : today, windowEnd < latest ? windowEnd : latest) + 1);
    const share = latest > windowEnd ? Math.ceil((total * daysInWindow) / daysUntilLatest / 5) * 5 : total;
    const need = Math.max(0, Math.max(share, MIN_SESSION) - committed(t.id));
    if (need <= 0) continue;
    const cn = courseName(ws.courses, t.courseId);
    const label = cn ? `${cn}: ${t.title}` : t.title;
    const dueText = daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`;
    const reason = isExam
      ? `${t.type === 'exam' ? 'Exam' : 'Quiz'} "${t.title}" is ${dueText}. You estimated ${t.estimatedMinutes} minutes of study.`
      : `"${t.title}" is due ${dueText}. You estimated ${t.estimatedMinutes} minutes of work.`;
    demands.push({
      key: t.id,
      label,
      reason,
      minutesNeeded: need,
      earliest: today > windowStart ? today : windowStart,
      latest: latest < windowEnd ? latest : windowEnd,
      taskId: t.id,
      courseId: t.courseId,
      topic: t.topics[0] ? `${t.title} — ${t.topics.join(', ')}` : t.title,
      priority: (isExam ? 0 : 1000) + daysAway,
    });
  }

  // Challenging topics: one review session each per week, if not already covered this week.
  const topics = focusTopics(ws.profile.challengingTopics, ws.reflections);
  topics.forEach(({ topic, why }, i) => {
    const already = ws.sessions.some(
      (s) => s.date >= windowStart && s.date <= windowEnd && s.status !== 'skipped' && !s.taskId && s.topic.toLowerCase() === `review: ${topic}`.toLowerCase() && (s.pinned || s.origin === 'manual' || s.status === 'done'),
    );
    if (already) return;
    demands.push({
      key: `topic:${topic.toLowerCase()}`,
      label: `Review: ${topic}`,
      reason: why,
      minutesNeeded: TOPIC_SESSION,
      earliest: today > windowStart ? today : windowStart,
      latest: windowEnd,
      taskId: null,
      courseId: null,
      topic: `Review: ${topic}`,
      priority: 5000 + i,
    });
  });

  return demands.sort((a, b) => a.priority - b.priority);
}

/** Free intervals (in minutes from midnight) on a date, given availability and busy sessions. */
function freeIntervals(av: WeeklyAvailability, date: ISODate, busy: StudySession[]): [number, number][] {
  const blocks = (av[weekday(date)] ?? []).map((b) => [toMinutes(b.start), toMinutes(b.end)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const taken = busy
    .filter((s) => s.date === date && s.status !== 'skipped')
    .map((s) => [toMinutes(s.start) - BUFFER, toMinutes(s.start) + s.durationMinutes + BUFFER] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  for (const [b0, b1] of blocks) {
    let cursor = b0;
    for (const [t0, t1] of taken) {
      if (t1 <= cursor || t0 >= b1) continue;
      if (t0 > cursor) free.push([cursor, Math.min(t0, b1)]);
      cursor = Math.max(cursor, t1);
    }
    if (cursor < b1) free.push([cursor, b1]);
  }
  return free.filter(([a, b]) => b - a >= MIN_SESSION);
}

/**
 * Plan the week starting `weekStart`. Returns the full new session list: kept sessions plus
 * freshly planned ones. Kept = done, skipped, manual, pinned, or outside this week.
 */
export function planWeek(ws: Workspace, weekStart: ISODate, today: ISODate): PlanResult {
  const days = weekDates(weekStart);
  const windowEnd = days[6];
  const inWindow = (s: StudySession) => s.date >= weekStart && s.date <= windowEnd;
  const replaceable = (s: StudySession) =>
    inWindow(s) && s.origin === 'planner' && s.status === 'planned' && !s.pinned && s.date >= today;

  const kept = ws.sessions.filter((s) => !replaceable(s));
  const wsForDemand = { ...ws, sessions: kept };
  const demands = buildDemands(wsForDemand, weekStart, windowEnd, today);

  const placed: StudySession[] = [];
  const unplaced: Unplaced[] = [];
  const busy = () => [...kept, ...placed];

  for (const d of demands) {
    let remaining = d.minutesNeeded;
    const candidateDays = days.filter((day) => day >= d.earliest && day <= d.latest && day >= today);
    const sameItem = (s: StudySession) => (d.taskId ? s.taskId === d.taskId : s.topic === d.topic);
    // Pass 1 allows one session per day for this item (spreads work out); later passes allow more.
    for (let perDay = 1; perDay <= 3 && remaining >= MIN_SESSION; perDay++) {
      for (const day of candidateDays) {
        if (remaining < MIN_SESSION) break;
        if (placed.filter((s) => s.date === day && sameItem(s)).length >= perDay) continue;
        const slot = freeIntervals(ws.profile.availability, day, busy())[0];
        if (!slot) continue;
        const [f0, f1] = slot;
        let len = Math.floor(Math.min(MAX_SESSION, remaining, f1 - f0) / 5) * 5;
        if (len < MIN_SESSION) continue;
        // Don't leave a sliver smaller than a real session; absorb it if there is room.
        if (remaining - len > 0 && remaining - len < MIN_SESSION && remaining <= f1 - f0 && remaining <= MAX_SESSION + MIN_SESSION) len = remaining;
        placed.push({
          id: uid('ses'),
          date: day,
          start: fromMinutes(f0),
          durationMinutes: len,
          topic: d.taskId ? d.label : d.topic,
          courseId: d.courseId,
          taskId: d.taskId,
          reason: d.reason,
          status: 'planned',
          origin: 'planner',
          pinned: false,
        });
        remaining -= len;
      }
    }
    if (remaining >= MIN_SESSION) {
      unplaced.push({
        label: d.label,
        minutesShort: remaining,
        reason: candidateDays.length === 0 ? 'No available days before the deadline this week.' : 'Not enough open time in your availability before the deadline.',
      });
    }
  }

  const sessions = [...kept, ...placed].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { sessions, unplaced, capacity: capacityFor({ ...ws, sessions }, weekStart, unplaced) };
}

export function capacityFor(ws: Workspace, weekStart: ISODate, unplaced: Unplaced[] = []): CapacitySummary {
  const end = addDays(weekStart, 6);
  const availableMinutes = weeklyAvailableMinutes(ws.profile.availability);
  const scheduledMinutes = ws.sessions
    .filter((s) => s.date >= weekStart && s.date <= end && s.status !== 'skipped')
    .reduce((n, s) => n + s.durationMinutes, 0);
  const short = unplaced.reduce((n, u) => n + u.minutesShort, 0);
  return {
    availableMinutes,
    scheduledMinutes,
    demandMinutes: scheduledMinutes + short,
    overCapacity: scheduledMinutes > availableMinutes || short > 0,
  };
}

/** Find the next free slot of `minutes` on or after a date, inside availability. */
export function findNextSlot(ws: Workspace, from: ISODate, minutes: number, excludeId?: string, maxDays = 14): { date: ISODate; start: string } | null {
  const busy = ws.sessions.filter((s) => s.id !== excludeId);
  for (let i = 0; i < maxDays; i++) {
    const day = addDays(from, i);
    const free = freeIntervals(ws.profile.availability, day, busy);
    const fit = free.find(([a, b]) => b - a >= minutes);
    if (fit) return { date: day, start: fromMinutes(fit[0]) };
  }
  return null;
}

export type { Task };
