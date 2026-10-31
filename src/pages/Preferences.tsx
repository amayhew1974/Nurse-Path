import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../lib/store';
import type { Pathway, StageId, Workspace } from '../lib/types';
import { TASK_TYPE_LABELS } from '../lib/types';
import { AvailabilityEditor } from '../components/forms';
import { TopicInput, ConfirmButton, useToast } from '../components/ui';
import { STAGES } from '../content/stages';
import { TOPIC_SUGGESTIONS } from './Onboarding';
import { normalizeWorkspace } from '../lib/workspace';
import { navigate } from '../lib/router';
import { Icon } from '../components/Icon';

function exportPayload(ws: Workspace) {
  return JSON.stringify({ app: 'NursePath', exportedAt: new Date().toISOString(), note: 'Personal NursePath data export. Keep it private.', workspace: ws }, null, 2);
}

function csvOfTasks(ws: Workspace) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['Title', 'Type', 'Course', 'Due date', 'Due time', 'Estimated minutes', 'Status'].map(esc).join(',')];
  for (const t of ws.tasks) {
    const c = ws.courses.find((x) => x.id === t.courseId);
    rows.push([t.title, TASK_TYPE_LABELS[t.type], c ? c.code || c.name : '', t.dueDate, t.dueTime, String(t.estimatedMinutes), t.status === 'done' ? 'Done' : 'Not done'].map(esc).join(','));
  }
  return rows.join('\n');
}

