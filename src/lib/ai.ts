// Optional live AI. The browser never holds an API key: it calls NursePath's own server
// (server/index.mjs), which adds the key on the server side. If that server is not running or
// has no key, the app uses the clearly labeled sample library instead.
import type { ExplainMode } from '../content/concepts';

export interface AIStatus {
  available: boolean;
  model?: string;
  message: string;
}

export async function getAIStatus(): Promise<AIStatus> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('api/ai/status', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data && data.available) return { available: true, model: data.model, message: 'Live AI is connected through the NursePath server.' };
    return { available: false, message: data?.message || 'The NursePath server is running, but no AI key is configured.' };
  } catch {
    return { available: false, message: 'Live AI is not connected in this copy of NursePath. You are using the sample library.' };
  }
}

export async function explainLive(topic: string, mode: ExplainMode, question: string): Promise<string> {
  const res = await fetch('api/ai/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, mode, question }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'The AI service did not respond. Try again, or use the sample library.');
  return data.text as string;
}
