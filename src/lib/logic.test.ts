import { describe, it, expect } from 'vitest';
import { planWeek, sessionsOverlap, withinAvailability, checkSession, weeklyAvailableMinutes } from './planner';
import { extractSuggestions, findDate, SAMPLE_SYLLABUS } from './extract';
import { buildDemoWorkspace } from './demo';
import { emptyWorkspace, setTaskDone, deleteTask, updateTask, normalizeWorkspace, deleteCourse } from './workspace';
import { todaysPriorities, overdueTasks, upcomingTasks } from './derive';
import { startOfWeek, addDays } from './dates';
import type { Task, Workspace } from './types';

const TODAY = '2026-10-28'; // a Wednesday
const NOW = new Date(2026, 9, 28, 9, 0);

function wsWith(tasks: Partial<Task>[], hoursPerDay = 2): Workspace {
  const ws = emptyWorkspace('personal');
  ws.profile.availability = Array.from({ length: 7 }, () => [{ start: '18:00', end: `${18 + hoursPerDay}:00`.padStart(5, '0') }]);
  ws.courses = [{ id: 'c1', name: 'Fundamentals', code: 'NUR 101', term: '', color: 'teal', notes: '', stage: 'nursing', createdAt: '' }];
  ws.tasks = tasks.map((t, i) => ({
    id: `t${i}`, title: `Task ${i}`, type: 'assignment', courseId: 'c1', dueDate: addDays(TODAY, 3), dueTime: '', estimatedMinutes: 120,
    status: 'todo', completedAt: null, notes: '', topics: [], source: 'manual', createdAt: '', ...t,
  }));
  return ws;
}

describe('planner', () => {
  it('never overlaps sessions and stays inside availability', () => {
    const ws = wsWith([{ type: 'exam', dueDate: addDays(TODAY, 4), estimatedMinutes: 300 }, { estimatedMinutes: 200 }, { estimatedMinutes: 90, dueDate: addDays(TODAY, 1) }]);
    ws.profile.challengingTopics = ['Fluid balance'];
    const { sessions } = planWeek(ws, startOfWeek(TODAY), TODAY);
    expect(sessions.length).toBeGreaterThan(3);
    for (const a of sessions) {
      expect(withinAvailability(ws.profile.availability, a)).toBe(true);
      for (const b of sessions) if (a !== b) expect(sessionsOverlap(a, b)).toBe(false);
      expect(a.date >= TODAY).toBe(true);
    }
  });

  it('schedules exam study before exam day and assignment work by the due date', () => {
    const ws = wsWith([{ id: 'ex', type: 'exam', dueDate: addDays(TODAY, 3), estimatedMinutes: 180 }]);
    const { sessions } = planWeek(ws, startOfWeek(TODAY), TODAY);
    const ex = sessions.filter((s) => s.taskId === 'ex');
    expect(ex.length).toBeGreaterThan(0);
    ex.forEach((s) => expect(s.date < addDays(TODAY, 3)).toBe(true));
    expect(ex[0].reason).toMatch(/Exam/);
  });

  it('reports work that does not fit instead of overbooking', () => {
    const ws = wsWith([{ dueDate: addDays(TODAY, 1), estimatedMinutes: 600 }], 1);
    const r = planWeek(ws, startOfWeek(TODAY), TODAY);
    const total = r.sessions.reduce((n, s) => n + s.durationMinutes, 0);
    expect(total).toBeLessThanOrEqual(120);
    expect(r.unplaced.length).toBe(1);
    expect(r.capacity.overCapacity).toBe(true);
  });

  it('keeps pinned, manual, and completed sessions when re-planning', () => {
    const ws = wsWith([{ estimatedMinutes: 60 }]);
    const first = planWeek(ws, startOfWeek(TODAY), TODAY).sessions;
    const moved = { ...first[0], start: '18:30', pinned: true };
    const manual = { ...first[0], id: 'm1', origin: 'manual' as const, date: addDays(TODAY, 2), start: '18:00', durationMinutes: 30, taskId: null, topic: 'My own review' };
    const ws2 = { ...ws, sessions: [moved, manual] };
    const second = planWeek(ws2, startOfWeek(TODAY), TODAY).sessions;
    expect(second.find((s) => s.id === moved.id)?.start).toBe('18:30');
    expect(second.find((s) => s.id === 'm1')).toBeTruthy();
    // The pinned session already covers the 60 minutes, so no duplicate is planned.
    expect(second.filter((s) => s.taskId === 't0').length).toBe(1);
  });

  it('flags overlaps and out-of-availability manual sessions', () => {
    const ws = wsWith([]);
    ws.sessions = [{ id: 'a', date: TODAY, start: '18:00', durationMinutes: 60, topic: 'x', courseId: null, taskId: null, reason: '', status: 'planned', origin: 'manual', pinned: true }];
    expect(checkSession(ws, { date: TODAY, start: '18:30', durationMinutes: 30 }).overlap?.id).toBe('a');
    expect(checkSession(ws, { date: TODAY, start: '07:00', durationMinutes: 30 }).outsideAvailability).toBe(true);
    expect(weeklyAvailableMinutes(ws.profile.availability)).toBe(7 * 120);
  });
});

