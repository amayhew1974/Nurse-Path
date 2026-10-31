import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { Course, Task } from '../lib/types';
import { COURSE_COLORS, TASK_TYPE_LABELS } from '../lib/types';
import { todayISO, addDays, startOfWeek, toISODate, parseISODate, WEEKDAY_SHORT, formatDate } from '../lib/dates';
import { TaskRow, useTaskEditor, courseOf } from '../components/TaskBits';
import { CourseForm } from '../components/forms';
import { Modal, ConfirmButton, Empty, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { deleteCourse, uid } from '../lib/workspace';

type View = 'list' | 'calendar';
type Status = 'open' | 'done' | 'all';

function readPref<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function writePref(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

export function Courses() {
  const { ws, update } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [view, setView] = useState<View>(() => readPref<View>('nursepath:pref:courseView', 'list'));
  const [filter, setFilter] = useState<string>('all');
  const [status, setStatus] = useState<Status>('open');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [openTask, taskEditor] = useTaskEditor();
  const [courseEdit, setCourseEdit] = useState<Partial<Course> | null>(null);

  const tasks = ws.tasks
    .filter((t) => filter === 'all' || (filter === 'none' ? !t.courseId : t.courseId === filter))
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .sort((a, b) => (a.dueDate + (a.dueTime || '99')).localeCompare(b.dueDate + (b.dueTime || '99')));
  const listTasks = tasks.filter((t) => status === 'all' || (status === 'open' ? t.status === 'todo' : t.status === 'done'));

  const saveCourse = (c: Pick<Course, 'name' | 'code' | 'term' | 'color' | 'notes' | 'stage'>) => {
    if (courseEdit?.id) {
      update((w) => ({ ...w, courses: w.courses.map((x) => (x.id === courseEdit.id ? { ...x, ...c } : x)) }));
      toast('Course saved.');
    } else {
      const nc: Course = { ...c, id: uid('crs'), createdAt: new Date().toISOString() };
      update((w) => ({ ...w, courses: [...w.courses, nc] }));
      toast(`Added ${c.code || c.name}.`);
    }
    setCourseEdit(null);
  };

  const groups = useMemo(() => {
    const weekEnd = addDays(startOfWeek(today), 6);
    const g: { label: string; items: Task[] }[] = [
      { label: 'Overdue', items: listTasks.filter((t) => t.status === 'todo' && t.dueDate < today) },
      { label: 'This week', items: listTasks.filter((t) => t.status === 'todo' && t.dueDate >= today && t.dueDate <= weekEnd) },
      { label: 'Later', items: listTasks.filter((t) => t.status === 'todo' && t.dueDate > weekEnd) },
      { label: 'Completed', items: listTasks.filter((t) => t.status === 'done') },
    ];
    return g.filter((x) => x.items.length);
  }, [listTasks, today]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>Courses &amp; deadlines</h1>
          <p className="lede">Everything you need to turn in, study for, or prepare. Changes here update your dashboard and study plan right away.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCourseEdit({ color: COURSE_COLORS[ws.courses.length % COURSE_COLORS.length], stage: ws.profile.stage })}><Icon name="plus" />Add course</button>
          <button type="button" className="btn primary" onClick={() => openTask(filter !== 'all' && filter !== 'none' ? { courseId: filter } : {})}><Icon name="plus" />Add task</button>
        </div>
      </header>

      <section className="panel" aria-labelledby="h-courses">
        <div className="panel-head"><h2 id="h-courses">Courses</h2><p>{ws.courses.length} saved</p></div>
        {ws.courses.length === 0 ? (
          <Empty title="No courses yet" action={<button className="btn primary" type="button" onClick={() => setCourseEdit({ color: 'teal', stage: ws.profile.stage })}>Add your first course</button>}>
            Add each course you are taking this term. You can also import courses from a pasted syllabus on the Program checklist page.
          </Empty>
        ) : (
          <div className="concept-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {ws.courses.map((c) => {
              const open = ws.tasks.filter((t) => t.courseId === c.id && t.status === 'todo');
              const next = open.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
              return (
                <div key={c.id} className={`concept-card c-${c.color}`} style={{ borderTop: '3px solid var(--c)' }}>
                  <div className="spread">
                    <span className="cat">{c.code || 'Course'}{c.term ? ` · ${c.term}` : ''}</span>
                    <button type="button" className="icon-btn" onClick={() => setCourseEdit(c)} aria-label={`Edit ${c.name}`}><Icon name="edit" /></button>
                  </div>
                  <h3 style={{ fontSize: '1.05rem' }}>{c.name}</h3>
                  <p className="small">{open.length} open item{open.length === 1 ? '' : 's'}{next ? ` · next: ${formatDate(next.dueDate, { month: 'short', day: 'numeric' })}` : ''}</p>
                  <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setFilter(c.id)} aria-pressed={filter === c.id}>Show only this course</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="h-tasks">
        <div className="toolbar">
          <h2 id="h-tasks">Assignments, exams &amp; tasks</h2>
          <div className="seg" role="group" aria-label="View">
            {(['list', 'calendar'] as View[]).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); writePref('nursepath:pref:courseView', v); }}>{v === 'list' ? 'List' : 'Calendar'}</button>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ minWidth: 180 }}>
            <label htmlFor="f-course" className="tiny">Course</label>
            <select id="f-course" className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All courses</option>
              {ws.courses.map((c) => <option key={c.id} value={c.id}>{c.code || c.name}</option>)}
              <option value="none">No course</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label htmlFor="f-type" className="tiny">Type</label>
            <select id="f-type" className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {view === 'list' && (
            <div className="field" style={{ minWidth: 150 }}>
              <label htmlFor="f-status" className="tiny">Status</label>
              <select id="f-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                <option value="open">Not done</option>
                <option value="done">Completed</option>
                <option value="all">All</option>
              </select>
            </div>
          )}
        </div>

        {view === 'list' ? (
          groups.length === 0 ? (
            <Empty title={ws.tasks.length ? 'Nothing matches these filters' : 'No assignments or exams yet'} action={<button type="button" className="btn primary" onClick={() => openTask({})}>Add a task</button>}>
              {ws.tasks.length ? 'Try a different course, type, or status.' : 'Add items from your syllabus: assignments, exams, quizzes, skills check-offs, readings, and clinical prep.'}
            </Empty>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="stack" style={{ gap: 0 }}>
                <h3 className="small" style={{ textTransform: 'uppercase', letterSpacing: '.08em', color: g.label === 'Overdue' ? 'var(--danger)' : 'var(--ink-3)', paddingTop: 6 }}>{g.label} · {g.items.length}</h3>
                <ul className="list">{g.items.map((t) => <li key={t.id}><TaskRow task={t} onEdit={(x) => openTask(x)} /></li>)}</ul>
              </div>
            ))
          )
        ) : (
          <MonthCalendar tasks={tasks} onOpen={(t) => openTask(t)} onAddOn={(d) => openTask({ dueDate: d, courseId: filter !== 'all' && filter !== 'none' ? filter : undefined })} />
        )}
      </section>

      {taskEditor}
      <Modal
        open={!!courseEdit}
        title={courseEdit?.id ? 'Edit course' : 'Add a course'}
        onClose={() => setCourseEdit(null)}
        footer={
          <>
            {courseEdit?.id && (
              <span className="left">
                <ConfirmButton label="Delete course" icon="trash" confirmLabel="Delete course and its items"
                  prompt={`${ws.tasks.filter((t) => t.courseId === courseEdit.id).length} item(s) will be deleted.`}
                  onConfirm={() => { update((w) => deleteCourse(w, courseEdit.id!)); if (filter === courseEdit.id) setFilter('all'); setCourseEdit(null); toast('Course deleted.'); }} />
              </span>
            )}
            <button type="button" className="btn" onClick={() => setCourseEdit(null)}>Cancel</button>
            <button type="submit" form="course-form" className="btn primary">{courseEdit?.id ? 'Save' : 'Add course'}</button>
          </>
        }
      >
        {courseEdit && <CourseForm key={courseEdit.id ?? 'new'} formId="course-form" initial={courseEdit} onSubmit={saveCourse} />}
      </Modal>
    </>
  );
}

