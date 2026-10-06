// Shared fixtures for browser checks that mock /api/participant with real server-scored data.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function fixtures(base, browser) {
  const auth = await browser.newContext();
  assert.equal(
    (
      await auth.request.post(base + '/api/auth/demo-staff', {
        data: { role: 'admin' },
        headers: { Origin: base },
      })
    ).status(),
    200,
  );
  const bank = await (await auth.request.get(base + '/api/admin')).json();
  async function completedRun(correctCount) {
    const response = await auth.request.post(base + '/api/admin/test-run/start', {
      data: { stage: 'middle', reveal: true, synthetic: true },
      headers: { Origin: base },
    });
    assert.equal(response.status(), 200);
    let state = await response.json();
    const first = structuredClone(state);
    for (const [index, question] of state.attempt.questions.entries()) {
      const original = bank.questions.find((item) => item.id === question.id);
      const correct = original.correctAnswers.map((n) =>
        question.options.indexOf(original.options[n]),
      );
      const selected =
        index < correctCount
          ? correct
          : [question.options.findIndex((_, n) => !correct.includes(n))];
      const event = await auth.request.post(base + '/api/admin/test-run/event', {
        data: {
          clientEventId: randomUUID(),
          attemptId: state.attempt.id,
          kind: 'CHECK',
          questionId: question.id,
          selected,
          revision: state.attempt.revision,
        },
        headers: { Origin: base },
      });
      assert.equal(event.status(), 200);
      state = await event.json();
    }
    const submitted = await auth.request.post(base + '/api/admin/test-run/event', {
      data: {
        clientEventId: randomUUID(),
        attemptId: state.attempt.id,
        kind: 'SUBMIT',
        revision: state.attempt.revision,
      },
      headers: { Origin: base },
    });
    assert.equal(submitted.status(), 200);
    return { result: await submitted.json(), first };
  }
  const { result: completed, first } = await completedRun(5);
  await auth.close();
  const intro = structuredClone(completed);
  intro.attempt = null;
  intro.competition.state = 'OPEN';
  intro.competition.opensAt = '2026-10-06T09:00:00Z';
  intro.competition.closesAt = new Date(Date.now() + 3 * 86400000).toISOString();
  intro.participant.name = 'فاطمة أحمد';
  const exam = structuredClone(first);
  exam.competition.state = 'OPEN';
  return { intro, completed, exam };
}

module.exports = { fixtures };
