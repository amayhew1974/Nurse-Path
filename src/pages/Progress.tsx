import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../lib/store';
import { todayISO, startOfWeek, addDays, formatDate, formatDuration } from '../lib/dates';
import { Empty, ConfirmButton, useToast } from '../components/ui';
import { uid } from '../lib/workspace';
import { findConceptForTopic } from '../content/concepts';
import type { TopicReflection } from '../lib/types';

const LABELS = ['Not yet', 'Shaky', 'Getting there', 'Fairly sure', 'Confident'];

export function Progress() {
  const { ws, update } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [newTopic, setNewTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [goalDate, setGoalDate] = useState('');

  // Last 4 weeks of completed study, from saved sessions.
  const thisWeek = startOfWeek(today);
  const weeks = [3, 2, 1, 0].map((n) => {
    const start = addDays(thisWeek, -7 * n);
    const end = addDays(start, 6);
    const done = ws.sessions.filter((s) => s.status === 'done' && s.date >= start && s.date <= end);
    return { start, minutes: done.reduce((m, s) => m + s.durationMinutes, 0), count: done.length };
  });
  const maxMin = Math.max(60, ...weeks.map((w) => w.minutes));
  const tasksDone = ws.tasks.filter((t) => t.status === 'done');

  const patchRefl = (id: string, p: Partial<TopicReflection>) => update((w) => ({ ...w, reflections: w.reflections.map((r) => (r.id === id ? { ...r, ...p, updatedAt: new Date().toISOString() } : r)) }));
  const addTopic = (e: FormEvent) => {
    e.preventDefault();
    const t = newTopic.trim();
    if (!t) return;
    if (ws.reflections.some((r) => r.topic.toLowerCase() === t.toLowerCase())) return toast('That topic is already on your list.');
    update((w) => ({ ...w, reflections: [...w.reflections, { id: uid('ref'), topic: t, confidence: 3, revisit: true, notes: '', updatedAt: new Date().toISOString() }] }));
    setNewTopic('');
    toast(`Added “${t}” to topics to revisit.`);
  };
  const addGoal = (e: FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    update((w) => ({ ...w, goals: [...w.goals, { id: uid('goal'), text: goal.trim(), targetDate: goalDate, done: false, createdAt: new Date().toISOString() }] }));
    setGoal(''); setGoalDate('');
    toast('Goal added.');
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Learn</p>
          <h1>Progress &amp; reflection</h1>
          <p className="lede">Three different kinds of information, kept separate on purpose: work you completed, how confident you feel, and practice quiz results.</p>
        </div>
      </header>
      <div className="banner info"><span className="grow">None of these measure clinical or professional competence. Competence is assessed by your faculty, clinical instructors, and licensing exams.</span></div>

      <div className="grid-3">
        <section className="panel" aria-labelledby="h-work">
          <div className="panel-head"><h2 id="h-work">Work completed</h2></div>
          <p className="tiny muted">From tasks and study sessions you marked done.</p>
          <div className="row" style={{ gap: 24 }}>
            <div className="stat"><span className="stat-value">{tasksDone.length}</span><span className="stat-label">tasks done</span></div>
            <div className="stat"><span className="stat-value">{ws.sessions.filter((s) => s.status === 'done').length}</span><span className="stat-label">study sessions</span></div>
          </div>
          <div className="stack" style={{ gap: 6 }} role="img" aria-label={`Study time completed, last four weeks: ${weeks.map((w) => `${formatDate(w.start, { month: 'short', day: 'numeric' })} ${formatDuration(w.minutes)}`).join(', ')}`}>
            {weeks.map((w) => (
              <div key={w.start} className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <span className="mono tiny muted" style={{ width: 52 }}>{formatDate(w.start, { month: 'short', day: 'numeric' })}</span>
                <div className="meter" style={{ flex: 1 }}><span style={{ width: `${(w.minutes / maxMin) * 100}%` }} /></div>
                <span className="mono tiny" style={{ width: 64, textAlign: 'right' }}>{formatDuration(w.minutes)}</span>
              </div>
            ))}
            <span className="tiny muted">Study time completed, by week</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="h-quiz" style={{ gridColumn: 'span 2' }}>
          <div className="panel-head"><h2 id="h-quiz">Practice quiz results</h2><a className="small" href="#learn">Practice</a></div>
          <p className="tiny muted">From the sample library quizzes. A study aid only.</p>
          {ws.quizAttempts.length === 0 ? (
            <Empty title="No quizzes taken yet">Open any concept in Explain It My Way and choose “Practice quiz.”</Empty>
          ) : (
            <ul className="list">
              {[...ws.quizAttempts].reverse().slice(0, 8).map((q) => (
                <li key={q.id}><div className="item">
                  <div className="item-body"><span className="item-title">{q.conceptTitle}</span><span className="item-meta">{formatDate(q.takenAt.slice(0, 10))}</span></div>
                  <span className="num">{q.correct}/{q.total}</span>
                  <a className="btn sm" href={`#learn-${q.conceptId}`}>Review</a>
                </div></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel" aria-labelledby="h-conf">
        <div className="panel-head"><h2 id="h-conf">Self-rated confidence &amp; topics to revisit</h2><p>Your own ratings. The planner adds review time for topics marked to revisit or rated 1–2.</p></div>
        {ws.reflections.length === 0 ? (
          <Empty title="No topics yet">Add a topic you want to keep an eye on. You can also rate your confidence at the bottom of any concept in Explain It My Way.</Empty>
        ) : (
          <ul className="list">
            {ws.reflections.map((r) => {
              const c = findConceptForTopic(r.topic);
              return (
                <li key={r.id}>
                  <div className="item" style={{ flexWrap: 'wrap' }}>
                    <div className="item-body" style={{ minWidth: 200 }}>
                      <span className="item-title">{r.topic}</span>
                      <span className="item-meta">Updated {formatDate(r.updatedAt.slice(0, 10))}{c && <> · <a href={`#learn-${c.id}`}>Explain it</a></>}</span>
                      <label className="sr-only" htmlFor={`rn-${r.id}`}>Notes for {r.topic}</label>
                      <input id={`rn-${r.id}`} className="input" style={{ minHeight: 32, fontSize: '.85rem', marginTop: 4 }} placeholder="Note to self (optional)" value={r.notes} onChange={(e) => patchRefl(r.id, { notes: e.target.value })} />
                    </div>
                    <div className="stack" style={{ gap: 6 }}>
                      <div className="field" style={{ minWidth: 190 }}>
                        <label className="tiny" htmlFor={`rc-${r.id}`}>Confidence</label>
                        <select id={`rc-${r.id}`} className="input" value={r.confidence} onChange={(e) => patchRefl(r.id, { confidence: Number(e.target.value) })}>
                          {LABELS.map((l, i) => <option key={l} value={i + 1}>{i + 1} · {l}</option>)}
                        </select>
                      </div>
                      <label className="row small"><input type="checkbox" checked={r.revisit} onChange={(e) => patchRefl(r.id, { revisit: e.target.checked })} /> Revisit</label>
                    </div>
                    <ConfirmButton label="Remove" confirmLabel="Remove" className="btn ghost sm" onConfirm={() => update((w) => ({ ...w, reflections: w.reflections.filter((x) => x.id !== r.id) }))} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <form className="row" onSubmit={addTopic} style={{ flexWrap: 'nowrap' }}>
          <label htmlFor="new-topic" className="sr-only">New topic to revisit</label>
          <input id="new-topic" className="input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Add a topic to revisit, e.g. acid–base balance" maxLength={80} />
          <button type="submit" className="btn" disabled={!newTopic.trim()}>Add topic</button>
        </form>
      </section>

      <section className="panel" aria-labelledby="h-goals">
        <div className="panel-head"><h2 id="h-goals">Personal learning goals</h2></div>
        {ws.goals.length === 0 ? (
          <Empty title="No goals yet">Write a goal in your own words, such as “Explain the chain of infection without notes by Friday.”</Empty>
        ) : (
          <ul className="list">
            {ws.goals.map((g) => (
              <li key={g.id}><div className={`item${g.done ? ' done' : ''}`}>
                <input type="checkbox" className="check" checked={g.done} onChange={() => update((w) => ({ ...w, goals: w.goals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)) }))} aria-label={`${g.done ? 'Reopen' : 'Complete'} goal: ${g.text}`} />
                <div className="item-body"><span className="item-title">{g.text}</span>{g.targetDate && <span className="item-meta">Target {formatDate(g.targetDate)}</span>}</div>
                <ConfirmButton label="Delete" confirmLabel="Delete" className="btn ghost sm" onConfirm={() => update((w) => ({ ...w, goals: w.goals.filter((x) => x.id !== g.id) }))} />
              </div></li>
            ))}
          </ul>
        )}
        <form className="form-row" onSubmit={addGoal} style={{ alignItems: 'end' }}>
          <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="goal-text">New goal</label><input id="goal-text" className="input" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={160} /></div>
          <div className="field"><label htmlFor="goal-date">Target date <span className="optional">optional</span></label><input id="goal-date" type="date" className="input" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} /></div>
          <button type="submit" className="btn primary" disabled={!goal.trim()}>Add goal</button>
        </form>
      </section>
    </>
  );
}
