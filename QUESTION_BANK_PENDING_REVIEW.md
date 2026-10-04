# Official question bank: pending human review

The production platform supports 60 questions, but this change does **not** supply 60 approved factual questions. Production initialization creates an empty bank and refuses to open until the committee approves and freezes exactly 20 questions for each stage.

The dedicated NBC backend is provisioned. Production administrator tests can request clearly labeled synthetic snapshots to verify the shared engine while this bank is empty. These are stored only in owned admin test sessions, never in the official question bank or real attempts. This does not complete any of the 60 content reviews below. Keep the official book unapproved and the campaign DRAFT until review is complete.

## Evidence and extraction limit

The official PDF is `public/documents/national-belonging.pdf`, with 66 digital pages and SHA-256:

`ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd`

The PDF renders correctly. Visual inspection confirmed that PDF page 29 is printed page 27. Its Arabic text uses encoded font glyphs: extraction with pypdf produced numeric glyph codes rather than dependable Arabic prose. This is insufficient evidence for automatically authoring and validating 60 questions. Do not infer a universal pagination offset from the one inspected page.

`src/lib/competition-fixtures.ts` contains 60 synthetic local test records derived from the previous demo. Their source mappings are test data, not verified book references. They are marked `fixture: true`, shown with a local-content notice, and excluded from production initialization and production freeze. Never remove those markers to launch a competition.

## Remaining content work

1. Read the complete official book visually, or obtain a faithful, accessible Arabic transcription from the publisher. Review any OCR against the rendered pages.
2. Produce 20 distinct middle-school, 20 high-school, and 20 university questions. For every question, record the exact digital page and printed page separately, a short supporting source excerpt, options, correct option indices, explanation, topic, difficulty, and a one/two-page digital hint range.
3. Have a subject reviewer check the factual answer and page evidence; have an education reviewer check stage suitability, ambiguity, and distractors. The source excerpt is private committee evidence and is never returned before lock through participant APIs.
4. Enter/import drafts through Admin > بنك الأسئلة. Use `docs/question-bank/import-template.json` only as a **synthetic format example**. Replace its content with reviewed material and use new identifiers; do not repurpose fixture identifiers.
5. Approve each version as an administrator. Editors can draft and edit but cannot approve, freeze, publish, run admin tests, or recover attempts.
6. Use the coverage map for every stage to review repeated source pages and uncovered sections. Automatic checks catch exact normalized duplicates; reviewers must assess similar wording and conceptual duplication.
7. Approve the exact book, freeze all three banks, and run the full administrator test experience for all stages before scheduling/opening.

Validation checks structure, page bounds, answer indices, options, stage, book identity, and counts. It cannot establish that an Arabic factual claim or printed-page mapping is true. That responsibility remains with the reviewing committee.

The PDF canvas has an accessible page label and keyboard controls, but its encoded text cannot currently provide a dependable screen-reader transcript. A reviewed accessible text edition/text layer remains a content-accessibility dependency before an inclusive public launch.
