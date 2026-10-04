import { readFile } from 'node:fs/promises';
import { connectDatabase } from '../src/lib/database.ts';
import { migrationsCurrent } from '../src/lib/migrations.ts';
import { CompetitionService } from '../src/lib/competition-service.ts';
import { validateQuestion } from '../src/lib/competition-domain.ts';
import { isLocalMode } from '../src/lib/runtime.ts';
const [file, ...flags] = process.argv.slice(2);
if (!file)
  throw new Error(
    'Usage: npm run questions:import -- bank.json [--apply --actor committee-subject]',
  );
const apply = flags.includes('--apply');
const actor = flags[flags.indexOf('--actor') + 1];
if (apply && (!flags.includes('--actor') || !actor || actor.startsWith('--')))
  throw new Error('Applying an import requires an accountable --actor.');
const input = JSON.parse(await readFile(file, 'utf8'));
if (
  !Array.isArray(input) ||
  input.length > 60 ||
  new Set(input.map((q) => q.id)).size !== input.length
)
  throw new Error('Expected up to 60 distinct question records.');
const db = await connectDatabase();
try {
  if (!(await migrationsCurrent(db)))
    throw new Error('Run db:migrate and initialize the application first.');
  const service = new CompetitionService(db);
  const competition = await service.current();
  const book = await service.book(competition);
  await service.verifyBook(book);
  const prepared = input.map((q) => ({
    ...q,
    correct: q.correctAnswers?.[0],
    bookVersionId: book.id,
    active: q.active !== false,
    approved: false,
    fixture: q.fixture === true,
    source: q.source ?? '',
    answerExplanation: q.answerExplanation ?? '',
    topic: q.topic ?? '',
    sourceExcerpt: q.sourceExcerpt ?? '',
  }));
  for (const q of prepared) {
    if (input.find((v) => v.id === q.id).fixture && !isLocalMode())
      throw new Error('Fixtures cannot be imported into production.');
    validateQuestion(q, book);
  }
  if (apply)
    await db.transaction(async (tx) => {
      await tx.query("SELECT id FROM settings WHERE id='current_competition' FOR UPDATE");
      for (const q of prepared) {
        const old = (await tx.query('SELECT body FROM questions WHERE id=$1 FOR UPDATE', [q.id]))
          .rows[0]?.body;
        const next = {
          ...q,
          version: (old?.version ?? 0) + 1,
          approved: false,
          fixture: old?.fixture === true || q.fixture,
        };
        await tx.query(
          'INSERT INTO questions VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
          [q.id, JSON.stringify(next)],
        );
        await tx.query(
          'INSERT INTO question_versions(question_id,version,body,actor) VALUES($1,$2,$3,$4)',
          [q.id, next.version, JSON.stringify(next), actor],
        );
      }
      await tx.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        actor,
        'استيراد مسودات الأسئلة',
        JSON.stringify({
          competitionId: competition.id,
          ids: prepared.map((q) => q.id),
          count: prepared.length,
        }),
      ]);
    });
  console.log(
    `${apply ? 'Imported as unapproved drafts' : 'Validated, no changes applied'}: ${prepared.length} questions.`,
  );
} finally {
  await db.close();
}
