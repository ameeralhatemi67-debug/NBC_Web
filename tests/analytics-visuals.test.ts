import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminAnalytics } from '../src/components/admin-analytics';
import {
  completionMinutes,
  durationDistribution,
  emptyFilters,
  filterParticipants,
  institutionParticipation,
  readingObservations,
  registrationDay,
  registrationTimeline,
  scoreDistribution,
  summarize,
  type AnalyticsParticipant,
} from '../src/lib/analytics';
import { cityCenters, cityProjection, geographicPath } from '../src/lib/city-geography';
import { easternCities } from '../src/lib/content';
import boundaries from '../src/lib/data/eastern-region-map.json';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import {
  initializeCompetition,
  CompetitionService,
  newCompetition,
} from '../src/lib/competition-service';
import { adminState } from '../src/lib/service';
import type { Database } from '../src/lib/database';
import { defaultPrizes } from '../src/lib/prizes';

const person = (patch: Partial<AnalyticsParticipant> = {}): AnalyticsParticipant => ({
  id: 'a',
  name: 'Example',
  stage: 'المرحلة المتوسطة',
  institution: 'مدرسة أ',
  gender: 'أنثى',
  region: 'الشرقية',
  locality: 'الدمام',
  score: 10,
  max_score: 20,
  created_at: '2026-10-10T22:00:00Z',
  attempt_id: 'a',
  attempt_started_at: '2026-10-11T09:00:00Z',
  submitted_at: '2026-10-11T09:30:00Z',
  reading_flags: ['page_jump'],
  ...patch,
});

test('analytics preserve normalized scores and valid zero durations, exclude unfinished/invalid clocks', () => {
  const people = [
    person(),
    person({ id: 'b', score: 20, max_score: 25, attempt_started_at: '2026-10-11T09:30:00Z' }),
    person({ id: 'c', submitted_at: null }),
    person({ id: 'd', attempt_started_at: undefined }),
    person({ id: 'e', attempt_started_at: 'invalid' }),
    person({ id: 'f', attempt_started_at: '2026-10-12T09:00:00Z' }),
  ];
  assert.equal(completionMinutes(people[1]), 0);
  for (const p of people.slice(2)) assert.equal(completionMinutes(p), null);
  const stats = summarize(people);
  assert.equal(stats.completed, 5);
  assert.equal(stats.average, 56);
  assert.equal(stats.averageMinutes, 15);
  assert.equal(stats.timedCompletions, 2);
  assert.equal(summarize([]).averageMinutes, null);
  assert.deepEqual(
    durationDistribution(people).map((bucket) => bucket.count),
    [1, 0, 1, 0, 0],
  );
  assert.equal(
    scoreDistribution([
      person({ score: 0 }),
      person({ score: 20 }),
      person({ submitted_at: null }),
    ]).reduce((sum, b) => sum + b.count, 0),
    2,
  );
  assert.equal(scoreDistribution([person({ score: 20 })]).at(-1)!.count, 1);
});

test('dates filter the registration cohort by Riyadh day, and timeline and school sums retain that cohort', () => {
  const people = [
    person(),
    person({
      id: 'b',
      locality: 'الخبر',
      institution: 'مدرسة أ',
      created_at: '2026-10-10T20:59:00Z',
    }),
    person({ id: 'c', institution: ' مدرسة   أ ', submitted_at: null }),
    person({ id: 'd', institution: null }),
  ];
  assert.equal(registrationDay(people[0].created_at), '2026-10-11');
  assert.equal(registrationDay(people[1].created_at), '2026-10-10');
  const selected = filterParticipants(people, {
    ...emptyFilters,
    fromDate: '2026-10-11',
    toDate: '2026-10-11',
    gender: 'أنثى',
    locality: 'الدمام',
  });
  assert.equal(selected.length, 3);
  assert.deepEqual(registrationTimeline(selected), [
    { day: '2026-10-11', count: 3, cumulative: 3 },
  ]);
  const schools = institutionParticipation(people);
  assert.equal(summarize(people).institutions, 2);
  assert.equal(schools.length, 2); // Names are combined within each city, not across different cities.
  assert.equal(schools[0].total, 2);
  assert.equal(schools[0].completed, 1);
  assert.equal(
    filterParticipants(people, { fromDate: '2026-10-12', toDate: '2026-10-10' }).length,
    0,
  );
});

test('reading observations count unique flagged attempts without treating flags as disjoint', () => {
  const rows = [
    person({ reading_flags: ['page_jump', 'page_jump', 'rapid_answers'] }),
    person({ id: 'b', reading_flags: ['rapid_page_turn'], attempt_id: null }),
  ];
  assert.deepEqual(
    readingObservations(rows).map((row) => row.count),
    [1, 0, 1],
  );
});

