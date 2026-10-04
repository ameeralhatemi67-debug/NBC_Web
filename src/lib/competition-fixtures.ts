import { seedQuestions } from './seed';
import { stageKeys, type CompetitionQuestion } from './competition-domain';
import { officialBook } from './competition-service';
// Synthetic UI fixtures only. These have no verified relationship to the PDF pages.
export const competitionFixtures: CompetitionQuestion[] = stageKeys.flatMap((stage) =>
  Array.from({ length: 20 }, (_, i) => {
    const q = seedQuestions[i % seedQuestions.length];
    return {
      ...q,
      id: `${stage}-demo${String(i + 1).padStart(2, '0')}`,
      title: `[تجريبي ${i + 1}] ${q.title}`,
      stage,
      type: 'single_choice',
      correctAnswers: [q.correct],
      pdfPage: i + 8,
      printedPage: i + 6,
      hintPdfPageStart: i + 7,
      hintPdfPageEnd: i + 8,
      answerExplanation: 'مثال لاختبار الواجهة، ليس سؤالًا موثقًا من الكتاب.',
      topic: 'تجريبي',
      difficulty: 'easy',
      bookVersionId: officialBook.id,
      sourceExcerpt: 'محتوى اصطناعي محلي للاختبار فقط.',
      active: true,
      fixture: true,
    };
  }),
);
