import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changedSettings,
  forRegistrants,
  graceSentence,
  impactSentence,
  launchStep,
  nextAction,
  preconditions,
  relativePhrase,
  scheduleIssue,
  stageReadiness,
  studentResultPreview,
  trackLabels,
} from '../src/lib/admin-launch';
import { newCompetition } from '../src/lib/competition-service';
import {
  stageKeys,
  type BookVersion,
  type Competition,
  type CompetitionQuestion,
} from '../src/lib/competition-domain';
import {
  leaderboardModeLines,
  resultHiddenLine,
  resultReceivedTitle,
} from '../src/lib/result-presentation';
import { resultSentence } from '../src/lib/format';

const book: BookVersion = {
  id: 'book-1',
  title: 'الكتاب',
  url: '/books/x.pdf',
  sha256: 'a'.repeat(64),
  pageCount: 66,
  approved: true,
};
const competition = (patch: Partial<Competition> = {}): Competition => ({
  ...newCompetition('c1', book.id),
  ...patch,
});
function bank(counts: Record<string, [number, number]>, patch: Partial<CompetitionQuestion> = {}) {
  // counts[stage] = [approved, drafts]
  const out: CompetitionQuestion[] = [];
  for (const stage of stageKeys) {
    const [approved, drafts] = counts[stage] ?? [20, 0];
    for (let i = 0; i < approved + drafts; i += 1)
      out.push({
        id: `${stage}-${i}`,
        stage,
        active: true,
        approved: i < approved,
        bookVersionId: book.id,
        pdfPage: 5,
        ...patch,
      } as CompetitionQuestion);
  }
  return out;
}
const now = Date.parse('2026-10-06T10:00:00Z');

test('the six-step track follows state and the freeze mark, and never shows a state code', () => {
  assert.equal(trackLabels.length, 6);
  assert.equal(launchStep(competition(), now), 0);
  assert.equal(launchStep(competition({ frozenAt: '2026-10-05T10:00:00Z' }), now), 1);
  assert.equal(
    launchStep(competition({ state: 'SCHEDULED', opensAt: '2026-10-09T10:00:00Z' }), now),
    2,
  );
  assert.equal(launchStep(competition({ state: 'OPEN' }), now), 3);
  assert.equal(launchStep(competition({ state: 'CLOSED' }), now), 4);
  assert.equal(launchStep(competition({ state: 'RESULTS_PUBLISHED' }), now), 5);
  // A scheduled competition past its opening time is open; past its closing time it is closed.
  assert.equal(
    launchStep(
      competition({
        state: 'SCHEDULED',
        opensAt: '2026-10-06T09:00:00Z',
        closesAt: '2026-10-08T09:00:00Z',
      }),
      now,
    ),
    3,
  );
  assert.equal(
    launchStep(competition({ state: 'OPEN', closesAt: '2026-10-06T09:00:00Z' }), now),
    4,
  );
  for (const label of trackLabels) assert.ok(!/^[A-Z_]+$/.test(label));
});

test('exactly one primary action per step, matching the approved copy', () => {
  const counts = { registered: 312, inProgress: 12 };
  const actions = [0, 1, 2, 3, 4, 5].map((step) => nextAction(step, counts));
  assert.deepEqual(
    actions.map((a) => a.action),
    ['freeze', 'open', 'open', 'close', 'publish', 'unpublish'],
  );
  assert.deepEqual(
    actions.map((a) => a.hold),
    [false, true, true, true, false, true],
  );
  assert.deepEqual(
    actions.map((a) => a.danger),
    [false, false, false, false, false, true],
  );
  assert.equal(actions[0].title, 'اعتمد نسخة الأسئلة');
  assert.equal(actions[1].label, 'اضغط مطولًا لفتح المسابقة');
  assert.equal(actions[4].title, 'اعتمد نشر النتائج');
  assert.ok(actions[1].description.includes('312'), 'the real registrant count');
  assert.ok(actions[1].description.includes('لا يمكن تعديل الأسئلة بعد الفتح'));
  assert.ok(actions[3].description.includes('312') && actions[3].description.includes('12'));
  assert.ok(actions[5].description.includes('312'));
});

test('registrant phrases agree in number', () => {
  assert.equal(forRegistrants(1), 'لمسجّل واحد');
  assert.equal(forRegistrants(2), 'لمسجّلَين');
  assert.equal(forRegistrants(7), 'لـ 7 مسجّلين');
  assert.equal(forRegistrants(312), 'لـ 312 مسجّلًا');
  assert.ok(impactSentence('open', { registered: 0, inProgress: 0 }).includes('لا يوجد مسجّلون'));
});

