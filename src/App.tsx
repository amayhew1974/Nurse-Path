import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from './lib/store';
import { useRoute, navigate } from './lib/router';
import { Icon, BrandMark } from './components/Icon';
import { Modal, ConfirmButton, useToast } from './components/ui';
import { Welcome } from './pages/Welcome';
import { Onboarding } from './pages/Onboarding';
import { Today } from './pages/Today';
import { Journey } from './pages/Journey';
import { Courses } from './pages/Courses';
import { Checklist } from './pages/Checklist';
import { Planner } from './pages/Planner';
import { Learn } from './pages/Learn';
import { Progress } from './pages/Progress';
import { Preferences } from './pages/Preferences';

export const NAV: { route: string; label: string; icon: string; group: 'plan' | 'learn' | 'you' }[] = [
  { route: 'today', label: 'Today', icon: 'today', group: 'plan' },
  { route: 'courses', label: 'Courses & deadlines', icon: 'courses', group: 'plan' },
  { route: 'planner', label: 'Study planner', icon: 'planner', group: 'plan' },
  { route: 'checklist', label: 'Program checklist', icon: 'checklist', group: 'plan' },
  { route: 'learn', label: 'Explain It My Way', icon: 'learn', group: 'learn' },
  { route: 'progress', label: 'Progress & reflection', icon: 'progress', group: 'learn' },
  { route: 'journey', label: 'My journey', icon: 'journey', group: 'you' },
  { route: 'preferences', label: 'Profile & data', icon: 'prefs', group: 'you' },
];
const TABS = ['today', 'courses', 'planner', 'learn'];

function section(route: string) {
  return route.split('-')[0] || 'today';
}

export default function App() {
  const route = useRoute();
  const { mode, personalOnboarded } = useStore();

  // Move focus to the main heading after navigation, for keyboard and screen reader users.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    const h1 = mainRef.current?.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      (h1 as HTMLElement).focus({ preventScroll: true });
    }
  }, [route]);

  if (route === 'onboarding') return <Onboarding />;
  if (mode === 'personal' && !personalOnboarded) return <Welcome />;
  if (route === 'welcome') return <Welcome />;

  const sec = section(route);
  let page: ReactNode;
  switch (sec) {
    case 'journey': page = <Journey route={route} />; break;
    case 'courses': page = <Courses />; break;
    case 'checklist': page = <Checklist route={route} />; break;
    case 'planner': page = <Planner />; break;
    case 'learn': page = <Learn route={route} />; break;
    case 'progress': page = <Progress />; break;
    case 'preferences': page = <Preferences key={mode} />; break;
    default: page = <Today />;
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.querySelector('h1')?.focus(); }}>Skip to content</a>
      <Sidebar current={sec} />
      <div className="main">
        <TopBar />
        <main id="main" ref={mainRef} className="content">
          <StatusBanners />
          {page}
        </main>
        <TabBar current={sec} />
      </div>
    </div>
  );
}

function Sidebar({ current }: { current: string }) {
  const { mode } = useStore();
  const groups: [string, string][] = [['plan', 'Plan'], ['learn', 'Learn'], ['you', 'You']];
  return (
    <nav className="sidebar" aria-label="Main">
      <a className="brand" href="#today"><BrandMark /><span className="brand-name">NursePath</span></a>
      {groups.map(([g, label]) => (
        <div className="nav-group" key={g}>
          <div className="nav-label">{label}</div>
          {NAV.filter((n) => n.group === g).map((n) => (
            <a key={n.route} href={`#${n.route}`} className="nav-link" aria-current={current === n.route ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
        </div>
      ))}
      <div className="sidebar-foot">
        {mode === 'demo' ? (
          <p><strong>Demo mode.</strong> You are viewing a fictional student. Your own data is untouched.</p>
        ) : (
          <p><strong>Saved in this browser only.</strong> No account and no server. Export a backup from Profile &amp; data.</p>
        )}
        <p style={{ marginTop: 8 }}>Independent study tool. Not affiliated with any school, board of nursing, or testing organization.</p>
      </div>
    </nav>
  );
}

function TopBar() {
  const { mode } = useStore();
  return (
    <header className="topbar">
      <a className="brand" href="#today"><BrandMark /><span className="brand-name">NursePath</span></a>
      {mode === 'demo' && <span className="pill sample">Demo</span>}
    </header>
  );
}

function TabBar({ current }: { current: string }) {
  const [more, setMore] = useState(false);
  const inMore = !TABS.includes(current);
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((r) => {
          const n = NAV.find((x) => x.route === r)!;
          const short = r === 'courses' ? 'Courses' : r === 'planner' ? 'Planner' : r === 'learn' ? 'Learn' : 'Today';
          return (
            <a key={r} href={`#${r}`} className="tab" aria-current={current === r ? 'page' : undefined}>
              <Icon name={n.icon} />
              {short}
            </a>
          );
        })}
        <button type="button" className="tab" aria-current={inMore ? 'page' : undefined} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Icon name="more" />
          More
        </button>
      </nav>
      <Modal open={more} title="More" onClose={() => setMore(false)}>
        <div className="more-sheet">
          {NAV.filter((n) => !TABS.includes(n.route)).map((n) => (
            <a key={n.route} href={`#${n.route}`} onClick={() => setMore(false)} aria-current={current === n.route ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
        </div>
      </Modal>
    </>
  );
}

function StatusBanners() {
  const { mode, exitDemo, resetDemo, storageOk, saveError, loadProblem, personalOnboarded } = useStore();
  const toast = useToast();
  return (
    <>
      {mode === 'demo' && (
        <div className="banner" role="region" aria-label="Demo mode">
          <span className="grow"><strong>You are exploring a fictional demo student, Jordan.</strong> Changes stay in the demo and never touch your own data.</span>
          <div className="actions">
            <ConfirmButton label="Reset demo" confirmLabel="Yes, reset demo" className="btn sm" prompt="Restore the original demo?" onConfirm={() => { resetDemo(); toast('Demo reset. Your own data was not changed.'); }} />
            <button type="button" className="btn sm primary" onClick={() => { exitDemo(); navigate(personalOnboarded ? 'today' : 'welcome'); }}>
              {personalOnboarded ? 'Back to my data' : 'Exit demo'}
            </button>
          </div>
        </div>
      )}
      {!storageOk && (
        <div className="banner danger" role="alert"><span className="grow"><strong>This browser is blocking storage.</strong> You can use NursePath, but changes will be lost when you close or refresh the page. Private browsing or strict privacy settings usually cause this.</span></div>
      )}
      {saveError && <div className="banner danger" role="alert"><span className="grow">{saveError}</span></div>}
      {loadProblem && <div className="banner danger" role="alert"><span className="grow">{loadProblem}</span></div>}
    </>
  );
}
