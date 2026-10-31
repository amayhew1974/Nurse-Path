// Minimal hash router. Routes are plain names like "#planner" so links also work when the app
// is opened as a single file or embedded where only simple "#name" hashes survive.
import { useEffect, useState } from 'react';

export function currentRoute(): string {
  if (typeof window === 'undefined') return '';
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
}

export function navigate(route: string) {
  if (currentRoute() === route) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = route;
  }
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => {
    const on = () => {
      setRoute(currentRoute());
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
