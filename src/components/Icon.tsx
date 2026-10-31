// Small stroke icon set (inline SVG, no external requests).
const PATHS: Record<string, string> = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  journey: 'M5 19c3-1 3-6 7-7s4-6 7-7M5 19a2 2 0 1 0 0 .01M19 5a2 2 0 1 0 0 .01',
  courses: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h12M9 7h6',
  checklist: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  planner: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6',
  learn: 'M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  prefs: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  close: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12l5 5L20 7',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  warn: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};

export function Icon({ name, label }: { name: keyof typeof PATHS | string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

export function BrandMark() {
  // A path that climbs toward a star: the journey from first prerequisite to first job.
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0e7c7b" />
      <path d="M7 24c4-1 5-6 9-7s5-6 9-8" fill="none" stroke="#fbf9f5" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="7" cy="24" r="2.2" fill="#fbf9f5" />
      <path d="M25 5.5l1 2.4 2.5.3-1.9 1.7.5 2.5-2.1-1.3-2.2 1.3.6-2.5-1.9-1.7 2.5-.3z" fill="#c39a3c" />
    </svg>
  );
}
