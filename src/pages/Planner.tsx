import { useState } from 'react';
import { useStore } from '../lib/store';
import type { StudySession } from '../lib/types';
import { todayISO, startOfWeek, addDays, weekDates, formatDate, formatTime, formatDuration, WEEKDAY_NAMES, weekday, toMinutes } from '../lib/dates';
import { planWeek, capacityFor, availableMinutesOn, checkSession, findNextSlot, PLANNER_RULES, weeklyAvailableMinutes } from '../lib/planner';
import type { Unplaced } from '../lib/planner';
import { Modal, Empty, Meter, useToast } from '../components/ui';
import { SessionForm } from '../components/forms';
import type { SessionDraft, SessionCheckResult } from '../components/forms';
import { Icon } from '../components/Icon';
import { uid } from '../lib/workspace';
import { courseOf } from '../components/TaskBits';

export function Planner() {
  const { ws, update } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [unplaced, setUnplaced] = useState<Unplaced[] | null>(null);
  const [editing, setEditing] = useState<Partial<StudySession> | null>(null);
  const [showRules, setShowRules] = useState(false);

  const days = weekDates(weekStart);
  const weekEnd = days[6];
  const cap = capacityFor(ws, weekStart, unplaced ?? []);
  const hasAvailability = weeklyAvailableMinutes(ws.profile.availability) > 0;
  const weekSessions = ws.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd);
  const isPastWeek = weekEnd < today;

  const build = () => {
    const r = planWeek(ws, weekStart, today);
    update((w) => ({ ...w, sessions: r.sessions }));
    setUnplaced(r.unplaced);
    const added = r.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd).length;
    toast(r.unplaced.length ? `Planned ${added} sessions. Some work did not fit — see the warning.` : `Planned ${added} sessions for this week.`);
  };

  const patch = (id: string, p: Partial<StudySession>, msg: string) => {
    update((w) => ({ ...w, sessions: w.sessions.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
    toast(msg);
  };
  const remove = (s: StudySession) => {
    update((w) => ({ ...w, sessions: w.sessions.filter((x) => x.id !== s.id) }));
    toast('Session removed.');
  };
  const pushNext = (s: StudySession) => {
    const from = s.date >= today ? addDays(s.date, 1) : today;
    const slot = findNextSlot(ws, from, s.durationMinutes, s.id);
    if (!slot) return toast('No open time in the next two weeks fits this session. Shorten it or add availability.');
    patch(s.id, { ...slot, pinned: true, status: 'planned' }, `Moved to ${formatDate(slot.date)} at ${formatTime(slot.start)}.`);
  };
  const shorten = (s: StudySession) => {
    if (s.durationMinutes <= 15) return;
    patch(s.id, { durationMinutes: Math.max(15, s.durationMinutes - 15), pinned: true }, `Shortened to ${Math.max(15, s.durationMinutes - 15)} minutes.`);
  };

  const check = (d: SessionDraft): SessionCheckResult => {
    const c = checkSession(ws, { id: editing?.id, ...d });
    if (c.overlap) return { error: `It overlaps “${c.overlap.topic}” at ${formatTime(c.overlap.start)}. Choose another time.`, warnings: [] };
    const warnings: string[] = [];
    if (c.outsideAvailability) warnings.push('This time is outside the study availability you set.');
    if (c.dayOverCapacity) warnings.push(`This puts ${WEEKDAY_NAMES[weekday(d.date)]} over your available study time.`);
    const ws2 = { ...ws, sessions: [...ws.sessions.filter((s) => s.id !== editing?.id), { ...d, id: 'x', taskId: null, reason: '', status: 'planned' as const, origin: 'manual' as const, pinned: true }] };
    const wk = capacityFor(ws2, startOfWeek(d.date));
    if (wk.scheduledMinutes > wk.availableMinutes) warnings.push(`That week would have ${formatDuration(wk.scheduledMinutes)} scheduled but only ${formatDuration(wk.availableMinutes)} available.`);
    return { warnings };
  };

  const saveSession = (d: SessionDraft) => {
    if (editing?.id) {
      patch(editing.id, { ...d, pinned: true }, 'Session updated. The planner will keep it where you put it.');
    } else {
      const s: StudySession = { ...d, id: uid('ses'), taskId: null, reason: 'You added this session yourself.', status: 'planned', origin: 'manual', pinned: true };
      update((w) => ({ ...w, sessions: [...w.sessions, s] }));
      toast('Session added.');
    }
    setEditing(null);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>Study planner</h1>
          <p className="lede">A weekly plan built from your availability, deadlines, effort estimates, and challenging topics. Every session says why it is there.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setEditing({ date: weekStart > today ? weekStart : today, durationMinutes: 45 })}><Icon name="plus" />Add session</button>
          <button type="button" className="btn primary" onClick={build} disabled={!hasAvailability || isPastWeek}><Icon name="spark" />{weekSessions.some((s) => s.origin === 'planner') ? 'Refresh plan' : 'Build plan'}</button>
        </div>
      </header>

      <div className="toolbar">
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => { setWeekStart(addDays(weekStart, -7)); setUnplaced(null); }} aria-label="Previous week"><Icon name="chevL" /></button>
          <h2 aria-live="polite" style={{ fontSize: '1.15rem' }}>Week of {formatDate(weekStart, { month: 'long', day: 'numeric' })}</h2>
          <button type="button" className="icon-btn" onClick={() => { setWeekStart(addDays(weekStart, 7)); setUnplaced(null); }} aria-label="Next week"><Icon name="chevR" /></button>
          {weekStart !== startOfWeek(today) && <button type="button" className="btn sm" onClick={() => { setWeekStart(startOfWeek(today)); setUnplaced(null); }}>This week</button>}
        </div>
        <button type="button" className="btn sm ghost" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}><Icon name="info" />How the planner decides</button>
      </div>

      {showRules && (
        <section className="panel quiet" aria-label="Planner rules">
          <h3>The planner follows these rules — no AI involved</h3>
          <ol className="small" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{PLANNER_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
          <p className="tiny muted">Refreshing replaces only sessions the planner created that you have not touched. Anything you moved, shortened, added, completed, or skipped stays.</p>
        </section>
      )}

      {!hasAvailability ? (
        <Empty title="Tell NursePath when you can study" action={<a href="#preferences" className="btn primary">Set weekly availability</a>}>
          The planner only schedules sessions inside times you say you are available, so it needs that first.
        </Empty>
      ) : (
        <>
          <section className="panel" aria-label="Weekly capacity">
            <div className="spread">
              <span className="small"><strong>{formatDuration(cap.scheduledMinutes)}</strong> scheduled of <strong>{formatDuration(cap.availableMinutes)}</strong> available this week</span>
              <span className={`pill ${cap.overCapacity ? 'overdue' : 'ok'}`}>{cap.overCapacity ? 'Over capacity' : 'Within your availability'}</span>
            </div>
            <Meter value={cap.availableMinutes ? (cap.scheduledMinutes / cap.availableMinutes) * 100 : 0} label="Share of available study time scheduled" />
            {unplaced && unplaced.length > 0 && (
              <div className="banner danger" role="alert">
                <div className="grow stack" style={{ gap: 6 }}>
                  <strong>Capacity warning: not everything fits this week.</strong>
                  <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                    {unplaced.map((u) => <li key={u.label}>{u.label}: about {formatDuration(u.minutesShort)} still needed. {u.reason}</li>)}
                  </ul>
                  <span className="small">Options: add study time in Profile &amp; data, lower the effort estimate, or talk with your instructor about priorities. NursePath will not overbook you.</span>
                </div>
              </div>
            )}
            {weekSessions.length === 0 && !isPastWeek && <p className="small muted">No sessions this week yet. Select <strong>Build plan</strong> to create them from your deadlines and topics.</p>}
          </section>

          <div className="week">
            {days.map((d) => {
              const sessions = weekSessions.filter((s) => s.date === d).sort((a, b) => a.start.localeCompare(b.start));
              const used = sessions.filter((s) => s.status !== 'skipped').reduce((n, s) => n + s.durationMinutes, 0);
              const avail = availableMinutesOn(ws.profile.availability, d);
              const blocks = ws.profile.availability[weekday(d)];
              return (
                <section key={d} className={`day-col${d === today ? ' today' : ''}${d < today ? ' past' : ''}`} aria-label={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}>
                  <div className="day-head">
                    <strong>{formatDate(d, { weekday: 'short', day: 'numeric' })}</strong>
                    <span className={`day-cap${used > avail ? ' over' : ''}`}>{used}/{avail} min</span>
                  </div>
                  <span className="avail">{blocks.length ? blocks.map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`).join(', ') : 'No study time set'}</span>
                  {sessions.map((s) => {
                    const c = courseOf(ws, s.courseId);
                    const outside = !blocks.some((b) => toMinutes(s.start) >= toMinutes(b.start) && toMinutes(s.start) + s.durationMinutes <= toMinutes(b.end));
                    return (
                      <article key={s.id} className={`session c-${c?.color ?? 'teal'} ${s.status}`}>
                        <span className="s-time">{formatTime(s.start)} · {s.durationMinutes} min{s.status === 'done' ? ' · done' : s.status === 'skipped' ? ' · skipped' : ''}</span>
                        <span className="s-topic">{s.topic}</span>
                        <span className="s-why clamp" title={s.reason}>{s.reason}</span>
                        {outside && s.status === 'planned' && <span className="s-why" style={{ color: 'var(--warn)', fontWeight: 600 }}>Outside your availability</span>}
                        {s.pinned && s.origin === 'planner' && <span className="s-why">Adjusted by you · kept on refresh</span>}
                        <div className="s-actions">
                          {s.status === 'planned' ? (
                            <>
                              <button type="button" onClick={() => patch(s.id, { status: 'done' }, 'Session completed.')} aria-label={`Mark done: ${s.topic}`}>Done</button>
                              <button type="button" onClick={() => setEditing(s)} aria-label={`Move or edit: ${s.topic}`}>Move</button>
                              {s.durationMinutes > 15 && <button type="button" onClick={() => shorten(s)} aria-label={`Shorten by 15 minutes: ${s.topic}`}>−15m</button>}
                              <button type="button" onClick={() => pushNext(s)} aria-label={`Reschedule to next open time: ${s.topic}`}>Later</button>
                              <button type="button" onClick={() => patch(s.id, { status: 'skipped', pinned: true }, 'Session skipped.')} aria-label={`Skip: ${s.topic}`}>Skip</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => patch(s.id, { status: 'planned' }, 'Session set back to planned.')} aria-label={`Undo: ${s.topic}`}>Undo</button>
                          )}
                          <button type="button" onClick={() => remove(s)} aria-label={`Remove: ${s.topic}`}>Remove</button>
                        </div>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!editing} title={editing?.id ? 'Move or edit session' : 'Add a study session'} onClose={() => setEditing(null)}
        footer={<><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button><button type="submit" form="ses-form" className="btn primary">Save</button></>}>
        {editing && <SessionForm key={editing.id ?? 'new'} formId="ses-form" initial={editing} courses={ws.courses} onSubmit={saveSession} check={check} />}
      </Modal>
    </>
  );
}
