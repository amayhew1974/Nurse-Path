// End-to-end check of the core NursePath journey in a real browser (Playwright + Chromium).
// Usage: npm run build && (npm start &) && npm run e2e      (BASE_URL defaults to http://localhost:8787)
import { createRequire } from 'node:module';
// Uses the project's Playwright if installed, otherwise a globally installed one (set NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8787/';
const SHOTS = new URL('./screens/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const store = (page, key = 'nursepath:personal:v1') => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);
const seen = (loc) => loc.first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/api\/ai|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });

try {
  // ---------- Onboarding ----------
  await page.goto(BASE);
  await page.getByRole('button', { name: /Set up my plan/ }).click();
  await page.getByLabel(/What should we call you/).fill('Alex');
  await page.getByRole('radio', { name: /^BSN/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/^School/).fill('My Community College');
  await page.getByLabel(/Program start date/).fill(plus(-14));
  await page.getByLabel(/Anticipated graduation/).fill(plus(-30)); // invalid on purpose
  await page.getByRole('button', { name: 'Continue' }).click();
  check('Onboarding rejects graduation before start', await page.getByRole('alert').filter({ hasText: 'after your program start' }).isVisible());
  await page.getByLabel(/Anticipated graduation/).fill(plus(700));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Course code').first().fill('NUR 110');
  await page.getByLabel('Course name').first().fill('Fundamentals of Nursing');
  await page.getByRole('button', { name: '+ Add another course' }).click();
  await page.getByLabel('Course name').nth(1).fill('Health Assessment');
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await page.getByRole('button', { name: new RegExp(`Add evening .* on ${d}`) }).click();
  }
  check('Availability totals 21 hours', await page.getByText('21 hr per week').isVisible());
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '+ Fluid and electrolyte balance' }).click();
  await page.getByRole('button', { name: 'Finish and see my plan' }).click();
  await page.waitForSelector('h1:has-text("Alex")');
  let s = await store(page);
  check('Onboarding saves profile', s?.profile?.preferredName === 'Alex' && s.profile.pathway === 'BSN' && !!s.profile.onboardedAt && s.courses.length === 2);

  // ---------- Tasks: create, edit ----------
  await page.goto(BASE + '#courses');
  const addTask = async (title, type, due, hours, course) => {
    await page.getByRole('button', { name: 'Add task' }).click();
    const dlg = page.locator('dialog[open]');
    await dlg.getByLabel('Title').fill(title);
    await dlg.getByLabel('Type').selectOption(type);
    if (course) await dlg.getByLabel('Course').selectOption({ label: course });
    await dlg.getByLabel('Due date').fill(due);
    await dlg.getByLabel(/Estimated effort/).fill(String(hours));
    await dlg.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
  };
  // Validation first
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Add', exact: true }).click();
  check('Task form shows plain-language errors', await page.getByText('Give this item a short title.').isVisible());
  await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click();

  await addTask('Care plan 1', 'assignment', plus(3), 2, 'NUR 110 · Fundamentals of Nursing');
  await addTask('Exam 1', 'exam', plus(5), 4, 'NUR 110 · Fundamentals of Nursing');
  await addTask('Head-to-toe video', 'assignment', plus(4), 1.5, 'Health Assessment');
  s = await store(page);
  check('Tasks are created', s.tasks.length === 3);

  await page.getByRole('button', { name: 'Edit Care plan 1' }).click();
  await page.locator('dialog[open]').getByLabel('Title').fill('Care plan #1 (revised)');
  await page.locator('dialog[open]').getByRole('button', { name: 'Save changes' }).click();
  s = await store(page);
  check('Tasks can be edited', s.tasks.some((t) => t.title === 'Care plan #1 (revised)'));

  await page.getByRole('button', { name: 'Calendar' }).click();
  if (!(await page.locator('.cal-ev', { hasText: 'Exam 1' }).count())) await page.getByRole('button', { name: 'Next month' }).click();
  check('Calendar view shows tasks', await page.locator('.cal-ev', { hasText: 'Exam 1' }).count() >= 1);
  await page.screenshot({ path: SHOTS + 'courses-calendar.png', fullPage: true });
  await page.getByRole('button', { name: 'List' }).click();

  // ---------- Planner ----------
  await page.goto(BASE + '#planner');
  await page.getByRole('button', { name: /Build plan/ }).click();
  s = await store(page);
  const planned = s.sessions.filter((x) => x.status === 'planned');
  const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
  let overlap = false, outside = false;
  for (const a of planned) {
    const wd = new Date(a.date + 'T00:00:00').getDay();
    const blocks = s.profile.availability[wd];
    if (!blocks.some((b) => toMin(a.start) >= toMin(b.start) && toMin(a.start) + a.durationMinutes <= toMin(b.end))) outside = true;
    for (const b of planned) if (a !== b && a.date === b.date && toMin(a.start) < toMin(b.start) + b.durationMinutes && toMin(b.start) < toMin(a.start) + a.durationMinutes) overlap = true;
  }
  check('Planner creates sessions', planned.length > 0, `${planned.length} sessions`);
  check('Planner never overlaps sessions', !overlap);
  check('Planner stays inside availability', !outside);
  check('Exam study scheduled before exam day', planned.filter((x) => x.taskId === s.tasks.find((t) => t.title === 'Exam 1').id).every((x) => x.date < plus(5)));
  check('Each session explains why', planned.every((x) => x.reason && x.reason.length > 10));
  await page.screenshot({ path: SHOTS + 'planner.png', fullPage: true });

  // Manual session overlap is blocked; outside-availability needs acknowledgment
  const first = planned.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  await page.getByRole('button', { name: 'Add session' }).click();
  let dlg = page.locator('dialog[open]');
  await dlg.getByLabel('What will you study?').fill('Overlap test');
  await dlg.getByLabel('Date').fill(first.date);
  await dlg.getByLabel('Start').fill(first.start);
  check('Overlapping manual session is blocked', await dlg.getByText(/overlaps/).isVisible());
  await dlg.getByLabel('Start').fill('07:00');
  check('Outside-availability session shows capacity warning', await dlg.getByText('Capacity warning').isVisible());
  await dlg.getByRole('button', { name: 'Save' }).click();
  check('Warning must be acknowledged before saving', await dlg.getByText(/Check the box below/).isVisible());
  await dlg.getByLabel(/Save this session anyway/).check();
  await dlg.getByRole('button', { name: 'Save' }).click();
  s = await store(page);
  check('Acknowledged manual session saves', s.sessions.some((x) => x.topic === 'Overlap test' && x.start === '07:00'));

  // Shorten + mark one session done
  const firstCard = page.locator('article.session').filter({ hasText: first.topic }).first();
  const shortBtn = firstCard.getByRole('button', { name: /Shorten/ });
  if (await shortBtn.count()) await shortBtn.click();
  await page.locator('article.session').filter({ hasText: first.topic }).first().getByRole('button', { name: /Mark done/ }).click();
  s = await store(page);
  const firstAfter = s.sessions.find((x) => x.id === first.id);
  check('Sessions can be shortened and completed', firstAfter.status === 'done' && (first.durationMinutes <= 15 || firstAfter.durationMinutes === first.durationMinutes - 15));

  // ---------- Complete a task → dashboard updates ----------
  await page.goto(BASE + '#today');
  const before = (await store(page)).sessions.filter((x) => x.taskId && x.status === 'planned').length;
  check('Dashboard shows due-soon items', await page.locator('#h-due').locator('..').locator('..').getByText('Exam 1').isVisible());
  check('Dashboard recommends study with a reason', await page.locator('.reason').first().isVisible());
  const careId = s.tasks.find((t) => t.title.startsWith('Care plan')).id;
  await page.goto(BASE + '#courses');
  await page.getByRole('checkbox', { name: /Mark complete: Care plan/ }).click();
  s = await store(page);
  const after = s.sessions.filter((x) => x.taskId && x.status === 'planned').length;
  check('Completing a task removes its planned sessions', s.sessions.filter((x) => x.taskId === careId && x.status === 'planned').length === 0 && after <= before);
  await page.goto(BASE + '#today');
  check('Dashboard totals reflect saved records', await page.getByText('1 of 3', { exact: true }).first().isVisible());
  await page.screenshot({ path: SHOTS + 'today.png', fullPage: true });

  // Change a deadline → dashboard + schedule agree
  await page.goto(BASE + '#courses');
  await page.getByRole('button', { name: 'Edit Head-to-toe video' }).click();
  await page.locator('dialog[open]').getByLabel('Due date').fill(plus(0));
  await page.locator('dialog[open]').getByRole('button', { name: 'Save changes' }).click();
  s = await store(page);
  const htId = s.tasks.find((t) => t.title === 'Head-to-toe video').id;
  check('Changing a deadline drops sessions after it', s.sessions.filter((x) => x.taskId === htId && x.status === 'planned').every((x) => x.date <= plus(0)));
  await page.goto(BASE + '#today');
  check('Moved deadline appears in today’s priorities', await page.locator('#h-today').locator('..').locator('..').getByText('Head-to-toe video').isVisible());

  // Delete a task
  await page.goto(BASE + '#courses');
  await page.getByRole('button', { name: 'Edit Head-to-toe video' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Delete' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Delete', exact: true }).last().click();
  s = await store(page);
  check('Tasks can be deleted (with confirmation)', !s.tasks.some((t) => t.title === 'Head-to-toe video') && !s.sessions.some((x) => x.taskId === htId && x.status === 'planned'));

  // ---------- Refresh persistence ----------
  await page.reload();
  await page.goto(BASE + '#courses');
  check('Data survives a refresh', await page.getByText('Exam 1').first().isVisible() && (await store(page)).tasks.length === 2);

  // ---------- Import with review ----------
  await page.goto(BASE + '#checklist-import');
  await page.getByRole('button', { name: 'Use the fictional sample syllabus' }).click();
  await page.getByRole('button', { name: 'Find suggestions' }).click();
  const sugCount = await page.locator('.review-item').count();
  s = await store(page);
  check('Import shows suggestions with source text, nothing saved yet', sugCount > 5 && (await page.locator('.source-text').count()) === sugCount && s.checklist.length === 0, `${sugCount} suggestions`);
  check('Save is disabled until something is accepted', await page.getByRole('button', { name: /Save 0 accepted/ }).first().isDisabled());
  const items = page.locator('.review-item');
  await items.nth(0).getByRole('button', { name: 'Accept' }).click(); // course
  const hep = page.locator('.review-item').filter({ hasText: 'Hepatitis B' });
  await hep.getByRole('button', { name: 'Accept' }).click();
  const examSug = page.locator('.review-item').filter({ hasText: 'Exam 1 (Units 1-3)' });
  await examSug.getByLabel('Title').fill('Exam 1: Units 1–3');
  await examSug.getByRole('button', { name: 'Accept' }).click();
  await page.locator('.review-item').filter({ hasText: 'Concept map' }).getByRole('button', { name: 'Reject' }).click();
  await page.getByRole('button', { name: /Save 3 accepted/ }).first().click();
  s = await store(page);
  check('Only confirmed suggestions are saved', s.checklist.length === 1 && s.tasks.some((t) => t.title === 'Exam 1: Units 1–3' && t.source === 'import') && s.courses.some((c) => c.code === 'NURS 110') && !s.tasks.some((t) => /Concept map/.test(t.title)));

  // Unsupported upload
  await page.goto(BASE + '#checklist-import');
  await page.setInputFiles('#imp-file', { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
  check('Unsupported upload gives a usable message', await seen(page.getByText(/Images and photos are not supported/)));
  await page.setInputFiles('#imp-file', { name: 'syllabus.txt', mimeType: 'text/plain', buffer: Buffer.from('Quiz 2 on 12/02\nCare plan due Dec 9') });
  check('Plain text file import works', await seen(page.getByText(/Read \d+ characters/)));

  // PDF import (a tiny generated PDF with selectable text)
  const pdf = makePdf(['NUR 110 Fundamentals', 'Exam 2 is on December 4']);
  await page.setInputFiles('#imp-file', { name: 'syllabus.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.waitForFunction(() => /Read \d+ characters from “syllabus.pdf/.test(document.body.innerText) || /could not|No selectable/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  const pdfOk = await page.getByText(/syllabus\.pdf/).isVisible();
  const pdfText = await page.locator('#imp-text').inputValue();
  check('PDF text import works', pdfOk && /Exam 2/.test(pdfText), pdfText.slice(0, 60));

  // ---------- Learn ----------
  await page.goto(BASE + '#learn');
  await page.getByText('Not connected', { exact: true }).waitFor({ timeout: 5000 }).catch(() => {});
  check('Sample mode is labeled honestly (no AI key)', await page.getByText('Sample library mode').first().isVisible() && await page.getByText('Not connected', { exact: true }).isVisible());
  await page.goto(BASE + '#learn-fluid-balance');
  await page.getByRole('tab', { name: /Comparison table/ }).click();
  check('Comparison table renders', await page.locator('table.cmp').isVisible());
  await page.getByRole('tab', { name: /Practice quiz/ }).click();
  const qs = page.locator('fieldset.quiz-q');
  for (let i = 0; i < await qs.count(); i++) await qs.nth(i).locator('input[type=radio]').first().check();
  await page.getByRole('button', { name: 'Check my answers' }).click();
  check('Quiz shows rationales and saves the result', await page.locator('.rationale').first().isVisible() && (await store(page)).quizAttempts.length === 1);
  await page.getByRole('radio', { name: /2 · Shaky/ }).click();
  check('Confidence rating saves separately', (await store(page)).reflections.some((r) => r.topic === 'Fluid and electrolyte balance' && r.confidence === 2));
  await page.screenshot({ path: SHOTS + 'learn.png', fullPage: true });

  // ---------- Export ----------
  await page.goto(BASE + '#preferences');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Full backup/ }).click()]);
  const path = await dl.path();
  const exported = JSON.parse((await import('node:fs')).readFileSync(path, 'utf8'));
  check('Export produces a full backup', exported.app === 'NursePath' && exported.workspace.tasks.length === (await store(page)).tasks.length);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Deadlines \(CSV/ }).click()]);
  check('CSV export works', (await dl2.suggestedFilename()).endsWith('.csv'));

  // ---------- Demo isolation ----------
  const personalBefore = JSON.stringify(await store(page));
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await page.waitForSelector('text=fictional demo student');
  check('Demo loads with four courses', (await store(page, 'nursepath:demo:v1')).courses.length === 4);
  await page.screenshot({ path: SHOTS + 'demo-today.png', fullPage: true });
  await page.goto(BASE + '#courses');
  await page.getByRole('checkbox', { name: /Mark complete/ }).first().click();
  await page.getByRole('button', { name: 'Reset demo' }).first().click();
  await page.getByRole('button', { name: 'Yes, reset demo' }).click();
  const personalAfter = JSON.stringify(await store(page));
  check('Demo changes and reset never touch personal data', personalBefore === personalAfter);
  await page.goto(BASE + '#planner');
  await page.screenshot({ path: SHOTS + 'demo-planner.png', fullPage: true });
  await page.goto(BASE + '#checklist');
  await page.screenshot({ path: SHOTS + 'demo-checklist.png', fullPage: true });
  await page.goto(BASE + '#journey-licensure');
  check('Future stage is labeled as planned, without fake buttons', await page.getByText('Planned · not yet available').first().isVisible());
  await page.screenshot({ path: SHOTS + 'journey-licensure.png', fullPage: true });
  await page.getByRole('button', { name: 'Back to my data' }).click();
  await page.waitForSelector('h1:has-text("Alex")');
  check('Exiting demo returns to personal data', true);

  // ---------- Mobile ----------
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(BASE);
  await mp.evaluate((data) => localStorage.setItem('nursepath:personal:v1', data), personalAfter);
  await mp.goto(BASE + '#today');
  await mp.reload();
  check('Mobile tab bar is visible', await mp.locator('nav.tabbar').isVisible());
  let overflowPages = [];
  for (const r of ['today', 'courses', 'planner', 'checklist', 'learn', 'learn-nursing-process', 'progress', 'journey', 'preferences', 'checklist-import']) {
    await mp.goto(BASE + '#' + r);
    await mp.waitForTimeout(150);
    if (!(await noHScroll(mp))) overflowPages.push(r);
  }
  check('No horizontal scrolling on phone width', overflowPages.length === 0, overflowPages.join(', '));
  await mp.goto(BASE + '#today');
  await mp.getByRole('button', { name: 'More' }).click();
  await mp.locator('dialog[open]').getByRole('link', { name: /Progress/ }).click();
  await mp.locator('h1', { hasText: 'Progress' }).waitFor({ timeout: 5000 }).catch(() => {});
  check('Mobile “More” menu navigates', await mp.locator('h1', { hasText: 'Progress' }).isVisible());
  await mp.goto(BASE + '#today');
  await mp.getByRole('button', { name: 'Add task' }).click();
  await mp.locator('dialog[open]').getByLabel('Title').fill('Mobile task');
  await mp.locator('dialog[open]').getByLabel('Due date').fill(plus(2));
  await mp.locator('dialog[open]').getByRole('button', { name: 'Add', exact: true }).click();
  check('Core form works on mobile', (await store(mp)).tasks.some((t) => t.title === 'Mobile task'));
  await mp.screenshot({ path: SHOTS + 'mobile-today.png', fullPage: true });
  await mp.goto(BASE + '#planner');
  await mp.screenshot({ path: SHOTS + 'mobile-planner.png', fullPage: true });
  await m.close();

  // ---------- Delete ----------
  await page.goto(BASE + '#preferences');
  await page.getByRole('button', { name: 'Delete all my data' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await page.waitForSelector('text=Set up my plan');
  await page.reload();
  check('Delete removes personal data', (await store(page)) === null && await page.getByText('Set up my plan').isVisible());
  check('Demo data is kept separately after delete', (await store(page, 'nursepath:demo:v1')) !== null);

  // ---------- Keyboard ----------
  await page.goto(BASE);
  await page.getByRole('button', { name: /Explore the demo student/ }).click();
  await page.goto(BASE + '#learn-nursing-process');
  await page.getByRole('tab', { name: /Plain language/ }).focus();
  await page.keyboard.press('ArrowRight');
  check('Keyboard arrows move between explanation tabs', await page.getByRole('tab', { name: /Step by step/ }).getAttribute('aria-selected') === 'true');
  await page.goto(BASE + '#welcome');
  await page.screenshot({ path: SHOTS + 'welcome.png', fullPage: true });
} catch (e) {
  check('Script ran without crashing', false, String(e).split('\n')[0]);
  await page.screenshot({ path: SHOTS + 'failure.png', fullPage: true }).catch(() => {});
}

check('No JavaScript errors in the console', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(SHOTS + 'results.json', JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

// Build a minimal, valid one-page PDF containing the given lines of text.
function makePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);
  const stream = `BT /F1 14 Tf 72 720 Td 18 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