function MonthCalendar({ tasks, onOpen, onAddOn }: { tasks: Task[]; onOpen: (t: Task) => void; onAddOn: (d: string) => void }) {
  const { ws } = useStore();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // "YYYY-MM"
  const first = parseISODate(`${cursor}-01`);
  const gridStart = startOfWeek(toISODate(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const lastRowNeeded = days.slice(35).some((d) => d.slice(0, 7) === cursor);
  const shown = lastRowNeeded ? days : days.slice(0, 35);
  const shift = (n: number) => {
    const d = new Date(first);
    d.setMonth(d.getMonth() + n);
    setCursor(toISODate(d).slice(0, 7));
  };
  const byDay = new Map<string, Task[]>();
  tasks.forEach((t) => byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t]));
  const label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="stack">
      <div className="spread">
        <h3 aria-live="polite">{label}</h3>
        <div className="actions">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevL" /></button>
          <button type="button" className="btn sm" onClick={() => setCursor(today.slice(0, 7))}>This month</button>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevR" /></button>
        </div>
      </div>
      <div className="cal-wrap">
        <div className="cal" role="grid" aria-label={`Deadlines for ${label}`}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="cal-dow" role="columnheader">{WEEKDAY_SHORT[d]}</div>)}
          {shown.map((d) => {
            const items = byDay.get(d) ?? [];
            return (
              <div key={d} role="gridcell" className={`cal-day${d.slice(0, 7) !== cursor ? ' other' : ''}${d === today ? ' today' : ''}`} aria-label={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}>
                <div className="spread" style={{ flexWrap: 'nowrap' }}>
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => onAddOn(d)} aria-label={`Add task on ${formatDate(d)}`}><Icon name="plus" /></button>
                </div>
                {items.map((t) => {
                  const c = courseOf(ws, t.courseId);
                  return (
                    <button key={t.id} type="button" className={`cal-ev c-${c?.color ?? 'none'}${t.status === 'done' ? ' done' : ''}`} onClick={() => onOpen(t)} title={t.title}>
                      {(t.type === 'exam' || t.type === 'quiz') ? '★ ' : ''}{t.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="tiny muted">★ marks exams and quizzes. Select an item to edit it, or + to add an item on that day.</p>
    </div>
  );
}
