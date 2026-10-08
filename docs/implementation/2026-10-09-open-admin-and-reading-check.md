# Open admin, instant answer reveal and reading check

## Open committee workspace (temporary)

`NBC_ADMIN_OPEN=true` removes the staff sign-in wall: every visitor to `/admin` acts as an administrator with the actor `open-access`. It exists so the team can test. It is a switch, not a code path to keep.

- **Turn it off:** delete `NBC_ADMIN_OPEN` from the Vercel project (Production) and redeploy. Staff sign-in (`NBC_STAFF_AUTH=vercel`) applies again.
- While it is on, anyone with the URL can read participant data, change prizes, open or close the competition and export reports. Do not run a real competition with it on.
- Code: `src/lib/admin-open.ts`, used by `src/app/api/[...path]/route.ts` and `src/app/admin/page.tsx`.

## Answer reveal latency

The 3 to 4 second wait after "ثبّت إجابتي" came from three things:

1. Vercel functions ran in `iad1` while the Supabase database is in `eu-central-1`. Every query crossed the Atlantic, and one lock needs about 25. `vercel.json` now pins `fra1`.
2. The client fetched the whole state before every write. It now sends the write directly using the revision from the last response, and retries once after a stale revision.
3. The server re-opened a second transaction to build the response. The write now builds it inside the same transaction.

The "next" button stays disabled with "جارٍ كشف النتيجة…" until the server's result arrives, so a result can no longer be skipped. When offline, "next" stays available because the result cannot arrive.

## Reading check

Question order is shuffled per student, so the check ties each answer to the book, not to a reading order.

- The exam counts seconds on each page while the book is visible, the tab is visible and the student was active in the last 45 seconds.
- Before a lock, time on the question's source page and the pages either side must reach 5 seconds (`READING_MIN_SOURCE_SECONDS`). If not, the student sees a one-time nudge and can still lock with "ثبّت على أي حال". Nothing is ever blocked.
- Each lock sends `{ sourceSeconds, totalSeconds, maxPage, questionSeconds }` with the event. The server stores it in the event payload.
- The participants table shows "⚠ N إجابة دون قراءة المصدر" for attempts with locks below the threshold. It is evidence for committee review, not a verdict.
- The numbers come from the browser, so a determined cheater can forge them. This deters and surfaces casual answer-hunting; it is not proof.
