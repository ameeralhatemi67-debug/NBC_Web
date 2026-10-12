import { easternCities, regions } from './content';
import { AppError } from './domain';

// Geographic eligibility for registration. Stored per competition so a future campaign can open
// other regions. A competition without this field uses the original default: Eastern Province.
export type Eligibility = { regions: string[]; cities: Record<string, string[]> };
export const defaultRegion = 'الشرقية';
export const defaultEligibility: Eligibility = {
  regions: [defaultRegion],
  cities: { [defaultRegion]: [...easternCities] },
};
export const MAX_CITIES_PER_REGION = 100;
export const MAX_CITY_LENGTH = 60;

export function resolveEligibility(c?: { eligibility?: Eligibility } | null): Eligibility {
  return c?.eligibility ?? defaultEligibility;
}
export function parseCities(text: string) {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const line of text.split(/\r?\n|،|,/)) {
    const city = line.replace(/\s+/g, ' ').trim();
    if (city && !seen.has(city)) {
      seen.add(city);
      cities.push(city);
    }
  }
  return cities;
}
// Throws a user-facing Arabic message. Used by the API and, unchanged, by the admin form.
export function validateEligibility(value: unknown): Eligibility {
  const invalid = (message: string): never => {
    throw new AppError(message);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid('إعدادات الأهلية غير صالحة.');
  const raw = value as { regions?: unknown; cities?: unknown };
  if (!Array.isArray(raw.regions) || !raw.regions.length)
    return invalid('اختر منطقة واحدة على الأقل للتسجيل.');
  if (
    raw.regions.some((r) => typeof r !== 'string' || !regions.includes(r)) ||
    new Set(raw.regions).size !== raw.regions.length
  )
    return invalid('منطقة غير صالحة أو مكررة.');
  if (!raw.cities || typeof raw.cities !== 'object' || Array.isArray(raw.cities))
    return invalid('قوائم المدن غير صالحة.');
  const selected = regions.filter((r) => (raw.regions as string[]).includes(r));
  const given = raw.cities as Record<string, unknown>;
  if (Object.keys(given).some((key) => !selected.includes(key)))
    return invalid('توجد قائمة مدن لمنطقة غير محددة.');
  const cities: Record<string, string[]> = {};
  for (const region of selected) {
    const list = given[region];
    if (!Array.isArray(list)) return invalid(`أضف مدينة واحدة على الأقل لمنطقة ${region}.`);
    const clean: string[] = [];
    for (const item of list) {
      if (typeof item !== 'string') return invalid('اسم مدينة غير صالح.');
      const city = item.replace(/\s+/g, ' ').trim();
      if (!city || city.length > MAX_CITY_LENGTH || /[\u0000-\u001f\u007f<>]/.test(city))
        return invalid(`اسم مدينة غير صالح في ${region}.`);
      if (clean.includes(city)) return invalid(`المدينة «${city}» مكررة في ${region}.`);
      clean.push(city);
    }
    if (!clean.length) return invalid(`أضف مدينة واحدة على الأقل لمنطقة ${region}.`);
    if (clean.length > MAX_CITIES_PER_REGION)
      return invalid(`الحد الأقصى ${MAX_CITIES_PER_REGION} مدينة لكل منطقة.`);
    cities[region] = clean;
  }
  return { regions: selected, cities };
}
// Region may be omitted only when the campaign has exactly one region.
export function assertEligible(options: Eligibility, region: unknown, locality: unknown) {
  const chosen =
    typeof region === 'string' && region.trim()
      ? region.trim()
      : options.regions.length === 1
        ? options.regions[0]
        : '';
  if (
    !chosen ||
    !options.regions.includes(chosen) ||
    typeof locality !== 'string' ||
    !options.cities[chosen]?.includes(locality)
  )
    throw new AppError('تحقق من المنطقة والمدينة. التسجيل متاح للمناطق والمدن المعلنة فقط.');
  return { region: chosen, locality };
}
