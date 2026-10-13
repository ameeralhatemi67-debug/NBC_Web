import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  arDigits,
  arMoney,
  arPlural,
  closingPhrase,
  competitionStateLabels,
  NumPair,
  pairLtr,
  resultSentence,
  riyadhDateTime,
} from '../src/lib/format';

test('Arabic pending copy covers singular, dual, few, many, zero and totals over 100', () => {
  const forms = [
    'إجابة واحدة بانتظار الإرسال',
    'إجابتان بانتظار الإرسال',
    'إجابات بانتظار الإرسال',
    'إجابة بانتظار الإرسال',
  ] as const;
  for (const [n, expected] of [
    [0, '٠ إجابة بانتظار الإرسال'],
    [1, forms[0]],
    [2, forms[1]],
    [3, '٣ إجابات بانتظار الإرسال'],
    [10, '١٠ إجابات بانتظار الإرسال'],
    [11, '١١ إجابة بانتظار الإرسال'],
    [99, '٩٩ إجابة بانتظار الإرسال'],
    [100, '١٠٠ إجابة بانتظار الإرسال'],
    [103, '١٠٣ إجابة بانتظار الإرسال'],
  ] as const)
    assert.equal(arPlural(n, forms), expected);
});

test('arDigits and arMoney convert digits and thousands separators only', () => {
  assert.equal(arDigits('20 سؤالًا'), '٢٠ سؤالًا');
  assert.equal(arDigits('1,234, ثم 5'), '١٬٢٣٤, ثم ٥');
  assert.equal(arMoney(16500), '١٦٬٥٠٠');
  assert.equal(arMoney(52000), '٥٢٬٠٠٠');
});

test('NumPair and pairLtr render numeric pairs inside an explicit LTR isolate in RTL prose', () => {
  const expected = '<bdi dir="ltr">٥ / ٢٠</bdi>';
  assert.equal(renderToStaticMarkup(pairLtr(5, 20)), expected);
  assert.equal(renderToStaticMarkup(createElement(NumPair, { a: 5, b: 20 })), expected);
  assert.equal(
    renderToStaticMarkup(
      createElement('p', { dir: 'rtl' }, createElement(NumPair, { a: 0, b: 20 })),
    ),
    '<p dir="rtl"><bdi dir="ltr">٠ / ٢٠</bdi></p>',
  );
});

test('every competition state has plain Arabic participant copy', () => {
  assert.deepEqual(competitionStateLabels, {
    DRAFT: 'المسابقة لم تفتح بعد',
    SCHEDULED: 'المسابقة لم تفتح بعد',
    OPEN: 'المسابقة مفتوحة الآن',
    CLOSED: 'أُغلقت المسابقة',
    RESULTS_PUBLISHED: 'أُعلنت النتائج',
  });
});

test('closing copy handles days, hours, minutes and the expired boundary', () => {
  const now = Date.parse('2026-10-06T09:00:00Z');
  const after = (ms: number) => new Date(now + ms).toISOString();
  assert.equal(closingPhrase(after(3 * 86400000), now), 'تُغلق المسابقة بعد ٣ أيام');
  assert.equal(closingPhrase(after(2 * 86400000), now), 'تُغلق المسابقة بعد يومين');
  assert.equal(closingPhrase(after(86400000), now), 'تُغلق المسابقة بعد يوم واحد');
  assert.equal(closingPhrase(after(2 * 3600000), now), 'تُغلق المسابقة بعد ساعتين');
  assert.equal(closingPhrase(after(3600000), now), 'تُغلق المسابقة بعد ساعة واحدة');
  assert.equal(closingPhrase(after(3 * 60000), now), 'تُغلق المسابقة بعد ٣ دقائق');
  assert.equal(closingPhrase(after(1), now), 'تُغلق المسابقة بعد دقيقة واحدة');
  assert.equal(closingPhrase(after(0), now), 'انتهى موعد إغلاق المسابقة');
  assert.equal(closingPhrase(after(-1), now), 'انتهى موعد إغلاق المسابقة');
});

test('exact closing time uses Gregorian dates, Arabic-Indic digits and Riyadh time independent of host timezone', () => {
  const result = riyadhDateTime('2026-10-06T09:00:00Z');
  assert.ok(result.includes('٢٠٢٦'), result);
  assert.ok(result.includes('١٢:٠٠'), result);
  assert.ok(!/\d/.test(result), result);
});

test('result copy keeps correct then total in reading order and uses the total noun', () => {
  assert.equal(resultSentence(5, 20), 'أجبت إجابة صحيحة عن ٥ من ٢٠ سؤالًا.');
  assert.equal(resultSentence(3, 10), 'أجبت إجابة صحيحة عن ٣ من ١٠ أسئلة.');
  assert.equal(resultSentence(0, 20), 'أجبت إجابة صحيحة عن ٠ من ٢٠ سؤالًا.');
});
