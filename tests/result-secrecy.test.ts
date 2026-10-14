import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompetitionResult } from '../src/components/competition-result';
import { newCompetition, officialBook } from '../src/lib/competition-service';
import type { CompetitionState } from '../src/lib/competition-domain';

test('result renders aggregate score only even with an older cached answer review', () => {
  const data = {
    participant: { name: 'Test', stage: 'المرحلة المتوسطة' },
    competition: { ...newCompetition('result-secrecy'), leaderboardMode: 'committee_only' },
    book: officialBook,
    attempt: {
      id: 'test',
      score: 6,
      maxScore: 20,
      percentage: 30,
      participantNumber: 'TEST-123',
      questions: [{ id: 'q', title: 'SECRET_QUESTION', options: ['SECRET_ANSWER'], pdfPage: 10 }],
      answers: { q: { selected: [0], locked: true } },
      feedback: { q: { isCorrect: false, correctAnswers: [0], explanation: 'SECRET_EXPLANATION' } },
    },
  } as unknown as CompetitionState;
  const html = renderToStaticMarkup(
    createElement(CompetitionResult, { data, banner: null, testRunId: 'test', examView: true }),
  );
  assert.match(html, /٦/);
  assert.match(html, /٢٠/);
  assert.match(html, /TEST-123/);
  assert.doesNotMatch(
    html,
    /SECRET_|إجاباتك والتوضيحات|اقرأ مرة أخرى|result-question-status|result-review/,
  );
});
