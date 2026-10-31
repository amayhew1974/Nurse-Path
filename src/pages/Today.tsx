import { useStore } from '../lib/store';
import { todayISO, formatLongDate, formatTime, formatDuration, formatDate, relativeDay, startOfWeek } from '../lib/dates';
import { todaysPriorities, upcomingTasks, overdueTasks, nextPlannedSessions, stageProgress, pct } from '../lib/derive';
import { planWeek } from '../lib/planner';
import type { StudySession, ChecklistItem, Task } from '../lib/types';
import { TaskRow, useTaskEditor, useTaskActions, courseOf } from '../components/TaskBits';
import { Empty, Meter, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { JourneyRoute } from './Journey';
import { findConceptForTopic } from '../content/concepts';
import { focusTopics } from '../lib/planner';
import { stageById } from '../content/stages';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Today() {
  const { ws, update } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [openEditor, editor] = useTaskEditor();
  const { toggle } = useTaskActions();

  const priorities = todaysPriorities(ws, today);
  const overdue = overdueTasks(ws, today);
  const upcoming = upcomingTasks(ws, today, 14);
  const nextSessions = nextPlannedSessions(ws, today, 4);
  const prog = stageProgress(ws, today);
  const stage = stageById(ws.profile.stage);
  const name = ws.profile.preferredName;
  const soonCount = upcoming.filter((t) => t.dueDate <= addDays3(today)).length;
  const topics = focusTopics(ws.profile.challengingTopics, ws.reflections);
  const hasAvailability = ws.profile.availability.some((d) => d.length > 0);

  const markSession = (s: StudySession, status: StudySession['status']) => {
    update((w) => ({ ...w, sessions: w.sessions.map((x) => (x.id === s.id ? { ...x, status } : x)) }));
    toast(status === 'done' ? 'Study session completed. Nice work.' : 'Session marked as planned.');
  };
  const toggleChecklist = (c: ChecklistItem) => {
    update((w) => ({ ...w, checklist: w.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }));
    toast(c.done ? 'Checklist item reopened.' : `Checked off “${c.title}”.`);
  };
  const buildPlan = () => {
    const r = planWeek(ws, startOfWeek(today), today);
    update((w) => ({ ...w, sessions: r.sessions }));
    toast(r.unplaced.length ? `Plan built. ${r.unplaced.length} item(s) did not fit — see the planner.` : 'This week’s study plan is ready.');
  };

  const summary = [
    overdue.length ? `${overdue.length} overdue` : null,
    soonCount ? `${soonCount} due in the next 3 days` : null,
    nextSessions.filter((s) => s.date === today).length ? `${nextSessions.filter((s) => s.date === today).length} study session${nextSessions.filter((s) => s.date === today).length === 1 ? '' : 's'} today` : null,
  ].filter(Boolean);

  return (
    <>
      <header className="page-head">
        <div className="hello">
          <span className="date">{formatLongDate(today)}</span>
          <h1>{greeting()}{name ? `, ${name}` : ''}.</h1>
          <p className="lede">{summary.length ? `You have ${summary.join(', ')}.` : 'Nothing is pressing today. A good day to get ahead or review a topic.'}</p>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => openEditor({ dueDate: today })}><Icon name="plus" />Add task</button>
        </div>
      </header>

      <div className="grid-2">
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel" aria-labelledby="h-today">
            <div className="panel-head">
              <h2 id="h-today">What should I do today?</h2>
              <p>Overdue work first, then today’s deadlines and study sessions</p>
            </div>
            {priorities.length === 0 ? (
              <Empty title="You’re clear for today">
                {ws.tasks.length === 0 ? 'Add your first assignment or exam and NursePath will start organizing your days.' : 'No overdue items, nothing due today, and no sessions planned. Look at what is due soon, or plan the week.'}
              </Empty>
            ) : (
              <ul className="list">
                {priorities.map((p) => (
                  <li key={p.kind + p.id}>
                    {p.kind === 'task' ? (
                      <div className="stack" style={{ gap: 0 }}>
                        <TaskRow task={p.ref as Task} onEdit={(t) => openEditor(t)} />
                        {p.tone !== 'today' && <p className="item-why" style={{ margin: '-6px 0 10px 34px' }}>{p.why}</p>}
                      </div>
                    ) : p.kind === 'session' ? (
                      <SessionRow s={p.ref as StudySession} onDone={() => markSession(p.ref as StudySession, (p.ref as StudySession).status === 'done' ? 'planned' : 'done')} />
                    ) : (
                      <div className="item">
                        <input type="checkbox" className="check" checked={(p.ref as ChecklistItem).done} onChange={() => toggleChecklist(p.ref as ChecklistItem)} aria-label={`Check off: ${p.title}`} />
                        <div className="item-body">
                          <span className="item-title">{p.title}</span>
                          <span className="item-why">{p.why}</span>
                        </div>
                        <span className={`pill ${p.tone}`}>Checklist</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="h-study">
            <div className="panel-head">
              <h2 id="h-study">What should I study next?</h2>
              <a href="#planner" className="small">Open planner</a>
            </div>
            {nextSessions.length > 0 ? (
              <ul className="list">
                {nextSessions.map((s) => (
                  <li key={s.id}><SessionRow s={s} showDate onDone={() => markSession(s, 'done')} /></li>
                ))}
              </ul>
            ) : !hasAvailability ? (
              <Empty title="Add your study times first" action={<a className="btn" href="#preferences">Set weekly availability</a>}>
                The planner only schedules study inside the times you say you are free, so it needs your availability before it can recommend sessions.
              </Empty>
            ) : (
              <Empty title="No study sessions planned yet" action={<button type="button" className="btn primary" onClick={buildPlan}>Build this week’s plan</button>}>
                NursePath will spread study time across your available hours, starting with your nearest exams and deadlines, then topics you find challenging.
              </Empty>
            )}
            {topics.length > 0 && (
              <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <span className="small" style={{ fontWeight: 600 }}>Topics you want to strengthen</span>
                <div className="chips">
                  {topics.slice(0, 5).map(({ topic }) => {
                    const c = findConceptForTopic(topic);
                    return c ? (
                      <a key={topic} className="chip" href={`#learn-${c.id}`}>{topic} · explain it</a>
                    ) : (
                      <a key={topic} className="chip" href="#learn">{topic}</a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="panel" aria-labelledby="h-due">
            <div className="panel-head">
              <h2 id="h-due">What is due soon?</h2>
              <a href="#courses" className="small">All deadlines</a>
            </div>
            {overdue.length > 0 && (
              <div className="stack" style={{ gap: 0 }}>
                <span className="pill overdue" style={{ alignSelf: 'flex-start' }}>{overdue.length} overdue</span>
                <ul className="list">{overdue.map((t) => <li key={t.id}><TaskRow task={t} onEdit={(x) => openEditor(x)} /></li>)}</ul>
              </div>
            )}
            {upcoming.length === 0 ? (
              <Empty title="Nothing due in the next two weeks" action={<button type="button" className="btn" onClick={() => openEditor({})}>Add a deadline</button>}>
                Add assignments and exams from your syllabus, or import them from pasted text on the checklist page.
              </Empty>
            ) : (
              <ul className="list">
                {upcoming.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <div className="item">
                      <span className="timecol">{formatDate(t.dueDate, { month: 'short', day: 'numeric' })}</span>
                      <div className="item-body">
                        <span className="item-title">{t.title}</span>
                        <span className="item-meta">
                          {courseOf(ws, t.courseId) && <span className={`row c-${courseOf(ws, t.courseId)!.color}`} style={{ gap: 6 }}><span className="dot" />{courseOf(ws, t.courseId)!.code || courseOf(ws, t.courseId)!.name}</span>}
                          <span>{relativeDay(t.dueDate, today)}</span>
                          <span>{formatDuration(t.estimatedMinutes)}</span>
                        </span>
                      </div>
                      {(t.type === 'exam' || t.type === 'quiz') && <span className="pill soon">{t.type === 'exam' ? 'Exam' : 'Quiz'}</span>}
                      <button type="button" className="icon-btn" aria-label={`Mark complete: ${t.title}`} onClick={() => toggle(t)}><Icon name="check" /></button>
                    </div>
                  </li>
                ))}
                {upcoming.length > 8 && <li><a className="small" href="#courses" style={{ display: 'block', padding: '10px 2px' }}>{upcoming.length - 8} more in the next two weeks</a></li>}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="h-where">
            <div className="panel-head">
              <h2 id="h-where">Where am I in my journey?</h2>
              <a href="#journey" className="small">Roadmap</a>
            </div>
            <JourneyRoute compact />
            <p className="small"><strong>{stage.title}</strong>{prog.programWeek ? ` · week ${prog.programWeek} of your program` : ''}{prog.programPercent !== null ? ` · about ${prog.programPercent}% of the way to your anticipated graduation date` : ''}</p>
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat">
                <div className="spread"><span className="stat-label">Tasks completed</span><span className="num small">{prog.tasksDone} of {prog.tasksTotal}</span></div>
                <Meter value={pct(prog.tasksDone, prog.tasksTotal)} label="Tasks completed" />
              </div>
              <div className="stat">
                <div className="spread"><span className="stat-label">Program checklist</span><span className="num small">{prog.checklistDone} of {prog.checklistTotal}</span></div>
                <Meter value={pct(prog.checklistDone, prog.checklistTotal)} label="Program checklist complete" gold />
              </div>
              <div className="stat">
                <div className="spread"><span className="stat-label">Study sessions this week</span><span className="num small">{prog.sessionsDoneThisWeek} of {prog.sessionsPlannedThisWeek} · {formatDuration(prog.studyMinutesThisWeek)}</span></div>
                <Meter value={pct(prog.sessionsDoneThisWeek, prog.sessionsPlannedThisWeek)} label="Study sessions completed this week" />
              </div>
              <p className="tiny muted">These count work you have recorded. They are not a measure of clinical competence.</p>
            </div>
          </section>
        </div>
      </div>
      {editor}
    </>
  );
}

function addDays3(d: string) {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + 3);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function SessionRow({ s, onDone, showDate }: { s: StudySession; onDone: () => void; showDate?: boolean }) {
  const { ws } = useStore();
  const c = courseOf(ws, s.courseId);
  const done = s.status === 'done';
  return (
    <div className={`item${done ? ' done' : ''}`}>
      <input type="checkbox" className="check" checked={done} onChange={onDone} aria-label={`${done ? 'Mark not done' : 'Mark session complete'}: ${s.topic}`} />
      <div className="item-body">
        <span className="item-title">{s.topic}</span>
        <span className="item-meta">
          <span className="mono">{showDate ? `${formatDate(s.date)} · ` : ''}{formatTime(s.start)} · {s.durationMinutes} min</span>
          {c && <span className={`row c-${c.color}`} style={{ gap: 6 }}><span className="dot" />{c.code || c.name}</span>}
        </span>
        <span className="reason"><b>Why:</b> {s.reason}</span>
      </div>
      <span className="pill study">Study</span>
    </div>
  );
}
