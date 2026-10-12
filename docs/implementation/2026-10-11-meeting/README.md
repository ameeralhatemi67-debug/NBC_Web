# NBC meeting update — review handover

The identity, partners, twelve cities, Arabic wording, draft banks and final-submission exam flow are implemented against the existing working-tree baseline. No production release, provider migration or official content approval was performed.

## Review preview

Open [the local review](http://127.0.0.1:43210/#organizations). It runs an isolated PGlite database created under `.data/meeting-preview-*`; the selected directory is recorded in ignored `tmp/meeting-preview.json`. The existing local database was not modified. The campaign remains DRAFT and unfrozen, with 75 supplied active questions and zero approved questions. Six synthetic participant samples are retained for dashboard review. Administrative test runs are separate from real attempts, reports, winners and publication.

At [the committee page](http://127.0.0.1:43210/admin), choose **دخول عرض اللجنة**, then **بنك الأسئلة** to review the drafts, or **تجربة الإدارة** to run a complete stage. These demo controls and fake OTP are available only in explicit local mode. They do not establish production staff authentication or participant identity verification.

The preview process must remain running. If it stops, use `tmp/meeting-preview.json` for the isolated directory, set `NBC_RUNTIME_MODE=test`, `NBC_DEMO_MODE=true`, `OTP_PROVIDER=fake`, `NBC_ALLOW_REMOTE_DEMO=false`, and leave `DATABASE_URL` and `VERCEL` empty. Start Next on `127.0.0.1:43210` with the absolute `scripts/local-ux-no-env.cjs` preload to prevent reading operator environment files. `scripts/prepare-meeting-preview.mjs` creates a fresh isolated review database and applies the existing JSON import workflow; it never reuses an existing database.

## Delivered content

- [75 unapproved JSON drafts](../../question-bank/2026-10-11/official-drafts.json), [question review instructions](../../question-bank/2026-10-11/REVIEW.md) and [original-row/source audit](../../question-bank/2026-10-11/source-review.json).
- [Logo source/hash/dimension manifest](../../design/2026-10-11-partners/asset-provenance.json) and [decoded artwork review](../../design/2026-10-11-partners/logo-review.png). The supplied authority logo is used for active authority appearances. Educational assets come from the six official URLs in the agreed order. Hedayah's display name uses “بالمنطقة الشرقية”; Saad's name excludes the sponsorship description “الماسي”.
- Applicable participation copy at `/terms`; dark-only privacy review copy at `/privacy`; separate acknowledgment links before registration. [Policy selection manifest](policy-provenance.json) records the source hash and selected paragraphs.
- [Technical and approval gap report](TECHNICAL_GAPS.md), covering evidence, missing requirements, proposed owners and release dependencies. Privacy contact, processing basis/minors procedure, retention, media-award criteria, prize approval and patronage wording require committee/specialist decisions. Prize amounts and the calculated 52,000 SAR total are retained.

## Behavior and compatibility

New campaigns have 20/25/30 questions and editable saved choices until final submission. Question order remains stable within an attempt; the supplied option order is preserved. Cover/range references and official sources have explicit metadata. Official-source questions omit book hints. The admin editor records the original row and requires a source-review mark before approval of these imported drafts. The existing committee approval and freeze gates remain in place.

Final SUBMIT checks the revision and completeness, locks all answers and writes score, percentage and receipt in one transaction. SELECT changes are rejected afterward. Responses and review screens withhold correct answers and explanations until server-confirmed submission. The offline queue replays choices before SUBMIT; a stale revision requires review of the authoritative answers instead of overwriting them automatically.

Migration `011_meeting_rules` expands ordinals to 0–29, updates persisted Eastern cities and adopts the new rules only for the current DRAFT campaign without participant attempts, clearing its old freeze. Campaigns with prior attempts and started campaigns preserve their answer rules and snapshots. Migration `012_meeting_saved_copy` updates known old wording and book-topic overrides. Earlier migrations are preserved. Existing participant city records are not rewritten.

For a live content import, first migrate/initialize the approved database, dry-run the JSON import and then apply it with an accountable committee subject. Applying imports creates unapproved versions. Review and retire conflicting old active questions before approval/freeze. Do not approve all records merely to make the readiness indicator green.

## Verification

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed; operator environment files were blocked during local verification. |
| Full local regression suite | 124/124 passed. |
| Final meeting-engine and compatibility checks | 13/13 passed after quotation corrections and conflict-recovery changes; includes all stage counts, source approval, legacy behavior and offline recovery. |
| Disposable PostgreSQL | OTP, competition/migration tests, private grants/RLS and production HTTP phases passed. Both legacy locking and new final-submission behavior are covered. |
| Local HTTP integration | 38 checks passed, including registration, frozen scoring, duplicate submission, reports and backup/restore. |
| Production HTTP integration | 17 checks passed against a disposable local PostgreSQL setup with simulated providers. |
| Browser journeys | Completed 20, 25 and 30 questions with the supplied unapproved drafts through owned admin test runs. Earlier answer edits/book page survived reload; keyboard advance worked; mobile offline choices and queued SUBMIT recovered after reload. Feedback counts were 20/25/30 only after confirmed submission. |
| Identity and cities | All nine organization images decoded and loaded; desktop authority-right/partners-left/full educational row verified; tablet wraps three columns, mobile two. No horizontal overflow at the checked widths. All twelve cities appear in the exact supplied order. |
| Policy exclusions | Red content and correspondence are excluded from the participant copy; unresolved details are explicitly staged for review. |

[Browser evidence](browser-verification.json), [partner layout](../../design/2026-10-11-partners/desktop-preview.jpg), [draft bank screenshot](draft-bank-preview.jpg), [middle result](middle-result-preview.jpg), [secondary result](highschool-result-preview.jpg) and [mobile university result](university-mobile-result-preview.jpg) are saved alongside this handover. Raw local test logs are under ignored `tmp/meeting-*.log`.

Official content approval and production release are the next separate steps. Before opening real registration, resolve the dependencies in the gap report and obtain the recorded legal, IT, cybersecurity, data-governance and committee approvals appropriate to each requirement.

## Review adjustment, 12 October 2026

Removed the visible organization-name captions beneath all nine logos in the shared organization component. Role headings and descriptive image alternative text remain. This applies to the home page, footer and compact administration display. The local production build and formatting checks passed after this adjustment. The browser URL policy blocked the local page action, so a new visual screenshot was not captured; the earlier screenshots retain the captions from the original review.