test('preconditions mirror the server rule: exactly 20 active and all approved per stage', () => {
  const ok = preconditions(book, bank({}));
  assert.equal(ok.canFreeze, true);
  assert.equal(ok.list.filter((p) => p.informational).length, 1, 'rehearsal is informational only');
  const short = preconditions(book, bank({ middle: [17, 0] }));
  assert.equal(short.canFreeze, false);
  const middle = short.stages[0];
  assert.equal(middle.approved, 17);
  assert.match(middle.reason, /ينقص 3/);
  const drafts = stageReadiness(bank({ highschool: [20, 2] }), book)[1];
  assert.equal(drafts.ok, false, '22 active questions with drafts cannot be frozen');
  assert.match(drafts.reason, /عطّل الزائد/);
  assert.match(drafts.reason, /2 مسودات/);
  const unapprovedBook = preconditions({ ...book, approved: false }, bank({}));
  assert.equal(unapprovedBook.canFreeze, false);
  assert.equal(unapprovedBook.list[0].id, 'book');
  // Questions written for another book version do not count.
  const other = stageReadiness(bank({}, { bookVersionId: 'old-book' }), book);
  assert.ok(other.every((s) => s.active === 0 && !s.ok));
});

test('schedule needs both dates, in order, in the future', () => {
  assert.ok(scheduleIssue(null, null, now));
  assert.ok(scheduleIssue('2026-10-10T10:00:00Z', null, now));
  assert.ok(scheduleIssue('2026-10-10T10:00:00Z', '2026-10-09T10:00:00Z', now));
  assert.ok(scheduleIssue('2026-10-01T10:00:00Z', '2026-10-05T10:00:00Z', now));
  assert.equal(scheduleIssue('2026-10-10T10:00:00Z', '2026-10-20T10:00:00Z', now), '');
});

test('relative chips use Arabic plural forms', () => {
  const at = (ms: number) => new Date(now + ms).toISOString();
  assert.equal(relativePhrase(at(86400000), now), 'غدًا');
  assert.equal(relativePhrase(at(2 * 86400000), now), 'بعد يومين');
  assert.equal(relativePhrase(at(8 * 86400000), now), 'بعد 8 أيام');
  assert.equal(relativePhrase(at(22 * 86400000), now), 'بعد 22 يومًا');
  assert.equal(relativePhrase(at(2 * 3600000), now), 'بعد ساعتين');
  assert.equal(relativePhrase(at(30 * 60000), now), 'بعد 30 دقيقة');
  assert.equal(relativePhrase(at(-86400000), now), 'أمس');
  assert.equal(relativePhrase(at(-3 * 86400000), now), 'منذ 3 أيام');
});

test('grace sentence uses Gregorian Riyadh time and the close time plus minutes', () => {
  const sentence = graceSentence('2026-10-14T06:00:00Z', 60);
  assert.match(sentence, /^تبقى المحاولات القائمة قابلة للمزامنة حتى /);
  assert.match(sentence, /2026/, 'Gregorian year');
  assert.match(sentence, /10:00/, '06:00Z + 60 minutes is 10:00 in Riyadh');
  assert.ok(!/١|٢|٣|٤|٥|٦|٧|٨|٩|٠/.test(sentence), 'Latin digits');
  assert.match(graceSentence(null, 60), /حدّد موعد الإغلاق/);
});

test('unsaved changes are counted per setting', () => {
  const saved = competition();
  assert.deepEqual(changedSettings(saved, saved), []);
  assert.deepEqual(changedSettings(saved, { ...saved, leaderboardMode: 'hidden' }), [
    'leaderboardMode',
  ]);
  assert.deepEqual(
    changedSettings(saved, {
      ...saved,
      title: 'x',
      graceMinutes: 30,
      closesAt: '2026-10-20T00:00:00Z',
    }),
    ['title', 'closesAt', 'graceMinutes'],
  );
  const immediate = competition({ closingPolicy: 'immediate' });
  assert.deepEqual(changedSettings(immediate, { ...immediate, graceMinutes: 5 }), []);
});

test('the committee preview is built from the student screen strings', () => {
  for (const mode of ['own_result_only', 'publish_after_close', 'public_live'] as const) {
    const preview = studentResultPreview(mode);
    assert.equal(preview.title, resultReceivedTitle);
    assert.equal(preview.policy, leaderboardModeLines[mode]);
    assert.equal(preview.sentence, resultSentence(14, 20));
  }
  const hidden = studentResultPreview('hidden');
  assert.equal(hidden.sentence, resultHiddenLine, 'a hidden score is not promised');
  assert.equal(hidden.policy, leaderboardModeLines.hidden);
  assert.ok(!hidden.policy.includes('نتيجتك تظهر لك'));
  assert.equal(studentResultPreview('public_live').ranking.length > 0, true);
});
