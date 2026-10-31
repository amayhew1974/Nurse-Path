# NursePath

**Know what comes next, understand what you're learning, and stay on track from your first prerequisite to your first nursing job.**

NursePath is a personal guide for U.S. ADN and BSN nursing students. This first release focuses on students starting nursing school, and it shows the whole journey (prerequisites → nursing school → licensure → first job) on a roadmap.

> NursePath is an independent educational and organizational tool. It is not affiliated with any school, board of nursing, or testing organization, and it does not provide medical advice.

## What works in this release

| Area | Status |
|---|---|
| Onboarding (name, ADN/BSN, stage, school/program, dates, courses, weekly availability, challenging subjects; all skippable and editable) | Working |
| **Today** dashboard: priorities, due soon, overdue, recommended study with reasons, stage progress | Working |
| **Courses & deadlines**: add/edit/complete/delete courses and tasks; list + month calendar; course/type/status filters; effort estimates | Working |
| **Program checklist**: manual items with source notes; import from pasted text, PDF, .docx, .txt/.md with a review screen that shows the source text | Working |
| **Study planner**: transparent rules-based weekly plan; move, shorten, complete, skip, reschedule; overlap blocking; capacity warnings | Working |
| **Explain It My Way**: six explanation styles for 5 sample concepts; practice quizzes with rationales | Working (sample library) |
| Optional live AI explanations through the included server (key stays on the server) | Working when a key is configured |
| **Progress & reflection**: completed work, self-rated confidence, topics to revisit, quiz results, goals (kept separate) | Working |
| Journey roadmap with screens for each stage; future features labeled “Planned” | Working |
| Demo student (relative dates, separate storage, reset) | Working |
| Export (JSON backup, CSV of deadlines), restore from backup, delete all data | Working |

## Where data is stored

Everything is saved in the **browser's local storage on the device you use**. There are no accounts and no database. That means:

- Data survives refreshes and restarts, but it doesn't sync between devices.
- Clearing the browser's site data erases it, so use **Profile & data → Full backup**.
- Demo data uses a separate storage key (`nursepath:demo:v1`) from personal data (`nursepath:personal:v1`).
- Imported files are read inside the browser and never uploaded. Only the suggestions you accept are saved.

## Running it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev            # development mode at http://localhost:5173
```

Production-style options:

```bash
npm run build && npm start          # builds, then serves at http://localhost:8787
npm run build:single                # one self-contained file: dist-single/index.html
```

The single file can be opened directly or hosted on any static web host. Live AI isn't available in that mode, and the app says so.

### Optional: live AI explanations

```bash
ANTHROPIC_API_KEY=your-key npm start
```

The key is read only by `server/index.mjs` and is never sent to the browser. Optional settings: `NURSEPATH_AI_MODEL` (default `claude-sonnet-5-5`) and `PORT`. Without a key, the app uses the labeled sample library.

## Tests

```bash
npm test                                        # unit tests: planner, extraction, data rules
npm run build && npm start &                    # then, in another terminal:
NODE_PATH=$(npm root -g) npm run e2e            # 49 browser checks (needs Playwright + Chromium)
```

The browser test covers onboarding, task create/edit/complete/delete, refresh persistence, dashboard totals, planner rules (no overlap, availability, capacity warnings), import review, unsupported files, PDF import, sample-mode labeling, quiz, export, demo isolation, mobile navigation, horizontal-scroll checks at phone width, and deleting data.

## Project layout

```
src/lib/types.ts       data model (stages, courses, tasks, checklist, sessions, reflections, goals)
src/lib/planner.ts     rules-based study planner (rules listed at the top of the file)
src/lib/extract.ts     syllabus/handbook text → suggestions (always reviewed by the student)
src/lib/store.tsx      saving to browser storage, demo/personal separation
src/lib/demo.ts        fictional demo student with dates relative to today
src/content/           sample concept library and stage roadmap text
src/pages/             one file per screen
server/index.mjs       optional server: serves the app + live AI proxy
e2e/smoke.mjs          end-to-end browser checks
```
