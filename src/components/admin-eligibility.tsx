'use client';
import { useId, useRef, useState } from 'react';
import { regions } from '@/lib/content';
import {
  MAX_CITIES_PER_REGION,
  defaultEligibility,
  parseCities,
  validateEligibility,
  type Eligibility,
} from '@/lib/eligibility';

// Committee control for who may register: which regions, and which cities each region offers.
export function eligibilityIssue(value: Eligibility) {
  try {
    validateEligibility(value);
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}
export function AdminEligibility({
  value,
  onChange,
  disabled = false,
}: {
  value: Eligibility;
  onChange: (next: Eligibility) => void;
  disabled?: boolean;
}) {
  const id = useId();
  // Typed text is kept as typed; the parsed list is what is saved.
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(value.regions.map((r) => [r, (value.cities[r] ?? []).join('\n')])),
  );
  // Unticking a region keeps its list for the session, so ticking it again is not destructive.
  const stash = useRef<Record<string, string>>({});
  const issue = eligibilityIssue(value);
  const commit = (selected: string[], source: Record<string, string>) =>
    onChange({
      regions: regions.filter((r) => selected.includes(r)),
      cities: Object.fromEntries(
        regions.filter((r) => selected.includes(r)).map((r) => [r, parseCities(source[r] ?? '')]),
      ),
    });
  function toggle(region: string, on: boolean) {
    const selected = on ? [...value.regions, region] : value.regions.filter((r) => r !== region);
    const next = { ...texts };
    if (on)
      next[region] = stash.current[region] ?? defaultEligibility.cities[region]?.join('\n') ?? '';
    else {
      stash.current[region] = next[region] ?? '';
      delete next[region];
    }
    setTexts(next);
    commit(selected, next);
  }
  function edit(region: string, text: string) {
    const next = { ...texts, [region]: text };
    setTexts(next);
    commit(value.regions, next);
  }
  function restore() {
    const next = Object.fromEntries(
      defaultEligibility.regions.map((r) => [r, defaultEligibility.cities[r].join('\n')]),
    );
    setTexts(next);
    commit(defaultEligibility.regions, next);
  }
  return (
    <section className="launch-card eligibility-card" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>أهلية التسجيل: المناطق والمدن</h3>
      <p className="launch-description">
        يختار المسجّل من المناطق والمدن المحددة هنا فقط. الافتراضي هو المنطقة الشرقية ومدنها. لا
        يتغير المسجلون الحاليون عند تعديل القائمة.
      </p>
      <fieldset className="region-picker" disabled={disabled}>
        <legend className="sr-only">المناطق المسموح بالتسجيل منها</legend>
        {regions.map((region) => (
          <label key={region} className={value.regions.includes(region) ? 'on' : ''}>
            <input
              type="checkbox"
              checked={value.regions.includes(region)}
              onChange={(e) => toggle(region, e.target.checked)}
            />
            {region}
          </label>
        ))}
      </fieldset>
      <div className="city-editors">
        {value.regions.map((region) => (
          <label key={region} className="city-editor">
            <span>
              مدن {region}
              <small>
                {' '}
                ({(value.cities[region] ?? []).length} / {MAX_CITIES_PER_REGION})
              </small>
            </span>
            <textarea
              rows={Math.min(8, Math.max(3, (value.cities[region] ?? []).length + 1))}
              value={texts[region] ?? ''}
              disabled={disabled}
              onChange={(e) => edit(region, e.target.value)}
              aria-describedby={`${id}-hint`}
            />
          </label>
        ))}
      </div>
      <span className="field-hint" id={`${id}-hint`}>
        اكتب مدينة أو محافظة في كل سطر. احذف السطر لإزالة الخيار، وأضف سطرًا لإضافة خيار جديد.
      </span>
      {issue && (
        <p className="launch-reason" role="alert">
          {issue}
        </p>
      )}
      <button type="button" className="text-link" disabled={disabled} onClick={restore}>
        استعادة الافتراضي (المنطقة الشرقية)
      </button>
    </section>
  );
}