describe('task updates keep schedule consistent', () => {
  it('completing a task removes its planned sessions; deleting removes too', () => {
    const ws = wsWith([{ estimatedMinutes: 120 }]);
    ws.sessions = planWeek(ws, startOfWeek(TODAY), TODAY).sessions;
    expect(ws.sessions.some((s) => s.taskId === 't0')).toBe(true);
    const done = setTaskDone(ws, 't0', true);
    expect(done.tasks[0].status).toBe('done');
    expect(done.sessions.some((s) => s.taskId === 't0' && s.status === 'planned')).toBe(false);
    expect(deleteTask(ws, 't0').sessions.some((s) => s.taskId === 't0')).toBe(false);
  });
  it('moving a deadline earlier drops sessions after the new deadline', () => {
    const ws = wsWith([{ estimatedMinutes: 240, dueDate: addDays(TODAY, 4) }]);
    ws.sessions = planWeek(ws, startOfWeek(TODAY), TODAY).sessions;
    const t = { ...ws.tasks[0], dueDate: addDays(TODAY, 1) };
    const out = updateTask(ws, t);
    out.sessions.filter((s) => s.taskId === 't0').forEach((s) => expect(s.date <= t.dueDate).toBe(true));
  });
  it('deleting a course removes its tasks', () => {
    const ws = wsWith([{}, {}]);
    expect(deleteCourse(ws, 'c1').tasks.length).toBe(0);
  });
});

describe('dashboard derivations', () => {
  it('counts overdue, upcoming, and priorities from saved records', () => {
    const ws = wsWith([{ dueDate: addDays(TODAY, -2) }, { dueDate: TODAY }, { dueDate: addDays(TODAY, 5) }, { dueDate: addDays(TODAY, 5), status: 'done' }]);
    expect(overdueTasks(ws, TODAY).length).toBe(1);
    expect(upcomingTasks(ws, TODAY).length).toBe(2);
    const p = todaysPriorities(ws, TODAY);
    expect(p[0].tone).toBe('overdue');
    expect(p.some((x) => x.why === 'Due today')).toBe(true);
  });
});

describe('extraction', () => {
  it('parses common date formats', () => {
    expect(findDate('Exam 1 on 2026-11-04', NOW)?.iso).toBe('2026-11-04');
    expect(findDate('Quiz 9/24', NOW)?.iso).toBe('2026-09-24');
    expect(findDate('Due Dec. 3rd', NOW)).toMatchObject({ iso: '2026-12-03', yearInferred: true });
    expect(findDate('by January 15, 2027', NOW)).toMatchObject({ iso: '2027-01-15', yearInferred: false });
    expect(findDate('no dates here', NOW)).toBeNull();
  });
  it('turns the sample syllabus into reviewable suggestions with source text', () => {
    const s = extractSuggestions(SAMPLE_SYLLABUS, NOW);
    expect(s.find((x) => x.kind === 'course')?.courseCode).toBe('NURS 110');
    const exam = s.find((x) => x.kind === 'task' && x.taskType === 'exam');
    expect(exam?.date).toBe('2026-10-07');
    expect(s.filter((x) => x.kind === 'checklist').length).toBeGreaterThanOrEqual(3);
    s.forEach((x) => expect(x.sourceText.length).toBeGreaterThan(0));
  });
});

describe('demo and persistence format', () => {
  it('builds a demo with four courses, tasks, checklist, sessions, and review topics', () => {
    const d = buildDemoWorkspace(NOW);
    expect(d.kind).toBe('demo');
    expect(d.courses.length).toBe(4);
    expect(d.tasks.length).toBeGreaterThan(5);
    expect(d.checklist.length).toBeGreaterThan(3);
    expect(d.sessions.length).toBeGreaterThan(4);
    expect(d.reflections.filter((r) => r.revisit).length).toBeGreaterThan(0);
  });
  it('round-trips through export format and rejects junk', () => {
    const d = buildDemoWorkspace(NOW);
    const back = normalizeWorkspace(JSON.parse(JSON.stringify({ app: 'NursePath', workspace: d })), 'personal');
    expect(back.tasks.length).toBe(d.tasks.length);
    expect(back.kind).toBe('personal');
    expect(() => normalizeWorkspace({ hello: 1 }, 'personal')).toThrow();
  });
});
