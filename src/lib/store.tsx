// The app's data store. Saves to the browser's localStorage after every change.
// Personal and demo data use different storage keys, so they never mix.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Workspace } from './types';
import { emptyWorkspace, normalizeWorkspace } from './workspace';
import { buildDemoWorkspace } from './demo';

export const STORAGE_KEYS = {
  personal: 'nursepath:personal:v1',
  demo: 'nursepath:demo:v1',
  active: 'nursepath:active',
} as const;

type Mode = 'personal' | 'demo';

function storageAvailable(): boolean {
  try {
    const k = 'nursepath:probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadWorkspace(kind: Mode): { ws: Workspace; problem: string | null } {
  const raw = readJSON(STORAGE_KEYS[kind]);
  if (!raw) return { ws: kind === 'demo' ? buildDemoWorkspace() : emptyWorkspace('personal'), problem: null };
  try {
    return { ws: normalizeWorkspace(raw, kind), problem: null };
  } catch {
    // Keep the unreadable copy so nothing is lost, then start fresh.
    try {
      localStorage.setItem(`${STORAGE_KEYS[kind]}:unreadable-backup`, localStorage.getItem(STORAGE_KEYS[kind]) ?? '');
    } catch {
      /* ignore */
    }
    return {
      ws: kind === 'demo' ? buildDemoWorkspace() : emptyWorkspace('personal'),
      problem: 'Your saved data could not be read, so NursePath started fresh. A copy of the old data was kept in this browser.',
    };
  }
}

interface StoreValue {
  ws: Workspace;
  mode: Mode;
  storageOk: boolean;
  saveError: string | null;
  loadProblem: string | null;
  update: (recipe: (ws: Workspace) => Workspace) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  resetDemo: () => void;
  deletePersonalData: () => void;
  replacePersonal: (ws: Workspace) => void;
  personalOnboarded: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const storageOk = useMemo(storageAvailable, []);
  const initial = useRef<{ personal: Workspace; demo: Workspace | null; mode: Mode; problem: string | null } | null>(null);
  if (!initial.current) {
    const p = loadWorkspace('personal');
    const savedMode = (() => {
      try {
        return localStorage.getItem(STORAGE_KEYS.active) === 'demo' ? 'demo' : 'personal';
      } catch {
        return 'personal';
      }
    })() as Mode;
    const d = savedMode === 'demo' ? loadWorkspace('demo') : null;
    initial.current = { personal: p.ws, demo: d?.ws ?? null, mode: savedMode, problem: p.problem ?? d?.problem ?? null };
  }

  const [personal, setPersonal] = useState<Workspace>(initial.current.personal);
  const [demo, setDemo] = useState<Workspace | null>(initial.current.demo);
  const [mode, setMode] = useState<Mode>(initial.current.mode);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadProblem = initial.current.problem;

  // Persist personal and demo data under separate keys whenever they change.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!storageOk) return;
    const ok = writeJSON(STORAGE_KEYS.personal, personal);
    setSaveError(ok ? null : 'Changes could not be saved. Your browser storage may be full or blocked.');
  }, [personal, storageOk]);

  useEffect(() => {
    if (!storageOk || !demo) return;
    writeJSON(STORAGE_KEYS.demo, demo);
  }, [demo, storageOk]);

  useEffect(() => {
    if (!storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEYS.active, mode);
    } catch {
      /* ignore */
    }
  }, [mode, storageOk]);

  const update = useCallback(
    (recipe: (ws: Workspace) => Workspace) => {
      const stamp = (w: Workspace) => ({ ...recipe(w), updatedAt: new Date().toISOString() });
      if (mode === 'demo') setDemo((d) => stamp(d ?? buildDemoWorkspace()));
      else setPersonal((p) => stamp(p));
    },
    [mode],
  );

  const enterDemo = useCallback(() => {
    setDemo((d) => d ?? loadWorkspace('demo').ws);
    setMode('demo');
  }, []);
  const exitDemo = useCallback(() => setMode('personal'), []);
  const resetDemo = useCallback(() => {
    // Only the demo key is touched. Personal data is never read or written here.
    setDemo(buildDemoWorkspace());
  }, []);
  const deletePersonalData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.personal);
      localStorage.removeItem(`${STORAGE_KEYS.personal}:unreadable-backup`);
    } catch {
      /* ignore */
    }
    firstRun.current = true; // don't immediately re-save the empty workspace
    setPersonal(emptyWorkspace('personal'));
    setMode('personal');
  }, []);
  const replacePersonal = useCallback((ws: Workspace) => {
    setPersonal({ ...ws, kind: 'personal', updatedAt: new Date().toISOString() });
  }, []);

  const ws = mode === 'demo' && demo ? demo : personal;
  const value: StoreValue = {
    ws,
    mode,
    storageOk,
    saveError,
    loadProblem,
    update,
    enterDemo,
    exitDemo,
    resetDemo,
    deletePersonalData,
    replacePersonal,
    personalOnboarded: !!personal.profile.onboardedAt,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
