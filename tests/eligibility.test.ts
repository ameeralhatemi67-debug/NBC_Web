import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disposableDatabase } from './database-fixture';
import { migrate } from '../src/lib/migrations';
import { CompetitionService, initializeCompetition } from '../src/lib/competition-service';
import {
  assertEligible,
  defaultEligibility,
  parseCities,
  resolveEligibility,
  validateEligibility,
} from '../src/lib/eligibility';
import { easternCities } from '../src/lib/content';

const admin = { role: 'admin' as const, participant_id: null, actor: 'committee-1' };

test('the default is الشرقية with its cities, and a campaign without settings uses it', () => {
  assert.deepEqual(defaultEligibility.regions, ['الشرقية']);
  assert.deepEqual(defaultEligibility.cities['الشرقية'], easternCities);
  assert.deepEqual(resolveEligibility({}), defaultEligibility);
  assert.deepEqual(resolveEligibility(null), defaultEligibility);
});
test('city lists are parsed from lines, trimmed and de-duplicated', () => {
  assert.deepEqual(parseCities(' الدمام \n\nالخبر،  الخبر\r\nحفر   الباطن'), [
    'الدمام',
    'الخبر',
    'حفر الباطن',
  ]);
});
test('validation keeps the selected regions in order and rejects unsafe or incomplete settings', () => {
  assert.deepEqual(
    validateEligibility({
      regions: ['الشرقية', 'الرياض'],
      cities: { الرياض: [' الرياض ', 'الخرج'], الشرقية: ['الدمام'] },
    }),
    {
      regions: ['الرياض', 'الشرقية'],
      cities: { الشرقية: ['الدمام'], الرياض: ['الرياض', 'الخرج'] },
    },
  );
  for (const bad of [
    null,
    [],
    { regions: [], cities: {} },
    { regions: ['مدينة'], cities: { مدينة: ['س'] } },
    { regions: ['الشرقية', 'الشرقية'], cities: { الشرقية: ['الدمام'] } },
    { regions: ['الشرقية'], cities: {} },
    { regions: ['الشرقية'], cities: { الشرقية: [] } },
    { regions: ['الشرقية'], cities: { الشرقية: ['الدمام', 'الدمام'] } },
    { regions: ['الشرقية'], cities: { الشرقية: ['الدمام', '  '] } },
    { regions: ['الشرقية'], cities: { الشرقية: ['<b>x</b>'] } },
    { regions: ['الشرقية'], cities: { الشرقية: ['x'.repeat(61)] } },
    { regions: ['الشرقية'], cities: { الشرقية: ['الدمام'], الرياض: ['الرياض'] } },
    { regions: ['الشرقية'], cities: { الشرقية: [7] } },
  ])
    assert.throws(() => validateEligibility(bad), `should reject ${JSON.stringify(bad)}`);
});
test('registration accepts only listed cities; the region may be omitted for a single region', () => {
  assert.deepEqual(assertEligible(defaultEligibility, undefined, 'الدمام'), {
    region: 'الشرقية',
    locality: 'الدمام',
  });
  assert.throws(() => assertEligible(defaultEligibility, undefined, 'الرياض'));
  assert.throws(() => assertEligible(defaultEligibility, 'الرياض', 'الدمام'));
  assert.throws(() => assertEligible(defaultEligibility, undefined, { value: 'الدمام' }));
  const many = validateEligibility({
    regions: ['الشرقية', 'الرياض'],
    cities: { الشرقية: ['الدمام'], الرياض: ['الخرج'] },
  });
  assert.throws(() => assertEligible(many, undefined, 'الدمام'), 'region required with several');
  assert.throws(() => assertEligible(many, 'الرياض', 'الدمام'), 'city must belong to the region');
  assert.deepEqual(assertEligible(many, 'الرياض', 'الخرج'), {
    region: 'الرياض',
    locality: 'الخرج',
  });
});
test('the committee changes eligibility through settings, and a new campaign inherits it', async () => {
  process.env.NBC_RUNTIME_MODE = 'test';
  const db = await disposableDatabase();
  try {
    await migrate(db);
    await initializeCompetition(db);
    const service = new CompetitionService(db);
    assert.deepEqual(await service.registrationOptions(), defaultEligibility);
    const c = await service.current();
    const settings = {
      action: 'settings',
      version: c.version,
      title: c.title,
      feedbackMode: 'educational',
      leaderboardMode: c.leaderboardMode,
      closingPolicy: c.closingPolicy,
      graceMinutes: c.graceMinutes,
      opensAt: null,
      closesAt: null,
    };
    const next = {
      regions: ['الرياض', 'الشرقية'],
      cities: { الشرقية: ['الدمام'], الرياض: ['الخرج'] },
    };
    await service.configure(admin, { ...settings, eligibility: next });
    assert.deepEqual(await service.registrationOptions(), next);
    await assert.rejects(
      service.configure(admin, {
        ...settings,
        version: (await service.current()).version,
        eligibility: { regions: ['الرياض'], cities: {} },
      }),
      /مدينة/,
    );
    // Saving other settings without the field keeps the committee's choice.
    await service.configure(admin, { ...settings, version: (await service.current()).version });
    assert.deepEqual(await service.registrationOptions(), next);
    await service.configure(admin, { action: 'create', title: 'مسابقة جديدة' });
    assert.deepEqual(await service.registrationOptions(), next);
  } finally {
    await db.close();
  }
});
