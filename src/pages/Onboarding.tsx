import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { navigate } from '../lib/router';
import type { Pathway, StageId, WeeklyAvailability, Course } from '../lib/types';
import { COURSE_COLORS } from '../lib/types';
import { AvailabilityEditor } from '../components/forms';
import { TopicInput } from '../components/ui';
import { BrandMark } from '../components/Icon';
import { STAGES } from '../content/stages';
import { uid } from '../lib/workspace';

export const TOPIC_SUGGESTIONS = [
  'Fluid and electrolyte balance', 'Pharmacology terminology', 'Prioritization questions', 'Nursing process', 'Infection prevention',
  'Therapeutic communication', 'Vital signs', 'Care plans', 'Dosage calculation', 'Pathophysiology', 'Test-taking strategies',
];

const STEPS = ['About you', 'Your program', 'Current courses', 'Study time', 'Challenging subjects'];

export function Onboarding() {
  const { mode, exitDemo } = useStore();
  // Onboarding always edits personal data, never the demo.
  useEffect(() => { if (mode === 'demo') exitDemo(); }, [mode, exitDemo]);
  return mode === 'demo' ? null : <OnboardingForm />;
}

function OnboardingForm() {
  const { ws, update } = useStore();

  const p = ws.profile;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(p.preferredName);
  const [pathway, setPathway] = useState<Pathway>(p.pathway);
  const [stage, setStage] = useState<StageId>(p.stage);
  const [school, setSchool] = useState(p.schoolName);
  const [program, setProgram] = useState(p.programName);
  const [start, setStart] = useState(p.programStart);
  const [grad, setGrad] = useState(p.anticipatedGraduation);
  const [courses, setCourses] = useState<{ code: string; name: string }[]>(
    ws.courses.length ? [] : [{ code: '', name: '' }],
  );
  const [availability, setAvailability] = useState<WeeklyAvailability>(p.availability);
  const [topics, setTopics] = useState<string[]>(p.challengingTopics);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (start && grad && grad <= start) {
      setError('Anticipated graduation should be after your program start date.');
      return false;
    }
    setError(null);
    return true;
  };
  const next = () => { if (validate()) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  const finish = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const newCourses: Course[] = courses
      .filter((c) => c.name.trim() || c.code.trim())
      .map((c, i) => ({
        id: uid('crs'), name: c.name.trim() || c.code.trim(), code: c.code.trim(), term: '', notes: '',
        color: COURSE_COLORS[(ws.courses.length + i) % COURSE_COLORS.length], stage, createdAt: now,
      }));
    update((w) => ({
      ...w,
      profile: {
        ...w.profile,
        preferredName: name.trim(), pathway, stage, schoolName: school.trim(), programName: program.trim(),
        programStart: start, anticipatedGraduation: grad, availability, challengingTopics: topics,
        onboardedAt: w.profile.onboardedAt ?? now,
      },
      courses: [...w.courses, ...newCourses],
    }));
    navigate(stage === 'nursing' ? 'today' : `journey-${stage}`);
  };

  return (
    <div className="onboard">
      <div className="onboard-top">
        <div className="row" style={{ gap: 10 }}><BrandMark /><span className="brand-name" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#fff' }}>NursePath</span></div>
        <a href="#welcome" className="btn sm" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>Cancel</a>
      </div>
      <main className="onboard-card" id="main">
        <div className="stack" style={{ gap: 10 }}>
          <div className="stepper" aria-hidden="true">{STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div>
          <p className="eyebrow">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
        </div>

        {step === 0 && (
          <section className="stack" style={{ gap: 20 }} aria-labelledby="ob-h">
            <h1 id="ob-h">Let’s set up your plan.</h1>
            <p className="muted">Everything here is optional and can be changed later. Please don’t enter identifiers like your student ID or Social Security number — NursePath doesn’t need them.</p>
            <div className="field">
              <label htmlFor="ob-name">What should we call you? <span className="optional">optional</span></label>
              <input id="ob-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Preferred name" maxLength={40} />
            </div>
            <fieldset>
              <legend>Which pathway are you on?</legend>
              <div className="radio-cards">
                {([['ADN', 'Associate Degree in Nursing', 'Usually 2–3 years, often at a community college'], ['BSN', 'Bachelor of Science in Nursing', 'Usually 4 years, or an accelerated option'], ['undecided', 'Not sure yet', 'You can choose later']] as const).map(([v, t, s]) => (
                  <label className="radio-card" key={v}>
                    <input type="radio" name="pathway" value={v} checked={pathway === v} onChange={() => setPathway(v)} />
                    <strong>{v === 'undecided' ? t : `${v}`}</strong>
                    <span>{v === 'undecided' ? s : `${t}. ${s}.`}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="stack" style={{ gap: 20 }}>
            <h1>Where are you right now?</h1>
            <fieldset>
              <legend>Current stage</legend>
              <div className="radio-cards">
                {STAGES.map((s) => (
                  <label className="radio-card" key={s.id}>
                    <input type="radio" name="stage" value={s.id} checked={stage === s.id} onChange={() => setStage(s.id)} />
                    <strong>{s.title}</strong>
                    <span>{s.availability === 'full' ? 'Full tools available' : 'Preview: some tools available'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-row">
              <div className="field">
                <label htmlFor="ob-school">School <span className="optional">optional</span></label>
                <input id="ob-school" className="input" value={school} onChange={(e) => setSchool(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-program">Program <span className="optional">optional</span></label>
                <input id="ob-program" className="input" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. Traditional BSN" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="ob-start">Program start date <span className="optional">optional</span></label>
                <input id="ob-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ob-grad">Anticipated graduation <span className="optional">optional</span></label>
                <input id="ob-grad" type="date" className="input" value={grad} onChange={(e) => setGrad(e.target.value)} aria-invalid={!!error} />
              </div>
            </div>
            <p className="small muted">NursePath doesn’t look up your school’s requirements. You add those yourself from official sources, so nothing is assumed about your program.</p>
          </section>
        )}

        {step === 2 && (
          <section className="stack" style={{ gap: 16 }}>
            <h1>What are you taking this term?</h1>
            <p className="muted">Add as many as you like. You can add assignments and exams to each course later, or import them from a syllabus.</p>
            {ws.courses.length > 0 && <p className="small">You already have {ws.courses.length} course{ws.courses.length === 1 ? '' : 's'} saved. New ones below will be added.</p>}
            {courses.map((c, i) => (
              <div className="form-row" key={i} style={{ alignItems: 'end' }}>
                <div className="field">
                  <label htmlFor={`ob-cc-${i}`}>Course code <span className="optional">optional</span></label>
                  <input id={`ob-cc-${i}`} className="input" value={c.code} placeholder="NUR 101" onChange={(e) => setCourses(courses.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} />
                </div>
                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label htmlFor={`ob-cn-${i}`}>Course name</label>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input id={`ob-cn-${i}`} className="input" value={c.name} placeholder="Fundamentals of Nursing" onChange={(e) => setCourses(courses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    {courses.length > 1 && <button type="button" className="btn ghost sm" aria-label={`Remove course ${i + 1}`} onClick={() => setCourses(courses.filter((_, j) => j !== i))}>Remove</button>}
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setCourses([...courses, { code: '', name: '' }])}>+ Add another course</button>
          </section>
        )}

        {step === 3 && (
          <section className="stack" style={{ gap: 16 }}>
            <h1>When can you usually study?</h1>
            <p className="muted">Think about a typical week, after class, clinicals, work, and family time. The study planner uses only these times and warns you before overbooking.</p>
            <AvailabilityEditor value={availability} onChange={setAvailability} />
          </section>
        )}

        {step === 4 && (
          <section className="stack" style={{ gap: 16 }}>
            <h1>Which subjects feel challenging?</h1>
            <p className="muted">The planner adds short review sessions for these, and the dashboard explains why. Pick from the list or type your own.</p>
            <TopicInput id="ob-topics" value={topics} onChange={setTopics} suggestions={TOPIC_SUGGESTIONS} />
          </section>
        )}

        {error && <p role="alert" className="error" style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div className="spread" style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
          <button type="button" className="btn ghost" onClick={back} disabled={step === 0}>Back</button>
          <div className="actions">
            {step < STEPS.length - 1 && <button type="button" className="btn ghost" onClick={() => { setError(null); setStep(step + 1); }}>Skip</button>}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn primary" onClick={next}>Continue</button>
            ) : (
              <button type="button" className="btn primary" onClick={finish}>Finish and see my plan</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
