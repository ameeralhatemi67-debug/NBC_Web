"""Create review copy from dark runs only; source documents are never modified."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / 'tmp/meeting-sources/policies.json').read_text(encoding='utf8'))
def dark(n):
    return ''.join(r['text'] for r in raw['paragraphs'][n-1]['runs'] if r['color'] not in ('EE0000', 'FF0000')).strip()
privacy = [(43, 'مقدمة'), (46, 'البيانات التي نجمعها'), (49, 'أغراض المعالجة'),
           (51, 'المسوغ النظامي'), (55, 'كيف نجمع البيانات'), (57, 'الحقول الإلزامية والاختيارية'),
           (59, 'مشاركة البيانات'), (62, 'حماية البيانات'), (65, 'موقع معالجة البيانات'),
           (67, 'الاحتفاظ والإتلاف'), (85, 'تحديث السياسة')]
sections = [{'heading': title, 'text': dark(n)} for n, title in privacy]
rights = [dark(n) for n in range(71,77)]
module = '// Review copy extracted from dark text only. Source paragraph references are recorded internally.\n'
module += 'export const privacyReviewSections = ' + json.dumps(sections, ensure_ascii=False, indent=2) + ';\n'
module += 'export const privacyRights = ' + json.dumps(rights, ensure_ascii=False, indent=2) + ';\n'
(ROOT / 'src/lib/privacy-review.ts').write_text(module, encoding='utf8')
manifest = {'source': raw['file'], 'sha256': raw['sha256'],
            'termsParagraphs': list(range(1,26)), 'privacyParagraphs': [n for n,_ in privacy] + list(range(71,77)),
            'acknowledgmentParagraph': 87, 'internalTechnicalParagraphs': list(range(104,129)),
            'excluded': 'All red runs, dark correspondence/approval-request prose, incomplete privacy contacts and unapproved prize/patronage wording',
            'overrides': ['Final submission locking and post-submission feedback', 'Three official-source organizer questions per bank', 'Backup mobile and village fields deferred']}
dest = ROOT / 'docs/implementation/2026-10-11-meeting'
dest.mkdir(parents=True, exist_ok=True)
(dest / 'policy-provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
print('Prepared dark-only privacy review copy and source manifest')