function download(name: string, text: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export function Preferences() {
  const { ws, update, mode, enterDemo, resetDemo, deletePersonalData, replacePersonal } = useStore();
  const toast = useToast();
  const p = ws.profile;
  const [name, setName] = useState(p.preferredName);
  const [pathway, setPathway] = useState<Pathway>(p.pathway);
  const [stage, setStage] = useState<StageId>(p.stage);
  const [school, setSchool] = useState(p.schoolName);
  const [program, setProgram] = useState(p.programName);
  const [start, setStart] = useState(p.programStart);
  const [grad, setGrad] = useState(p.anticipatedGraduation);
  const [topics, setTopics] = useState(p.challengingTopics);
  const [err, setErr] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (start && grad && grad <= start) return setErr('Anticipated graduation should be after your program start date.');
    setErr(null);
    update((w) => ({ ...w, profile: { ...w.profile, preferredName: name.trim(), pathway, stage, schoolName: school.trim(), programName: program.trim(), programStart: start, anticipatedGraduation: grad, challengingTopics: topics } }));
    toast('Profile saved.');
  };

  const doExport = (kind: 'json' | 'csv') => {
    const stamp = new Date().toISOString().slice(0, 10);
    const text = kind === 'json' ? exportPayload(ws) : csvOfTasks(ws);
    const ok = download(`nursepath-${mode === 'demo' ? 'demo-' : ''}${kind === 'json' ? 'backup' : 'deadlines'}-${stamp}.${kind}`, text, kind === 'json' ? 'application/json' : 'text/csv');
    setExportText(text);
    toast(ok ? 'Export started. If no file appeared, copy the text below.' : 'Your browser blocked the download. Copy the text below instead.');
  };
  const copyExport = async () => {
    try { await navigator.clipboard.writeText(exportText ?? ''); toast('Copied.'); }
    catch { (document.getElementById('export-text') as HTMLTextAreaElement | null)?.select(); toast('Select-all done. Press Ctrl+C or ⌘+C to copy.'); }
  };

  const onImportFile = async (f: File | undefined) => {
    if (!f) return;
    setImportMsg(null);
    try {
      const ws2 = normalizeWorkspace(JSON.parse(await f.text()), 'personal');
      setPendingImport(ws2);
      setImportMsg({ tone: 'ok', text: `This backup has ${ws2.courses.length} courses, ${ws2.tasks.length} tasks, and ${ws2.checklist.length} checklist items. Restoring replaces your current personal data.` });
    } catch (e) {
      setImportMsg({ tone: 'error', text: e instanceof SyntaxError ? 'This file is not valid JSON. Choose a file exported from NursePath.' : (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">You</p>
          <h1>Profile &amp; data</h1>
          <p className="lede">Change your answers from setup, your study times, and how your data is kept.</p>
        </div>
      </header>

      <div className="grid-2">
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel" aria-labelledby="h-prof">
            <h2 id="h-prof">Profile</h2>
            <form className="form" onSubmit={saveProfile} noValidate>
              <div className="form-row">
                <div className="field"><label htmlFor="p-name">Preferred name <span className="optional">optional</span></label><input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
                <div className="field"><label htmlFor="p-path">Pathway</label>
                  <select id="p-path" className="input" value={pathway} onChange={(e) => setPathway(e.target.value as Pathway)}>
                    <option value="ADN">ADN</option><option value="BSN">BSN</option><option value="undecided">Not sure yet</option>
                  </select>
                </div>
                <div className="field"><label htmlFor="p-stage">Current stage</label>
                  <select id="p-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value as StageId)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
                </div>
              </div>
              <div className="form-row">
                <div className="field"><label htmlFor="p-school">School <span className="optional">optional</span></label><input id="p-school" className="input" value={school} onChange={(e) => setSchool(e.target.value)} /></div>
                <div className="field"><label htmlFor="p-prog">Program <span className="optional">optional</span></label><input id="p-prog" className="input" value={program} onChange={(e) => setProgram(e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label htmlFor="p-start">Program start <span className="optional">optional</span></label><input id="p-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div className="field"><label htmlFor="p-grad">Anticipated graduation <span className="optional">optional</span></label><input id="p-grad" type="date" className="input" value={grad} onChange={(e) => setGrad(e.target.value)} aria-invalid={!!err} /></div>
              </div>
              <div className="field"><label htmlFor="p-topics">Challenging subjects</label><TopicInput id="p-topics" value={topics} onChange={setTopics} suggestions={TOPIC_SUGGESTIONS.slice(0, 6)} /></div>
              {err && <p className="error" role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>{err}</p>}
              <button type="submit" className="btn primary" style={{ alignSelf: 'flex-start' }}>Save profile</button>
            </form>
          </section>

          <section className="panel" aria-labelledby="h-avail">
            <div className="panel-head"><h2 id="h-avail">Weekly study availability</h2><p>Saved as you change it</p></div>
            <AvailabilityEditor value={ws.profile.availability} onChange={(av) => { update((w) => ({ ...w, profile: { ...w.profile, availability: av } })); toast('Availability saved. Refresh your plan in the Study planner to use it.'); }} />
          </section>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="panel" aria-labelledby="h-where">
            <h2 id="h-where">Where your data lives</h2>
            <p className="small">NursePath saves everything in <strong>this web browser on this device</strong> (browser “local storage”). There is no account and no NursePath server storing your records.</p>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              <li>It survives refreshes and restarts of this browser.</li>
              <li>It does not sync to your phone or other computers.</li>
              <li>Clearing your browser’s site data erases it, so export a backup now and then.</li>
              <li>The demo student is stored separately and never mixes with your data.</li>
              <li>Files you import are read in the browser and not kept; only items you accept are saved.</li>
            </ul>
          </section>

          <section className="panel" aria-labelledby="h-export">
            <h2 id="h-export">Export {mode === 'demo' ? 'demo ' : ''}data</h2>
            <div className="actions">
              <button type="button" className="btn" onClick={() => doExport('json')}><Icon name="download" />Full backup (JSON)</button>
              <button type="button" className="btn" onClick={() => doExport('csv')}><Icon name="download" />Deadlines (CSV for spreadsheets)</button>
            </div>
            {exportText !== null && (
              <div className="stack" style={{ gap: 8 }}>
                <label htmlFor="export-text" className="label">Export text</label>
                <textarea id="export-text" className="input" readOnly value={exportText} style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', minHeight: 140 }} />
                <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={copyExport}>Copy to clipboard</button>
              </div>
            )}
          </section>

          {mode === 'personal' && (
            <section className="panel" aria-labelledby="h-restore">
              <h2 id="h-restore">Restore from a backup</h2>
              <input ref={fileRef} id="restore-file" type="file" accept=".json,application/json" className="sr-only" onChange={(e) => onImportFile(e.target.files?.[0])} />
              <label htmlFor="restore-file" className="btn" style={{ alignSelf: 'flex-start' }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}><Icon name="upload" />Choose backup file</label>
              {importMsg && <div className={`banner ${importMsg.tone === 'error' ? 'danger' : 'info'}`} role={importMsg.tone === 'error' ? 'alert' : 'status'}><span className="grow">{importMsg.text}</span></div>}
              {pendingImport && (
                <div className="actions">
                  <ConfirmButton label="Restore this backup" className="btn primary sm" confirmLabel="Replace my data" prompt="Your current personal data will be replaced." onConfirm={() => { replacePersonal(pendingImport); setPendingImport(null); setImportMsg(null); toast('Backup restored.'); }} />
                  <button type="button" className="btn sm" onClick={() => { setPendingImport(null); setImportMsg(null); }}>Cancel</button>
                </div>
              )}
            </section>
          )}

          <section className="panel" aria-labelledby="h-demo">
            <h2 id="h-demo">Demo student</h2>
            <p className="small">Explore NursePath with a fictional first-semester student. Resetting the demo restores it to the original example with fresh dates. It never changes your own data.</p>
            <div className="actions">
              {mode === 'personal' && <button type="button" className="btn" onClick={() => { enterDemo(); navigate('today'); }}>Explore the demo</button>}
              <ConfirmButton label="Reset demo" className="btn sm" confirmLabel="Reset demo" onConfirm={() => { resetDemo(); toast('Demo reset. Your own data was not changed.'); }} />
            </div>
          </section>

          <section className="panel" aria-labelledby="h-del" style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--line))' }}>
            <h2 id="h-del">Delete my data</h2>
            <p className="small">Permanently removes your personal NursePath data from this browser: profile, courses, tasks, checklist, study plan, reflections, and goals. This cannot be undone. Export a backup first if you might want it later.</p>
            <ConfirmButton label="Delete all my data" icon="trash" confirmLabel="Yes, delete everything" prompt="Are you sure?" onConfirm={() => { deletePersonalData(); navigate('welcome'); toast('Your data was deleted from this browser.'); }} />
          </section>

          <p className="tiny muted">NursePath is an independent educational and organizational tool. It is not affiliated with, or endorsed by, any school, board of nursing, or testing organization. It does not provide medical advice.</p>
        </div>
      </div>
    </>
  );
}
