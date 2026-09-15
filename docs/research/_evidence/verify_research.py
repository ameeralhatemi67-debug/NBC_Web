from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
notes = sorted(root.rglob('*.md'))
readers = [p for p in notes if '_evidence' not in p.parts]
files = {p.name: p for p in root.rglob('*') if p.is_file()}
stems = {p.stem: p for p in notes}
errors = []
links_checked = 0
external = set()
for path in notes:
    content = path.read_text(encoding='utf-8')
    if not content.startswith('---\n'):
        errors.append(f'{path.name}: missing frontmatter')
        continue
    front = content.split('---', 2)[1]
    for field in ('type', 'tags', 'created', 'updated'):
        if not re.search(rf'(?m)^{field}:', front):
            errors.append(f'{path.name}: missing {field}')
    body = content.split('---', 2)[2]
    uncode = re.sub(r'```.*?```', '', body, flags=re.S)
    if len(re.findall(r'(?m)^# ', uncode)) != 1:
        errors.append(f'{path.name}: expected one H1')
    if len(re.findall(r'(?m)^```', body)) % 2:
        errors.append(f'{path.name}: unbalanced code fences')
    previous = 0
    for heading in re.findall(r'(?m)^(#{1,6}) ', uncode):
        level = len(heading)
        if previous and level > previous + 1:
            errors.append(f'{path.name}: skipped heading level')
        previous = level
    if path.name != '00-NBC-Research-Index.md' and '[[00-NBC-Research-Index]]' not in body:
        errors.append(f'{path.name}: missing parent index')
    for match in re.finditer(r'\[\[([^\]]+)\]\]', body):
        target = match.group(1).split('|')[0].split('#')[0]
        if target and target not in stems and target not in files:
            errors.append(f'{path.name}: unresolved wikilink {target}')
        links_checked += 1
    external.update(re.findall(r'\]\((https?://[^)]+)\)', body))
    if re.search(r'\uFFFD|cite|turn\d+(?:search|view)\d+', body):
        errors.append(f'{path.name}: encoding or citation marker leak')
    for line in body.splitlines():
        if line.startswith('|') and not line.endswith('|'):
            errors.append(f'{path.name}: malformed table row')

reqs = json.loads((root / '_evidence/requirements.json').read_text(encoding='utf-8'))
matrix = (root / '02-Requirements-and-Acceptance-Matrix.md').read_text(encoding='utf-8')
ids = re.findall(r'(?m)^\| (R\d{2}) \|', matrix)
expected = [f'R{i:02}' for i in range(1, 48)]
if ids != expected or [r['id'] for r in reqs] != expected:
    errors.append('Requirements coverage/order mismatch')

ledger = json.loads((root / '_evidence/claim-source-ledger.json').read_text(encoding='utf-8'))
ledger_urls = {r['url'] for r in ledger}
missing_urls = sorted(external - ledger_urls)
if missing_urls:
    errors.append('External URLs missing from ledger: ' + repr(missing_urls))
pdf = root / 'sources/Committee-Platform-Requirements-1448-2026.pdf'
digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
meta = json.loads((root / '_evidence/attachment-metadata.json').read_text(encoding='utf-8'))
if digest != meta['sha256']:
    errors.append('Preserved PDF hash mismatch')

index = (root / '00-NBC-Research-Index.md').read_text(encoding='utf-8')
for path in readers:
    if path.name != '00-NBC-Research-Index.md' and f'[[{path.stem}]]' not in index:
        errors.append(f'{path.name}: not linked from index')

report = {
    'verified_on': '2026-09-08',
    'reader_notes': len(readers),
    'internal_synthesis_notes': len(notes) - len(readers),
    'reader_word_count_approx': sum(len(p.read_text(encoding='utf-8').split()) for p in readers),
    'requirements_checked': len(ids),
    'sources_registered': len(ledger),
    'wikilinks_checked': links_checked,
    'unique_external_source_links': len(external),
    'pdf_sha256': digest,
    'errors': errors,
    'visual_review': 'All four source-PDF pages were visually reviewed. Obsidian reading-view and Mermaid rendering were not visually tested; Markdown received structural QA. Live benchmark visual inspection was unavailable.'
}
(root / '_evidence/verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if errors else 0)
