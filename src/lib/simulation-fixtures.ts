import type { ParticipantReport } from './service';
import { stageKeys, stageNames, meetingQuestionCounts } from './competition-domain';
import { resolveEligibility, type Eligibility } from './eligibility';
import { SIMULATION_SECONDS } from './simulation-domain';

// Dashboard illustration only. These rows never become participant/exam records.
export function simulationParticipants(
  seed: number,
  position: number,
  referenceDate: string,
  eligibility?: Eligibility,
  counts = meetingQuestionCounts,
): ParticipantReport[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const options = resolveEligibility({ eligibility });
  const cities = options.regions.flatMap((region) =>
    options.cities[region].map((city) => ({ region, city })),
  );
  const elapsed = Math.max(0, Math.min(SIMULATION_SECONDS, position));
  const base = Date.parse(referenceDate);
  const rows: ParticipantReport[] = [];
  for (let i = 0; i < 240; i++) {
    const stage = stageKeys[i % stageKeys.length];
    const registeredAt = 1 + Math.floor(random() * 220);
    const startedAt = registeredAt + 10 + Math.floor(random() * 50);
    const submittedAt = Math.max(120, startedAt + 30 + Math.floor(random() * 70));
    const completes = random() > 0.23;
    const starts = random() > 0.12;
    const score = Math.floor(random() * (counts[stage] + 1));
    const place = cities[Math.floor(random() * cities.length)];
    const female = random() > 0.5;
    const institution = `مؤسسة افتراضية ${1 + (i % 24)}`;
    if (elapsed < registeredAt) continue;
    const started = starts && elapsed >= startedAt;
    const submitted = started && completes && elapsed >= submittedAt;
    // One playback second represents one fictional competition minute.
    const timestamp = (seconds: number) => new Date(base + seconds * 60_000).toISOString();
    rows.push({
      id: `SIM-${seed}-${i}`,
      name: `مشارك افتراضي ${i + 1}`,
      stage: stageNames[stage],
      institution,
      gender: female ? 'أنثى' : 'ذكر',
      region: place.region,
      locality: place.city,
      village: '',
      created_at: timestamp(registeredAt),
      attempt_started_at: started ? timestamp(startedAt) : null,
      attempt_id: started ? `SIM-ATTEMPT-${seed}-${i}` : null,
      submitted_at: submitted ? timestamp(submittedAt) : null,
      score: submitted ? score : null,
      max_score: started ? counts[stage] : null,
      receipt: submitted ? `SIM-RECEIPT-${i}` : null,
      reading_flags: [],
    });
  }
  return rows;
}
