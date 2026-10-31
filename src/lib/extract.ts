// Rules-based extraction of suggested courses, tasks, and checklist items from pasted
// syllabus or handbook text. Every result is a *suggestion* the student must review.
import { isValidISODate, toISODate, diffDays } from './dates';
import type { ChecklistCategory, ISODate, TaskType } from './types';

export type SuggestionKind = 'course' | 'task' | 'checklist';
export type Confidence = 'high' | 'medium' | 'low';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  taskType?: TaskType;
  category?: ChecklistCategory;
  courseCode?: string;
  date: ISODate | '';
  /** True when the year was not in the text and had to be guessed. */
  yearInferred: boolean;
  confidence: Confidence;
  /** Plain-language notes about why this was suggested and what is uncertain. */
  notes: string[];
  /** The exact text this suggestion came from. */
  sourceText: string;
  lineNumber: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';

interface FoundDate {
  iso: ISODate;
  yearInferred: boolean;
  match: string;
}

/** Pick the year for a month/day with no year: the nearest occurrence to the reference date. */
function inferYear(month: number, day: number, ref: Date): number {
  const y = ref.getFullYear();
  const candidates = [y - 1, y, y + 1].map((yy) => ({ yy, iso: toISODate(new Date(yy, month - 1, day)) }));
  const refISO = toISODate(ref);
  // Prefer dates from ~2 months back to ~10 months ahead (a typical academic window).
  let best = candidates[1];
  let bestScore = Infinity;
  for (const c of candidates) {
    const d = diffDays(refISO, c.iso);
    const score = d < -60 ? Math.abs(d) + 400 : Math.abs(d);
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best.yy;
}

export function findDate(text: string, ref: Date = new Date()): FoundDate | null {
  // 2026-09-14
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const iso = toISODate(new Date(+m[1], +m[2] - 1, +m[3]));
    if (isValidISODate(iso)) return { iso, yearInferred: false, match: m[0] };
  }
  // 9/14/2026, 9/14/26, 9/14
  m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const mo = +m[1];
    const da = +m[2];
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      let yr = m[3] ? +m[3] : inferYear(mo, da, ref);
      if (yr < 100) yr += 2000;
      const d = new Date(yr, mo - 1, da);
      if (d.getMonth() === mo - 1) return { iso: toISODate(d), yearInferred: !m[3], match: m[0] };
    }
  }
  // September 14, 2026 / Sept. 14 / Sep 14th
  const re = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, 'i');
  m = text.match(re);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().replace('.', '')];
    const da = +m[2];
    if (mo && da >= 1 && da <= 31) {
      const yr = m[3] ? +m[3] : inferYear(mo, da, ref);
      const d = new Date(yr, mo - 1, da);
      if (d.getMonth() === mo - 1) return { iso: toISODate(d), yearInferred: !m[3], match: m[0] };
    }
  }
  // 14 September 2026
  const re2 = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RE}(?:,?\\s+(20\\d{2}))?\\b`, 'i');
  m = text.match(re2);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().replace('.', '')];
    const da = +m[1];
    if (mo && da >= 1 && da <= 31) {
      const yr = m[3] ? +m[3] : inferYear(mo, da, ref);
      const d = new Date(yr, mo - 1, da);
      if (d.getMonth() === mo - 1) return { iso: toISODate(d), yearInferred: !m[3], match: m[0] };
    }
  }
  return null;
}

const COURSE_CODE_RE = /\b(NURS?|NSG|NUR|NRS|BIOL?|BIO|CHEM|PSYC?|PSY|MATH|STAT|ENGL?|MICR?|ANAT|PHYS|SOC|HSC)\s?-?(\d{3,4}[A-Z]?)\b/i;

const TASK_RULES: { re: RegExp; type: TaskType; label: string }[] = [
  { re: /\b(final exam|midterm|exam|test|hesi|ati|teas|kaplan)\b/i, type: 'exam', label: 'mentions an exam or test' },
  { re: /\bquiz(zes)?\b/i, type: 'quiz', label: 'mentions a quiz' },
  { re: /\b(check-?off|skills (lab|validation|check)|return demonstration|competency check)\b/i, type: 'skills', label: 'mentions a skills check-off' },
  { re: /\b(care plan|concept map|paper|essay|assignment|project|presentation|discussion post|journal|reflection|case study|worksheet|module|due)\b/i, type: 'assignment', label: 'mentions an assignment or due date' },
  { re: /\b(clinical (prep|paperwork|orientation|rotation)|pre-?clinical|simulation|sim lab)\b/i, type: 'clinical', label: 'mentions clinical preparation' },
  { re: /\b(read(ing)?|chapters?|ch\.)\b/i, type: 'reading', label: 'mentions a reading' },
];

const CHECKLIST_RULES: { re: RegExp; category: ChecklistCategory; label: string }[] = [
  { re: /\b(immuniz|vaccin|mmr|varicella|hepatitis b|hep b|tdap|influenza|flu shot|titer|tb test|tuberculosis|ppd|quantiferon|physical exam|health (form|record|screening))/i, category: 'health', label: 'mentions immunizations or health records' },
  { re: /\b(background check|drug screen|fingerprint|criminal|liability insurance|health insurance|id badge|photo id|hipaa (training|module)|confidentiality agreement|signed? (form|agreement|acknowledg))/i, category: 'documents', label: 'mentions a clearance or document' },
  { re: /\b(cpr|bls|basic life support|uniform|stethoscope|clinical compliance|castlebranch|complio|orientation module)\b/i, category: 'clinical', label: 'mentions a clinical readiness requirement' },
  { re: /\b(orientation|advising|registration|handbook acknowledg|student id)\b/i, category: 'academic', label: 'mentions an orientation or academic step' },
];

const OBLIGATION_RE = /\b(must|required|requirement|submit|upload|provide|complete|due|deadline|no later than|by)\b/i;

function cleanTitle(line: string, dateMatch?: string): string {
  let t = line;
  if (dateMatch) t = t.replace(dateMatch, '');
  t = t
    .replace(/^[\s\-•*·\d.)]+/, '')
    .replace(/\b(due|on|by|no later than)\s*[:\-–]?\s*$/i, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:,\-–]+|[\s:,\-–]+$/g, '')
    .trim();
  if (t.length > 90) t = t.slice(0, 87).trimEnd() + '…';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Split raw text into meaningful lines (keeps table rows and bullet points intact). */
function splitLines(text: string): { line: string; n: number }[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, i) => ({ line: line.replace(/\t+/g, '  ').trim(), n: i + 1 }))
    .filter((l) => l.line.length > 2);
}

export function extractSuggestions(text: string, ref: Date = new Date()): Suggestion[] {
  const out: Suggestion[] = [];
  const seenCourses = new Set<string>();
  let counter = 0;
  const id = () => `sug_${++counter}`;

  for (const { line, n } of splitLines(text)) {
    // Courses: a course code followed by a title, e.g. "NURS 101 Fundamentals of Nursing (4 credits)"
    const cm = line.match(COURSE_CODE_RE);
    if (cm) {
      const code = `${cm[1].toUpperCase()} ${cm[2].toUpperCase()}`;
      const after = line.slice((cm.index ?? 0) + cm[0].length).replace(/^[\s:–\-—]+/, '');
      const titleMatch = after.match(/^([A-Z][A-Za-z&,'/ ]{3,60}?)(?=\s*(\(|\||,\s*\d|\d+\s*credit|$|\s{2,}|–|—|-\s))/);
      if (!seenCourses.has(code) && titleMatch) {
        seenCourses.add(code);
        out.push({
          id: id(),
          kind: 'course',
          title: titleMatch[1].trim(),
          courseCode: code,
          date: '',
          yearInferred: false,
          confidence: 'medium',
          notes: [`Found course code ${code} followed by a name.`],
          sourceText: line,
          lineNumber: n,
        });
      }
    }

    const date = findDate(line, ref);
    const checklistRule = CHECKLIST_RULES.find((r) => r.re.test(line));
    const taskRule = TASK_RULES.find((r) => r.re.test(line));

    if (checklistRule && (OBLIGATION_RE.test(line) || date)) {
      const notes = [`This line ${checklistRule.label}.`];
      if (date?.yearInferred) notes.push('The year was not stated, so it was guessed. Please confirm.');
      if (!date) notes.push('No date was found. Add one if your program gives a deadline.');
      notes.push('Confirm this is a real requirement of your program before saving.');
      out.push({
        id: id(),
        kind: 'checklist',
        title: cleanTitle(line, date?.match),
        category: checklistRule.category,
        courseCode: cm ? `${cm[1].toUpperCase()} ${cm[2].toUpperCase()}` : undefined,
        date: date?.iso ?? '',
        yearInferred: !!date?.yearInferred,
        confidence: date && OBLIGATION_RE.test(line) ? 'medium' : 'low',
        notes,
        sourceText: line,
        lineNumber: n,
      });
      continue;
    }

    if (date && taskRule) {
      const notes = [`This line ${taskRule.label} and includes a date (“${date.match}”).`];
      if (date.yearInferred) notes.push('The year was not stated, so it was guessed. Please confirm.');
      out.push({
        id: id(),
        kind: 'task',
        title: cleanTitle(line, date.match) || 'Untitled item',
        taskType: taskRule.type,
        courseCode: cm ? `${cm[1].toUpperCase()} ${cm[2].toUpperCase()}` : undefined,
        date: date.iso,
        yearInferred: date.yearInferred,
        confidence: date.yearInferred ? 'medium' : 'high',
        notes,
        sourceText: line,
        lineNumber: n,
      });
    } else if (date && OBLIGATION_RE.test(line)) {
      out.push({
        id: id(),
        kind: 'task',
        title: cleanTitle(line, date.match) || 'Untitled item',
        taskType: 'prep',
        courseCode: cm ? `${cm[1].toUpperCase()} ${cm[2].toUpperCase()}` : undefined,
        date: date.iso,
        yearInferred: date.yearInferred,
        confidence: 'low',
        notes: ['This line has a date and sounds like a deadline, but the type of work is unclear.', ...(date.yearInferred ? ['The year was guessed. Please confirm.'] : [])],
        sourceText: line,
        lineNumber: n,
      });
    }
  }
  return out;
}

export const SAMPLE_SYLLABUS = `NURS 110 Fundamentals of Nursing (4 credits)
Fictional sample syllabus — Example Community College (not a real program)

Course schedule
Week 2: Reading — Chapters 1-3, the nursing process. Read before class on Sept 8
Care plan #1 due September 19
Quiz 1: Safety and infection prevention — 9/24
Skills check-off: hand hygiene and donning/doffing PPE, October 1
Exam 1 (Units 1-3) October 7
Concept map due Oct 21

Clinical requirements (Student Handbook, section 4)
All students must submit proof of Hepatitis B vaccination series or titer by August 30
Students must complete a background check and drug screen before the first clinical day, September 2
Current American Heart Association BLS certification is required
Upload your TB test (two-step or QuantiFERON) results to the compliance portal by Aug 30`;
