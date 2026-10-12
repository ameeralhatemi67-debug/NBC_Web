import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Checks only the explicit loopback review, without reading operator environment files.
const base = 'http://127.0.0.1:43210';
const source = JSON.parse(await readFile('tmp/meeting-sources/policies.json', 'utf8'));
const manifest = JSON.parse(
  await readFile('docs/implementation/2026-10-11-meeting/policy-provenance.json', 'utf8'),
);
const normalize = (text) =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const selected = new Set([
  ...manifest.termsParagraphs,
  ...manifest.privacyParagraphs,
  manifest.acknowledgmentParagraph,
]);
const selectedDark = normalize(
  source.paragraphs
    .filter((_, i) => selected.has(i + 1))
    .flatMap((p) =>
      p.runs.filter((r) => !['EE0000', 'FF0000'].includes(r.color)).map((r) => r.text),
    )
    .join(' '),
);
// A shared label such as the policy title also appears in approved-for-review dark text.
// Exclude red commentary, without banning independently authorized labels.
const red = [
  ...new Set(
    source.paragraphs
      .flatMap((p) =>
        p.runs.filter((r) => ['EE0000', 'FF0000'].includes(r.color)).map((r) => normalize(r.text)),
      )
      .filter((t) => t.length >= 30 && !selectedDark.includes(t)),
  ),
];
const correspondence = [
  'نأمل الاطلاع على الوثائق المرفقة',
  'التوجيه ــ حال الموافقة',
  'وأرى أن هذه الصيغة الأخيرة مهمة',
];
const results = [];
for (const route of ['/terms', '/privacy', '/register', '/']) {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200);
  const html = await response.text(),
    visible = normalize(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
  if (route === '/terms') assert.ok(visible.includes('آلية الإجابة وإرسال المشاركة'));
  if (route === '/privacy') assert.ok(visible.includes('مسودة للمراجعة والاعتماد من اللجنة'));
  for (const text of [...red, ...correspondence])
    assert.ok(!visible.includes(text), `Excluded content appeared on ${route}`);
  assert.ok(!html.includes('/images/organizations/general-presidency.png'));
  results.push({
    route,
    redFragmentsChecked: red.length,
    correspondenceExcluded: true,
    obsoleteAuthorityAssetAbsent: true,
  });
}
await writeFile(
  'docs/implementation/2026-10-11-meeting/public-copy-verification.json',
  JSON.stringify({ verifiedAt: '2026-10-11', results }, null, 2) + '\n',
);
console.log('Four public pages passed exclusion and obsolete-logo checks.');
