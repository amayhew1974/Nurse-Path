# Careward practice prototype

Careward is a prototype for independent Illinois nursing homes. This first build covers one workflow: the director of nursing (DON) enters a practice citation, assigns one corrective action, and verifies the employee's completed checklist.

Everything in it is fictional: the facility (Bluff Ridge Care Center, Godfrey, Illinois), the people, the F880 citation and the residents (R3, R7).

## How to open it

**Shared link (use this for the two-person test):** https://claude.ai/artifact/TQgKRsNmycziu5RGnggzqL

- Careward Admin: add `#admin` to the end of the link.
- Careward Staff: add `#staff` to the end of the link.
- Each person must be signed in to claude.ai, and the link is private at first. Before your test, use the page's **Share** menu to give the second person **Contributor** access. If they only have Viewer or Commenter access, they can open the page but can't save changes, and the page says so.

**Local file (one device only):** open `careward/index.html` in a browser. It saves to that browser only, so the laptop and phone won't see each other's changes. Use it only for solo practice.

## Demo accounts

| Account | Role | View | Demo PIN |
|---|---|---|---|
| Dana Whitfield, RN | Director of Nursing | Admin | 1111 |
| Marcus Reyes, CNA | Night shift | Staff | 2222 |
| Priya Shah, LPN | Night shift | Staff | 3333 |
| Tom Alvarez, CNA | Day shift | Staff | 4444 |

The PINs are printed on the sign-in screen, so nobody needs to be told them.

## What is real and what is simulated

| Part | Status |
|---|---|
| Citation, assignment, checklist, timestamps, activity log | Working. Saved in the shared record and still there after a refresh. Updates show on the other device live, or within about 30 seconds. |
| Sign-in | **Simulated.** Demo accounts with printed PINs. There are no real passwords. The chosen account is remembered on that device until you tap Sign out. |
| "Who took each action" | Records the **demo account** that was signed in, not the person's claude.ai identity. |
| "Staff see only their own assignments" | Enforced on screen only. Anyone with the link could sign in as any demo account. Real access control comes later. |
| Reminders, email, text messages | **Not built.** The employee must open the link. |
| Export record | Copies a plain-text record to the clipboard. There's no PDF or file download yet. |
| Practice data | One citation and one corrective action at a time. **Start a new practice case** clears it for everyone. |

## Test walkthrough (about 15 minutes)

Roles: your wife acts as the DON on a laptop, and you act as Marcus on a phone. Don't coach each other. Each of you writes down every spot where you hesitated.

**Before you start (owner, 2 minutes)**
1. Open the shared link on the laptop, open **Share**, and give your wife Contributor access.
2. If an old practice case is showing, sign in as Dana and tap **Start a new practice case**.
3. Give your wife the link ending in `#admin`. Open the link ending in `#staff` on your phone.

**DON on the laptop**
1. Tap **Dana Whitfield, RN**, enter PIN 1111, and sign in.
2. Enter the citation, either by typing it or with **Fill with practice F880 example**. Tap **Save citation**.
3. Fill in the corrective action. Assign it to **Marcus Reyes, CNA**, set a due date, write the instructions, the proof needed and the checklist (or use **Fill with practice example**). Tap **Assign**.
4. The dashboard shows three empty boxes: *I read the update*, *I submitted the work*, *I verified the result*.

**Employee on the phone**
5. Tap **Marcus Reyes, CNA** and enter PIN 2222. The assignment appears under My assignments.
6. Read the instructions and tap **I read the update**.
7. Check every checklist item, type your proof, and tap **I submitted the work**.

**DON on the laptop**
8. Without refreshing, wait up to 30 seconds. The first two boxes fill in with Marcus's name and the time, and the checked list appears under Employee response.
9. Add a review note if you want one, and tap **I verified the result**.

**Employee on the phone**
10. A green **Verified by Dana Whitfield, RN** note appears.

**Checks after the run**
- Refresh both devices. Everything is still there.
- On the phone, sign out and sign in as **Priya Shah** (3333). She sees "Nothing assigned to you".
- On the laptop, tap **Copy record** and paste it into an email to yourself. Compare it with the dashboard.
- Optional: run it again and use **Send back for more work** instead of verifying, to see the rework loop.

## Questions to ask after the test
- Did the DON know what to type in each field without help?
- Did the employee understand what "proof" meant?
- Were the three stamped actions clear enough for a survey binder?
- What would a real DON want to see on the dashboard first?
