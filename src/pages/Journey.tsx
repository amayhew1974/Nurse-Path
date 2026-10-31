import { useStore } from '../lib/store';
import { STAGES, stageById } from '../content/stages';
import type { StageId } from '../lib/types';
import { stageProgress, pct } from '../lib/derive';
import { todayISO } from '../lib/dates';
import { useToast } from '../components/ui';
import { Icon } from '../components/Icon';

export function JourneyRoute({ compact }: { compact?: boolean }) {
  const { ws } = useStore();
  const current = stageById(ws.profile.stage);
  const prog = stageProgress(ws, todayISO());
  const p = prog.programPercent ?? (prog.tasksTotal ? pct(prog.tasksDone, prog.tasksTotal) : 15);
  return (
    <ol className="route" aria-label="Your nursing journey" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {STAGES.map((s) => {
        const state = s.order < current.order ? 'past' : s.order === current.order ? 'current' : 'future';
        return (
          <li key={s.id} style={{ display: 'contents' }}>
            <a href={`#journey-${s.id}`} className={`route-step ${state}`} style={{ ['--p' as string]: `${Math.max(8, Math.min(92, p))}%` }} aria-current={state === 'current' ? 'step' : undefined}>
              <div className="route-line"><span className="route-node" /></div>
              <div className="stack" style={{ gap: 2 }}>
                <span className="route-title">{compact ? s.short : s.title}</span>
                <span className="route-sub">{state === 'current' ? 'You are here' : state === 'past' ? 'Review' : s.availability === 'full' ? 'Available' : 'Preview'}</span>
              </div>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function Journey({ route }: { route: string }) {
  const stageId = route.replace(/^journey-?/, '') as StageId;
  const stage = STAGES.find((s) => s.id === stageId);
  return stage ? <StageDetail id={stage.id} /> : <Overview />;
}

function Overview() {
  const { ws } = useStore();
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">My journey</p>
          <h1>From first prerequisite to first nursing job</h1>
          <p className="lede">Your goals, courses, and deadlines carry forward as you move through each stage. Open any stage to review it, or change which stage you are in.</p>
        </div>
      </header>
      <section className="panel"><JourneyRoute /></section>
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {STAGES.map((s) => (
          <a key={s.id} href={`#journey-${s.id}`} className="concept-card">
            <span className="cat">Stage {s.order}{ws.profile.stage === s.id ? ' · You are here' : ''}</span>
            <h3>{s.title}</h3>
            <p>{s.purpose}</p>
            <span className={`pill ${s.availability === 'full' ? 'ok' : 'planned'}`} style={{ alignSelf: 'flex-start' }}>
              {s.availability === 'full' ? 'Fully available' : `${s.features.filter((f) => f.status === 'available').length} tools available · more planned`}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

function StageDetail({ id }: { id: StageId }) {
  const { ws, update } = useStore();
  const toast = useToast();
  const s = stageById(id);
  const isCurrent = ws.profile.stage === id;
  const courseCount = ws.courses.filter((c) => c.stage === id).length;
  return (
    <>
      <a href="#journey" className="small row" style={{ gap: 6 }}><span style={{ width: 16, display: 'inline-flex' }}><Icon name="back" /></span>All stages</a>
      <header className="page-head">
        <div>
          <p className="eyebrow">Stage {s.order} of 4{isCurrent ? ' · You are here' : ''}</p>
          <h1>{s.title}</h1>
          <p className="lede">{s.purpose}</p>
        </div>
        {!isCurrent && (
          <button type="button" className="btn" onClick={() => { update((w) => ({ ...w, profile: { ...w.profile, stage: id } })); toast(`Your current stage is now “${s.title}.” Nothing else changed.`); }}>
            Make this my current stage
          </button>
        )}
      </header>
      {s.availability === 'preview' && (
        <div className="banner info"><span className="grow"><strong>Preview stage.</strong> Some tools below already work for this stage. Items marked “Planned” are not built yet and have no buttons.</span></div>
      )}
      <section className="panel" aria-labelledby="h-feat">
        <h2 id="h-feat">What NursePath offers here</h2>
        <ul className="list">
          {s.features.map((f) => (
            <li key={f.name}>
              <div className="item">
                <div className="item-body">
                  <span className="item-title">{f.name}</span>
                  <span className="item-why">{f.detail}</span>
                </div>
                {f.status === 'available' && f.route ? (
                  <a className="btn sm" href={`#${f.route}`}>Open</a>
                ) : (
                  <span className="pill planned">Planned · not yet available</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {courseCount > 0 && <p className="small muted">You have {courseCount} course{courseCount === 1 ? '' : 's'} assigned to this stage.</p>}
      </section>
      <div className="grid-2">
        <section className="panel quiet">
          <h2>Good to know</h2>
          <ul className="stack" style={{ margin: 0, paddingLeft: 18, gap: 8 }}>
            {s.guidance.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </section>
        <section className="panel quiet">
          <h2>Official sources to check</h2>
          <ul className="stack" style={{ margin: 0, paddingLeft: 18, gap: 8 }}>
            {s.officialSources.map((o) => <li key={o.label}><strong>{o.label}.</strong> {o.note}</li>)}
          </ul>
          <p className="tiny muted">NursePath does not copy requirements from these sources. When requirements are added in a later version, each will show its jurisdiction, a link, and the date it was verified.</p>
        </section>
      </div>
    </>
  );
}
