import { useStore } from '../lib/store';
import { navigate } from '../lib/router';
import { BrandMark } from '../components/Icon';
import { STAGES } from '../content/stages';

export function Welcome() {
  const { enterDemo, exitDemo, personalOnboarded } = useStore();
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="row" style={{ gap: 10 }}>
          <BrandMark />
          <span className="brand-name" style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#fff' }}>NursePath</span>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <h1>Know what comes next, understand what you’re learning, and <em>stay on track.</em></h1>
          <p className="lede">A personal guide from your first prerequisite to your first nursing job. Built first for students starting nursing school in an ADN or BSN program in the U.S.</p>
        </div>

        <ol className="route" aria-label="The nursing journey" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STAGES.map((s) => (
            <li key={s.id} className={`route-step${s.id === 'nursing' ? ' current' : ''}`} style={{ ['--p' as string]: '50%' }}>
              <div className="route-line"><span className="route-node" /></div>
              <div className="stack" style={{ gap: 2 }}>
                <span className="route-title">{s.title}</span>
                <span className="route-sub">{s.availability === 'full' ? 'Fully available in this release' : 'Preview: some tools available'}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="choices">
          <button type="button" className="choice" onClick={() => { exitDemo(); navigate(personalOnboarded ? 'today' : 'onboarding'); }}>
            <h2>{personalOnboarded ? 'Open my plan' : 'Set up my plan'}</h2>
            <p>About three minutes. Tell NursePath your program, courses, and when you can study. You can skip anything optional and change it later.</p>
            <span className="go">{personalOnboarded ? 'Continue →' : 'Start →'}</span>
          </button>
          <button type="button" className="choice" onClick={() => { enterDemo(); navigate('today'); }}>
            <h2>Explore the demo student</h2>
            <p>See a fictional first-semester student with four courses, upcoming exams, a checklist, and a week of study sessions. Kept separate from your own data.</p>
            <span className="go">Explore →</span>
          </button>
        </div>

        <p className="fine">
          Your information is saved only in this web browser on this device. There is no account, and nothing is sent to a server.
          NursePath is an independent educational and organizational tool. It is not affiliated with any school, board of nursing, or testing organization.
          Please do not enter real patient information anywhere in the app.
        </p>
      </div>
    </div>
  );
}
