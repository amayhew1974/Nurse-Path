import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Course, Task, TaskType, WeeklyAvailability, TimeBlock, StudySession, CourseColor, StageId } from '../lib/types';
import { TASK_TYPE_LABELS, COURSE_COLORS } from '../lib/types';
import { WEEKDAY_NAMES, formatTime, toMinutes, formatDuration, isValidISODate } from '../lib/dates';
import { weeklyAvailableMinutes } from '../lib/planner';
import { TopicInput } from './ui';
import { STAGES } from '../content/stages';

/* ---------------- Availability ---------------- */
const PRESETS: { label: string; block: TimeBlock }[] = [
  { label: 'Morning', block: { start: '08:00', end: '11:00' } },
  { label: 'Afternoon', block: { start: '13:00', end: '16:00' } },
  { label: 'Evening', block: { start: '18:00', end: '21:00' } },
];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

function overlaps(a: TimeBlock, b: TimeBlock) {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export function AvailabilityEditor({ value, onChange }: { value: WeeklyAvailability; onChange: (v: WeeklyAvailability) => void }) {
  const [custom, setCustom] = useState<{ day: number; start: string; end: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addBlock = (day: number, block: TimeBlock) => {
    if (toMinutes(block.end) <= toMinutes(block.start)) return setError('The end time must be after the start time.');
    if (toMinutes(block.end) - toMinutes(block.start) < 25) return setError('Add at least 25 minutes so a study session can fit.');
    if (value[day].some((b) => overlaps(b, block))) return setError(`That time overlaps a block you already have on ${WEEKDAY_NAMES[day]}.`);
    setError(null);
    const next = value.map((d) => [...d]);
    next[day] = [...next[day], block].sort((a, b) => a.start.localeCompare(b.start));
    onChange(next);
    setCustom(null);
  };
  const removeBlock = (day: number, i: number) => {
    const next = value.map((d) => [...d]);
    next[day].splice(i, 1);
    onChange(next);
  };
  const copyMonday = () => {
    const mon = value[1];
    onChange(value.map((d, i) => (i >= 1 && i <= 5 ? mon.map((b) => ({ ...b })) : d)));
  };
  const total = weeklyAvailableMinutes(value);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="spread">
        <p className="small muted">Add the times you can usually study. The planner only schedules inside these blocks.</p>
        <span className="pill study" aria-live="polite">{formatDuration(total)} per week</span>
      </div>
      <div className="avail-grid">
        {ORDER.map((day) => (
          <div className="avail-row" key={day}>
            <strong className="small">{WEEKDAY_NAMES[day]}</strong>
            <div className="stack" style={{ gap: 8 }}>
              <div className="avail-blocks">
                {value[day].length === 0 && <span className="tiny muted">Not available</span>}
                {value[day].map((b, i) => (
                  <span className="time-block" key={b.start}>
                    {formatTime(b.start)}–{formatTime(b.end)}
                    <button type="button" aria-label={`Remove ${WEEKDAY_NAMES[day]} ${formatTime(b.start)} to ${formatTime(b.end)}`} onClick={() => removeBlock(day, i)}>×</button>
                  </span>
                ))}
              </div>
              <div className="avail-blocks">
                {PRESETS.map((p) => (
                  <button key={p.label} type="button" className="btn sm ghost" onClick={() => addBlock(day, p.block)} aria-label={`Add ${p.label.toLowerCase()} (${formatTime(p.block.start)} to ${formatTime(p.block.end)}) on ${WEEKDAY_NAMES[day]}`}>
                    + {p.label}
                  </button>
                ))}
                <button type="button" className="btn sm ghost" onClick={() => setCustom({ day, start: '19:00', end: '20:30' })} aria-label={`Add custom time on ${WEEKDAY_NAMES[day]}`}>+ Custom</button>
              </div>
              {custom?.day === day && (
                <div className="row">
                  <label className="sr-only" htmlFor={`av-s-${day}`}>Start time</label>
                  <input id={`av-s-${day}`} type="time" className="input" style={{ width: 130 }} value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />
                  <span className="small">to</span>
                  <label className="sr-only" htmlFor={`av-e-${day}`}>End time</label>
                  <input id={`av-e-${day}`} type="time" className="input" style={{ width: 130 }} value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} />
                  <button type="button" className="btn sm primary" onClick={() => addBlock(day, { start: custom.start, end: custom.end })}>Add</button>
                  <button type="button" className="btn sm" onClick={() => { setCustom(null); setError(null); }}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="small" role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      {value[1].length > 0 && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={copyMonday}>Copy Monday’s times to Tuesday–Friday</button>}
    </div>
  );
}

/* ---------------- Course form ---------------- */
export function CourseForm({ initial, onSubmit, formId }: { initial: Partial<Course>; onSubmit: (c: Pick<Course, 'name' | 'code' | 'term' | 'color' | 'notes' | 'stage'>) => void; formId: string }) {
  const [name, setName] = useState(initial.name ?? '');
  const [code, setCode] = useState(initial.code ?? '');
  const [term, setTerm] = useState(initial.term ?? '');
  const [color, setColor] = useState<CourseColor>(initial.color ?? 'teal');
  const [stage, setStage] = useState<StageId>(initial.stage ?? 'nursing');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Enter a course name, for example “Fundamentals of Nursing.”');
    onSubmit({ name: name.trim(), code: code.trim(), term: term.trim(), color, notes: notes.trim(), stage });
  };
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="c-name">Course name</label>
        <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'c-name-err' : undefined} autoFocus />
        {err && <span id="c-name-err" className="error">{err}</span>}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="c-code">Course code <span className="optional">optional</span></label>
          <input id="c-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="NUR 101" />
        </div>
        <div className="field">
          <label htmlFor="c-term">Term <span className="optional">optional</span></label>
          <input id="c-term" className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Fall semester" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="c-stage">Journey stage</label>
          <select id="c-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value as StageId)}>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <fieldset className="field">
          <legend>Color</legend>
          <div className="chips">
            {COURSE_COLORS.map((c) => (
              <label key={c} className={`chip c-${c}`} style={{ padding: 6 }}>
                <input type="radio" name="c-color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" />
                <span className="dot" style={{ width: 16, height: 16, outline: color === c ? '2px solid var(--ink)' : 'none', outlineOffset: 2 }} />
                <span className="sr-only">{c}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="field">
        <label htmlFor="c-notes">Notes <span className="optional">optional</span></label>
        <textarea id="c-notes" className="input" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instructor office hours, where the syllabus lives…" />
      </div>
    </form>
  );
}

/* ---------------- Task form ---------------- */
export type TaskDraft = Pick<Task, 'title' | 'type' | 'courseId' | 'dueDate' | 'dueTime' | 'estimatedMinutes' | 'notes' | 'topics'>;

export function TaskForm({ initial, courses, onSubmit, formId, topicSuggestions }: { initial: Partial<Task>; courses: Course[]; onSubmit: (t: TaskDraft) => void; formId: string; topicSuggestions: string[] }) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [type, setType] = useState<TaskType>(initial.type ?? 'assignment');
  const [courseId, setCourseId] = useState<string>(initial.courseId ?? courses[0]?.id ?? '');
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '');
  const [dueTime, setDueTime] = useState(initial.dueTime ?? '');
  const [hours, setHours] = useState(String(((initial.estimatedMinutes ?? 60) / 60).toString()));
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [topics, setTopics] = useState<string[]>(initial.topics ?? []);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Give this item a short title.';
    if (!isValidISODate(dueDate)) next.dueDate = 'Choose a due date.';
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 40) next.hours = 'Enter an estimate between 0.25 and 40 hours.';
    setErrs(next);
    if (Object.keys(next).length) return;
    onSubmit({ title: title.trim(), type, courseId: courseId || null, dueDate, dueTime, estimatedMinutes: Math.max(15, Math.round((h * 60) / 5) * 5), notes: notes.trim(), topics });
  };
  const err = (k: string) => errs[k] && <span id={`t-${k}-err`} className="error">{errs[k]}</span>;

  return (
    <form id={formId} className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="t-title">Title</label>
        <input id="t-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errs.title} aria-describedby={errs.title ? 't-title-err' : undefined} placeholder="Care plan #1" autoFocus />
        {err('title')}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="t-type">Type</label>
          <select id="t-type" className="input" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-course">Course</label>
          <select id="t-course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">No course (general)</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ${c.name}` : c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="t-date">Due date</label>
          <input id="t-date" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={!!errs.dueDate} aria-describedby={errs.dueDate ? 't-dueDate-err' : undefined} />
          {err('dueDate')}
        </div>
        <div className="field">
          <label htmlFor="t-time">Time <span className="optional">optional</span></label>
          <input id="t-time" type="time" className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-hours">Estimated effort (hours)</label>
          <input id="t-hours" type="number" min="0.25" max="40" step="0.25" inputMode="decimal" className="input" value={hours} onChange={(e) => setHours(e.target.value)} aria-invalid={!!errs.hours} aria-describedby={errs.hours ? 't-hours-err' : 't-hours-hint'} />
          {err('hours') || <span id="t-hours-hint" className="hint">{type === 'exam' || type === 'quiz' ? 'Total study time you want before the exam.' : 'Total time you expect the work to take.'}</span>}
        </div>
      </div>
      <div className="field">
        <label htmlFor="t-topics">Topics <span className="optional">optional — helps match study sessions and explanations</span></label>
        <TopicInput id="t-topics" value={topics} onChange={setTopics} suggestions={topicSuggestions.slice(0, 6)} />
      </div>
      <div className="field">
        <label htmlFor="t-notes">Notes <span className="optional">optional</span></label>
        <textarea id="t-notes" className="input" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </form>
  );
}

/* ---------------- Session form ---------------- */
export type SessionDraft = Pick<StudySession, 'date' | 'start' | 'durationMinutes' | 'topic' | 'courseId'>;

export interface SessionCheckResult { error?: string; warnings: string[] }

export function SessionForm({ initial, courses, onSubmit, formId, check }: { initial: Partial<StudySession>; courses: Course[]; onSubmit: (s: SessionDraft) => void; formId: string; check: (s: SessionDraft) => SessionCheckResult }) {
  const [date, setDate] = useState(initial.date ?? '');
  const [start, setStart] = useState(initial.start ?? '19:00');
  const [duration, setDuration] = useState(String(initial.durationMinutes ?? 45));
  const [topic, setTopic] = useState(initial.topic ?? '');
  const [courseId, setCourseId] = useState(initial.courseId ?? '');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [ack, setAck] = useState(false);
  const draft: SessionDraft = { date, start, durationMinutes: Math.round(Number(duration) || 0), topic: topic.trim(), courseId: courseId || null };
  const live = isValidISODate(date) && /^\d{2}:\d{2}$/.test(start) && draft.durationMinutes >= 10 ? check(draft) : { warnings: [] };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (live.error) n.check = live.error;
    else if (live.warnings.length && !ack) n.check = 'Check the box below to confirm, or choose a different time.';
    if (!topic.trim()) n.topic = 'Say what you will study.';
    if (!isValidISODate(date)) n.date = 'Choose a date.';
    if (!/^\d{2}:\d{2}$/.test(start)) n.start = 'Choose a start time.';
    const d = Number(duration);
    if (!Number.isFinite(d) || d < 10 || d > 240) n.duration = 'Use 10 to 240 minutes.';
    else if (toMinutes(start) + d > 24 * 60) n.duration = 'The session would run past midnight.';
    setErrs(n);
    if (Object.keys(n).length) return;
    onSubmit({ date, start, durationMinutes: Math.round(d), topic: topic.trim(), courseId: courseId || null });
  };
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="s-topic">What will you study?</label>
        <input id="s-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)} aria-invalid={!!errs.topic} autoFocus />
        {errs.topic && <span className="error">{errs.topic}</span>}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="s-date">Date</label>
          <input id="s-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errs.date} />
          {errs.date && <span className="error">{errs.date}</span>}
        </div>
        <div className="field">
          <label htmlFor="s-start">Start</label>
          <input id="s-start" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!errs.start} />
          {errs.start && <span className="error">{errs.start}</span>}
        </div>
        <div className="field">
          <label htmlFor="s-dur">Minutes</label>
          <input id="s-dur" type="number" min="10" max="240" step="5" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} aria-invalid={!!errs.duration} />
          {errs.duration && <span className="error">{errs.duration}</span>}
        </div>
      </div>
      <div className="field">
        <label htmlFor="s-course">Course <span className="optional">optional</span></label>
        <select id="s-course" className="input" value={courseId ?? ''} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">None</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ${c.name}` : c.name}</option>)}
        </select>
      </div>
      {live.error && <div className="banner danger" role="alert"><span className="grow"><strong>Can’t save yet:</strong> {live.error}</span></div>}
      {!live.error && live.warnings.length > 0 && (
        <div className="banner" role="status">
          <div className="grow stack" style={{ gap: 6 }}>
            <strong>Capacity warning</strong>
            {live.warnings.map((w) => <span key={w} className="small">{w}</span>)}
            <label className="row small" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 4 }} />
              <span>I understand. Save this session anyway.</span>
            </label>
          </div>
        </div>
      )}
      {errs.check && !live.error && <span className="error">{errs.check}</span>}
    </form>
  );
}
