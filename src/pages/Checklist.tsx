import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../lib/store';
import type { ChecklistItem, ChecklistCategory, Course, Task, TaskType } from '../lib/types';
import { CHECKLIST_CATEGORY_LABELS, TASK_TYPE_LABELS, COURSE_COLORS } from '../lib/types';
import { formatDate, todayISO, isValidISODate } from '../lib/dates';
import { Modal, ConfirmButton, Empty, Meter, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { uid } from '../lib/workspace';
import { pct } from '../lib/derive';
import { extractSuggestions, SAMPLE_SYLLABUS } from '../lib/extract';
import type { Suggestion } from '../lib/extract';
import { extractTextFromFile, SUPPORTED_FILES } from '../lib/fileImport';
import { navigate } from '../lib/router';

export function Checklist({ route }: { route: string }) {
  return route === 'checklist-import' ? <ImportFlow /> : <ChecklistView />;
}

function ChecklistView() {
  const { ws, update } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [editing, setEditing] = useState<Partial<ChecklistItem> | null>(null);
  const done = ws.checklist.filter((c) => c.done).length;
  const cats = Object.keys(CHECKLIST_CATEGORY_LABELS) as ChecklistCategory[];

  const save = (item: Omit<ChecklistItem, 'id' | 'createdAt' | 'done' | 'source'>) => {
    if (editing?.id) {
      update((w) => ({ ...w, checklist: w.checklist.map((c) => (c.id === editing.id ? { ...c, ...item } : c)) }));
      toast('Checklist item saved.');
    } else {
      update((w) => ({ ...w, checklist: [...w.checklist, { ...item, id: uid('chk'), done: false, source: 'manual', createdAt: new Date().toISOString() }] }));
      toast(`Added “${item.title}”.`);
    }
    setEditing(null);
  };
  const toggle = (c: ChecklistItem) => update((w) => ({ ...w, checklist: w.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>Program checklist</h1>
          <p className="lede">Your school’s own requirements — immunizations, clearances, certifications, orientation — in one place. You build it from your program’s official materials.</p>
        </div>
        <div className="actions">
          <a className="btn" href="#checklist-import"><Icon name="upload" />Import from syllabus or handbook</a>
          <button type="button" className="btn primary" onClick={() => setEditing({ category: 'health' })}><Icon name="plus" />Add item</button>
        </div>
      </header>

      <div className="banner info"><span className="grow">NursePath does not know your program’s requirements. Your student handbook, clinical coordinator, and official program website are the authority. Record where each item came from so you can check it again.</span></div>

      {ws.checklist.length > 0 && (
        <section className="panel">
          <div className="spread"><h2>Overall</h2><span className="num">{done} of {ws.checklist.length} complete</span></div>
          <Meter value={pct(done, ws.checklist.length)} label="Checklist complete" gold />
        </section>
      )}

      {ws.checklist.length === 0 ? (
        <Empty title="Your checklist is empty" action={<div className="actions"><button type="button" className="btn primary" onClick={() => setEditing({ category: 'health' })}>Add an item</button><a className="btn" href="#checklist-import">Import from text or a file</a></div>}>
          Add requirements one at a time, or paste text from your handbook and review the suggestions NursePath finds.
        </Empty>
      ) : (
        cats.map((cat) => {
          const items = ws.checklist.filter((c) => c.category === cat).sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || '9').localeCompare(b.dueDate || '9'));
          if (!items.length) return null;
          return (
            <section key={cat} className="panel" aria-labelledby={`h-${cat}`}>
              <div className="panel-head"><h2 id={`h-${cat}`}>{CHECKLIST_CATEGORY_LABELS[cat]}</h2><p>{items.filter((i) => i.done).length} of {items.length}</p></div>
              <ul className="list">
                {items.map((c) => (
                  <li key={c.id}>
                    <div className={`item${c.done ? ' done' : ''}`}>
                      <input type="checkbox" className="check" checked={c.done} onChange={() => toggle(c)} aria-label={`${c.done ? 'Reopen' : 'Check off'}: ${c.title}`} />
                      <div className="item-body">
                        <span className="item-title">{c.title}</span>
                        <span className="item-meta">
                          {c.dueDate && <span>Due {formatDate(c.dueDate)}</span>}
                          {c.sourceNote && <span>Source: {c.sourceNote}</span>}
                          {c.source === 'import' && <span className="pill">Imported · confirmed by you</span>}
                        </span>
                        {c.notes && <span className="item-why">{c.notes}</span>}
                      </div>
                      {!c.done && c.dueDate && c.dueDate < today && <span className="pill overdue">Past date</span>}
                      <button type="button" className="icon-btn" aria-label={`Edit ${c.title}`} onClick={() => setEditing(c)}><Icon name="edit" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Modal open={!!editing} title={editing?.id ? 'Edit checklist item' : 'Add checklist item'} onClose={() => setEditing(null)}
        footer={<>
          {editing?.id && <span className="left"><ConfirmButton label="Delete" icon="trash" confirmLabel="Delete" onConfirm={() => { update((w) => ({ ...w, checklist: w.checklist.filter((c) => c.id !== editing.id) })); setEditing(null); toast('Deleted.'); }} /></span>}
          <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
          <button type="submit" form="chk-form" className="btn primary">Save</button>
        </>}>
        {editing && <ChecklistForm key={editing.id ?? 'new'} initial={editing} onSubmit={save} />}
      </Modal>
    </>
  );
}

function ChecklistForm({ initial, onSubmit }: { initial: Partial<ChecklistItem>; onSubmit: (i: Omit<ChecklistItem, 'id' | 'createdAt' | 'done' | 'source'>) => void }) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [category, setCategory] = useState<ChecklistCategory>(initial.category ?? 'health');
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '');
  const [sourceNote, setSourceNote] = useState(initial.sourceNote ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setErr('Describe the requirement, for example “Upload TB screening result.”');
    if (dueDate && !isValidISODate(dueDate)) return setErr('Check the date.');
    onSubmit({ title: title.trim(), category, dueDate, sourceNote: sourceNote.trim(), notes: notes.trim(), sourceText: initial.sourceText });
  };
  return (
    <form id="chk-form" className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="k-title">Requirement</label>
        <input id="k-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!err} autoFocus />
        {err && <span className="error">{err}</span>}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="k-cat">Category</label>
          <select id="k-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as ChecklistCategory)}>
            {Object.entries(CHECKLIST_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="k-date">Deadline <span className="optional">optional</span></label>
          <input id="k-date" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="k-src">Where this requirement comes from <span className="optional">recommended</span></label>
        <input id="k-src" className="input" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="Student handbook, p. 12 (checked Aug 20)" />
      </div>
      <div className="field">
        <label htmlFor="k-notes">Notes <span className="optional">optional</span></label>
        <textarea id="k-notes" className="input" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {initial.sourceText && <div className="stack" style={{ gap: 6 }}><span className="label">Original text</span><div className="source-text">{initial.sourceText}</div></div>}
    </form>
  );
}

/* ================= Import & review ================= */

type Decision = 'pending' | 'accepted' | 'rejected';
interface Draft extends Suggestion {
  decision: Decision;
  courseRef: string; // existing course id, "sug:<id>", or ""
  estimatedHours: string;
}

function ImportFlow() {
  const { ws, update } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [fileMsg, setFileMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setLoading(true);
    setFileMsg(null);
    try {
      const t = await extractTextFromFile(f);
      setText(t);
      setFileMsg({ tone: 'ok', text: `Read ${t.length.toLocaleString()} characters from “${f.name}.” Check the text below, then find suggestions.` });
    } catch (e) {
      setFileMsg({ tone: 'error', text: (e as Error).message || 'This file could not be read. Paste the text instead.' });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const analyze = () => {
    const s = extractSuggestions(text);
    const byCode = (code?: string) => (code ? ws.courses.find((c) => c.code.replace(/\s/g, '').toUpperCase() === code.replace(/\s/g, '').toUpperCase()) : undefined);
    const courseSugs = s.filter((x) => x.kind === 'course');
    setDrafts(
      s
        .filter((x) => !(x.kind === 'course' && byCode(x.courseCode))) // course already saved
        .map((x) => {
          const existing = byCode(x.courseCode);
          const sug = courseSugs.find((c) => c.courseCode === x.courseCode && c.id !== x.id);
          return { ...x, decision: 'pending', courseRef: x.kind === 'course' ? '' : existing ? existing.id : sug ? `sug:${sug.id}` : '', estimatedHours: x.taskType === 'exam' ? '4' : x.taskType === 'quiz' ? '1.5' : '2' };
        }),
    );
  };

  const set = (id: string, patch: Partial<Draft>) => setDrafts((d) => d!.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const accepted = drafts?.filter((d) => d.decision === 'accepted') ?? [];
  const invalid = accepted.filter((d) => !d.title.trim() || (d.kind === 'task' && !isValidISODate(d.date)));

  const save = () => {
    if (!drafts || invalid.length) return;
    const now = new Date().toISOString();
    const newCourses: Record<string, Course> = {};
    accepted.filter((d) => d.kind === 'course').forEach((d, i) => {
      newCourses[`sug:${d.id}`] = { id: uid('crs'), name: d.title.trim(), code: d.courseCode ?? '', term: '', notes: '', color: COURSE_COLORS[(ws.courses.length + i) % COURSE_COLORS.length], stage: ws.profile.stage, createdAt: now };
    });
    const resolveCourse = (ref: string) => (ref.startsWith('sug:') ? newCourses[ref]?.id ?? null : ref || null);
    const tasks: Task[] = accepted.filter((d) => d.kind === 'task').map((d) => ({
      id: uid('tsk'), title: d.title.trim(), type: d.taskType ?? 'prep', courseId: resolveCourse(d.courseRef), dueDate: d.date, dueTime: '',
      estimatedMinutes: Math.max(15, Math.round((Number(d.estimatedHours) || 1) * 60 / 5) * 5), status: 'todo', completedAt: null, notes: '', topics: [], source: 'import', sourceText: d.sourceText, createdAt: now,
    }));
    const items: ChecklistItem[] = accepted.filter((d) => d.kind === 'checklist').map((d) => ({
      id: uid('chk'), title: d.title.trim(), category: d.category ?? 'other', dueDate: isValidISODate(d.date) ? d.date : '', done: false, notes: '', sourceNote: 'Imported from text you provided', sourceText: d.sourceText, source: 'import', createdAt: now,
    }));
    update((w) => ({ ...w, courses: [...w.courses, ...Object.values(newCourses)], tasks: [...w.tasks, ...tasks], checklist: [...w.checklist, ...items] }));
    toast(`Saved ${Object.keys(newCourses).length} course(s), ${tasks.length} task(s), and ${items.length} checklist item(s).`);
    navigate(items.length || !tasks.length ? 'checklist' : 'courses');
  };

  const acceptedCourseSugs = accepted.filter((d) => d.kind === 'course');

  return (
    <>
      <a href="#checklist" className="small row" style={{ gap: 6 }}><span style={{ width: 16, display: 'inline-flex' }}><Icon name="back" /></span>Program checklist</a>
      <header className="page-head">
        <div>
          <p className="eyebrow">Import</p>
          <h1>Find dates and requirements in your documents</h1>
          <p className="lede">Paste text from a syllabus or handbook, or open a file. NursePath suggests courses, deadlines, and checklist items. Nothing is saved until you review and accept each one.</p>
        </div>
      </header>

      {!drafts ? (
        <section className="panel">
          <div className="field">
            <label htmlFor="imp-text">Syllabus or handbook text</label>
            <textarea id="imp-text" className="input" style={{ minHeight: 260, fontFamily: 'var(--font-mono)', fontSize: '.85rem' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the course schedule, assignment list, or clinical requirements section here." />
            <span className="hint">Tip: the schedule table and the “clinical requirements” section usually have the most useful dates.</span>
          </div>
          <div className="row">
            <input ref={fileRef} id="imp-file" type="file" accept={SUPPORTED_FILES.accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <label htmlFor="imp-file" className="btn" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}><Icon name="upload" />{loading ? 'Reading file…' : 'Open a file'}</label>
            <button type="button" className="btn ghost" onClick={() => { setText(SAMPLE_SYLLABUS); setFileMsg(null); }}>Use the fictional sample syllabus</button>
          </div>
          <p className="tiny muted">Supported: {SUPPORTED_FILES.description} Scanned images and photos are not supported. Files are read inside your browser and are not uploaded or stored; only the items you accept are saved.</p>
          {fileMsg && <div className={`banner ${fileMsg.tone === 'error' ? 'danger' : 'info'}`} role={fileMsg.tone === 'error' ? 'alert' : 'status'}><span className="grow">{fileMsg.text}</span></div>}
          <div className="row"><button type="button" className="btn primary" onClick={analyze} disabled={!text.trim() || loading}>Find suggestions</button></div>
          <p className="tiny muted">Please remove any personal information about you or anyone else before pasting. Never paste patient information.</p>
        </section>
      ) : drafts.length === 0 ? (
        <Empty title="No dates or requirements were found" action={<button type="button" className="btn" onClick={() => setDrafts(null)}>Back to the text</button>}>
          NursePath looks for lines with dates (like “Sept 14” or “9/14”) near words like exam, quiz, due, immunization, or background check. Try pasting the schedule section, or add items by hand.
        </Empty>
      ) : (
        <>
          <div className="banner"><span className="grow"><strong>Review each suggestion.</strong> These were found by simple text rules and may be wrong or incomplete. Accept, correct, or reject each one. Undecided suggestions are not saved.</span></div>
          <div className="toolbar">
            <span className="small">{drafts.length} suggestions · <strong>{accepted.length} accepted</strong> · {drafts.filter((d) => d.decision === 'rejected').length} rejected</span>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setDrafts(null)}>Back to the text</button>
              <button type="button" className="btn primary" onClick={save} disabled={!accepted.length || invalid.length > 0}>Save {accepted.length} accepted item{accepted.length === 1 ? '' : 's'}</button>
            </div>
          </div>
          {invalid.length > 0 && <p className="error" role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{invalid.length} accepted item(s) need a title{invalid.some((d) => d.kind === 'task') ? ' and a valid date' : ''} before saving.</p>}
          <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {drafts.map((d) => (
              <li key={d.id} className={`review-item ${d.decision}`}>
                <div className="stack" style={{ gap: 12 }}>
                  <div className="row">
                    <span className={`pill ${d.confidence === 'high' ? 'ok' : d.confidence === 'medium' ? 'soon' : 'overdue'}`}>{d.confidence === 'high' ? 'Likely' : d.confidence === 'medium' ? 'Possible' : 'Uncertain'}</span>
                    {d.decision === 'accepted' && <span className="pill study">Accepted</span>}
                    {d.decision === 'rejected' && <span className="pill">Rejected</span>}
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor={`k-${d.id}`} className="tiny">Save as</label>
                      <select id={`k-${d.id}`} className="input" value={d.kind} onChange={(e) => set(d.id, { kind: e.target.value as Draft['kind'], taskType: d.taskType ?? 'prep', category: d.category ?? 'other' })}>
                        <option value="task">Assignment, exam, or task</option>
                        <option value="checklist">Program checklist item</option>
                        <option value="course">Course</option>
                      </select>
                    </div>
                    {d.kind === 'task' && (
                      <div className="field">
                        <label htmlFor={`ty-${d.id}`} className="tiny">Type</label>
                        <select id={`ty-${d.id}`} className="input" value={d.taskType} onChange={(e) => set(d.id, { taskType: e.target.value as TaskType })}>
                          {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    )}
                    {d.kind === 'checklist' && (
                      <div className="field">
                        <label htmlFor={`cat-${d.id}`} className="tiny">Category</label>
                        <select id={`cat-${d.id}`} className="input" value={d.category} onChange={(e) => set(d.id, { category: e.target.value as ChecklistCategory })}>
                          {Object.entries(CHECKLIST_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor={`t-${d.id}`} className="tiny">{d.kind === 'course' ? 'Course name' : 'Title'}</label>
                    <input id={`t-${d.id}`} className="input" value={d.title} onChange={(e) => set(d.id, { title: e.target.value })} />
                  </div>
                  {d.kind !== 'course' && (
                    <div className="form-row">
                      <div className="field">
                        <label htmlFor={`d-${d.id}`} className="tiny">Date{d.kind === 'checklist' ? ' (optional)' : ''}</label>
                        <input id={`d-${d.id}`} type="date" className="input" value={d.date} onChange={(e) => set(d.id, { date: e.target.value, yearInferred: false })} />
                        {d.yearInferred && <span className="hint" style={{ color: 'var(--warn)' }}>Year was guessed — please confirm.</span>}
                      </div>
                      {d.kind === 'task' && (
                        <>
                          <div className="field">
                            <label htmlFor={`c-${d.id}`} className="tiny">Course</label>
                            <select id={`c-${d.id}`} className="input" value={d.courseRef} onChange={(e) => set(d.id, { courseRef: e.target.value })}>
                              <option value="">No course</option>
                              {ws.courses.map((c) => <option key={c.id} value={c.id}>{c.code || c.name}</option>)}
                              {acceptedCourseSugs.map((c) => <option key={c.id} value={`sug:${c.id}`}>{c.courseCode || c.title} (new)</option>)}
                              {d.courseRef.startsWith('sug:') && !acceptedCourseSugs.some((c) => `sug:${c.id}` === d.courseRef) && <option value={d.courseRef}>Course suggestion (accept it to link)</option>}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`h-${d.id}`} className="tiny">Effort (hours)</label>
                            <input id={`h-${d.id}`} type="number" min="0.25" step="0.25" className="input" value={d.estimatedHours} onChange={(e) => set(d.id, { estimatedHours: e.target.value })} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <ul className="tiny muted" style={{ margin: 0, paddingLeft: 16 }}>{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                  <div className="actions">
                    <button type="button" className={`btn sm${d.decision === 'accepted' ? ' primary' : ''}`} aria-pressed={d.decision === 'accepted'} onClick={() => set(d.id, { decision: d.decision === 'accepted' ? 'pending' : 'accepted' })}><Icon name="check" />{d.decision === 'accepted' ? 'Accepted' : 'Accept'}</button>
                    <button type="button" className="btn sm ghost" aria-pressed={d.decision === 'rejected'} onClick={() => set(d.id, { decision: d.decision === 'rejected' ? 'pending' : 'rejected' })}>{d.decision === 'rejected' ? 'Undo reject' : 'Reject'}</button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <span className="tiny" style={{ fontWeight: 650, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Source text · line {d.lineNumber}</span>
                  <blockquote className="source-text" style={{ margin: 0 }}>{d.sourceText}</blockquote>
                </div>
              </li>
            ))}
          </ol>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn primary" onClick={save} disabled={!accepted.length || invalid.length > 0}>Save {accepted.length} accepted item{accepted.length === 1 ? '' : 's'}</button>
          </div>
        </>
      )}
    </>
  );
}