test('all 12 eligible cities have sourced centers and the bundled published geometry produces finite paths', () => {
  assert.deepEqual(new Set(cityCenters.map((city) => city.name)), new Set(easternCities));
  for (const city of cityCenters) {
    const [x, y] = cityProjection(city.longitude, city.latitude);
    assert.ok(x > 0 && x < 560 && y > 0 && y < 470, city.name);
  }
  assert.ok(boundaries.features.some((feature) => feature.properties.iso === 'SA-04'));
  for (const feature of boundaries.features) {
    const path = geographicPath(
      feature.geometry.coordinates as number[][][] | number[][][][],
      feature.geometry.type === 'MultiPolygon',
    );
    assert.match(path, /^M/);
    assert.doesNotMatch(path, /NaN|Infinity/);
  }
});

test('admin render includes every accepted visual, filters, real counts and honest no-completion state', () => {
  const html = renderToStaticMarkup(
    createElement(AdminAnalytics, { people: [person({ submitted_at: null, score: null })] }),
  );
  for (const title of [
    'المشاركة حسب المدينة',
    'الإكمال حسب المرحلة',
    'توزيع الذكور والإناث',
    'توزيع الدرجات',
    'تراكم التسجيل مع الوقت',
    'توزيع وقت الإكمال',
    'الخريطة الحرارية للمشاركة',
    'مشاركة المدارس والجامعات',
    'ملاحظات التصفح',
    'متوسط وقت الإكمال',
    'أكملوا المسابقة',
    'فترة التسجيل',
    'مرحلة الجهات التعليمية',
  ])
    assert.ok(html.includes(title), title);
  assert.match(html, /تظهر الدرجات بعد إرسال أول مشاركة مطابقة/);
  assert.match(html, /لا توجد مشاركات مكتملة لها وقت بدء وإرسال صالحان/);
  assert.doesNotMatch(html, /بيانات تجريبية للتخطيط فقط|SECRET_ANSWER/);
});

test('admin report joins current attempt timing and unique committee flags, excluding rehearsals and other campaigns', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  const singleton = globalThis as unknown as { nbcDb?: Promise<Database> };
  const previous = singleton.nbcDb;
  try {
    await migrate(db);
    await initializeCompetition(db);
    await db.query(
      "INSERT INTO settings(id,value) VALUES('published','false'),('prizes',$1) ON CONFLICT(id) DO NOTHING",
      [JSON.stringify(defaultPrizes)],
    );
    const competition = await new CompetitionService(db).current();
    await db.query(
      'INSERT INTO participants(id,identity,name,phone,stage,region,locality,institution,gender) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        'analytics-person',
        'analytics-person',
        'Test',
        'masked',
        'المرحلة المتوسطة',
        'الشرقية',
        'الدمام',
        'مدرسة أ',
        'أنثى',
      ],
    );
    await db.query(
      'INSERT INTO attempts(id,participant_id,competition_id,stage,participant_number,questions,max_score,score,created_at,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        'analytics-attempt',
        'analytics-person',
        competition.id,
        'middle',
        '12345678',
        JSON.stringify(Array.from({ length: 20 }, () => ({ id: 'q' }))),
        20,
        10,
        '2026-10-11T09:00:00Z',
        '2026-10-11T09:30:00Z',
      ],
    );
    for (const detail of [
      {
        attemptId: 'analytics-attempt',
        competitionId: competition.id,
        testRun: false,
        flags: ['page_jump', 'rapid_answers'],
      },
      {
        attemptId: 'analytics-attempt',
        competitionId: competition.id,
        testRun: false,
        flags: ['page_jump'],
      },
      {
        attemptId: 'analytics-attempt',
        competitionId: competition.id,
        testRun: true,
        flags: ['rapid_page_turn'],
      },
      {
        attemptId: 'analytics-attempt',
        competitionId: 'other',
        testRun: false,
        flags: ['rapid_page_turn'],
      },
    ])
      await db.query('INSERT INTO audit(actor,action,detail) VALUES($1,$2,$3)', [
        'test',
        'ملاحظة على وتيرة القراءة',
        JSON.stringify(detail),
      ]);
    singleton.nbcDb = Promise.resolve(db);
    const report = await adminState();
    const p = report.participants.find((p) => p.id === 'analytics-person')!;
    assert.equal(completionMinutes(p), 30);
    assert.deepEqual(new Set(p.reading_flags), new Set(['page_jump', 'rapid_answers']));
    assert.equal(JSON.stringify(p).includes('correctAnswers'), false);
    assert.equal((await new CompetitionService(db).current()).state, competition.state);
  } finally {
    singleton.nbcDb = previous;
    await db.close();
  }
});
