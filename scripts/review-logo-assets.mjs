import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const list = [
  [
    'authority-logo.png',
    'public/images/identity/authority-logo.png',
    'user-supplied authority-logo.png',
  ],
  ['hedayah.png', 'public/images/organizations/hedayah.png', 'https://hedayh.org.sa/'],
  [
    'saad-bin-soliab-foundation.svg',
    'public/images/organizations/saad-bin-soliab-foundation.svg',
    'https://sbs-c.sa/الشعار/',
  ],
  [
    'education-eastern.svg',
    'public/images/organizations/education-eastern.svg',
    'https://sites.moe.gov.sa/assets/images/moe-logo.svg',
  ],
  [
    'iau.svg',
    'public/images/organizations/iau.svg',
    'https://www.iau.edu.sa/sites/all/themes/uod_base/assets/images/dga_theme/logo.svg',
  ],
  [
    'kfu.webp',
    'public/images/organizations/kfu.webp',
    'https://www.kfu.edu.sa/Style%20Library/UD/ar-sa/images/kfu-logo-normal.webp',
  ],
  [
    'uhb.png',
    'public/images/organizations/uhb.png',
    'https://www.uhb.edu.sa/sites/default/files/site-logo/asd.png',
  ],
  [
    'kfupm.svg',
    'public/images/organizations/kfupm.svg',
    'https://www.kfupm.edu.sa/images/default-source/default-album/kfupm_logo_en.svg?sfvrsn=f12b570c_0',
  ],
  [
    'pmu.png',
    'public/images/organizations/pmu.png',
    'https://www.pmu.edu.sa/images/c-logo-new.png',
  ],
];
const layers = [],
  records = [];
for (const [i, [name, path, source]] of list.entries()) {
  const bytes = await readFile(path),
    meta = await sharp(bytes).metadata();
  const thumb = await sharp(bytes)
    .resize(280, 180, { fit: 'contain', background: 'white' })
    .flatten({ background: 'white' })
    .png()
    .toBuffer();
  layers.push({ input: thumb, left: (i % 3) * 300 + 10, top: Math.floor(i / 3) * 220 + 20 });
  layers.push({
    input: Buffer.from(
      `<svg width="300" height="25"><text x="10" y="18" font-size="13">${name}</text></svg>`,
    ),
    left: (i % 3) * 300,
    top: Math.floor(i / 3) * 220 + 195,
  });
  records.push({
    file: path,
    source,
    retrievedAt: '2026-10-11',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: meta.width,
    height: meta.height,
    format: meta.format,
    method:
      i < 3
        ? 'Retained supplied/local asset; official naming checked'
        : name === 'pmu.png'
          ? 'Windows curl with certificate verification; Python CA path rejected expired chain'
          : name === 'kfu.webp'
            ? 'Official response decoded as WEBP despite text/html MIME'
            : name === 'kfupm.svg'
              ? 'Official SVG; incorrect UTF-16 XML declaration normalized to UTF-8 without changing artwork'
              : 'Official website download',
    visualReview: 'pending',
  });
}
await mkdir('docs/design/2026-10-11-partners', { recursive: true });
await sharp({ create: { width: 900, height: 660, channels: 3, background: 'white' } })
  .composite(layers)
  .png()
  .toFile('docs/design/2026-10-11-partners/logo-review.png');
await writeFile(
  'docs/design/2026-10-11-partners/asset-provenance.json',
  JSON.stringify(records, null, 2) + '\n',
);
console.log(records.map((r) => `${r.file}: ${r.width}x${r.height}`).join('\n'));
