"""Read-only OOXML extraction: preserve paragraphs, option numbering and run colors."""
import json, hashlib, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'tmp' / 'meeting-sources'
DEST.mkdir(parents=True, exist_ok=True)
FILES = {
    'middle': 'اسئلة المرحلة المتوسطة.docx',
    'highschool': 'أسئلة المرحلة الثانوية.docx',
    'university': 'اسئلة المرحلة الجامعية.docx',
    'partners': 'الجهات المنظمة.docx',
    'policies': 'الشروط  والسياسات  والمتطلبات الفنية والأمنية للمشروع.docx',
    'notes': 'ملاحظات اولية على المنصة.docx',
}
def paragraph(p):
    def run_text(r):
        result = ''
        for child in r:
            if child.tag == '{%s}t' % NS['w']: result += child.text or ''
            elif child.tag == '{%s}sym' % NS['w']:
                char = child.get('{%s}char' % NS['w'])
                if char != 'F065': raise ValueError('Unmapped Word symbol: ' + str(char))
                result += 'ﷺ'
        return result
    return {
        'text': ''.join(run_text(r) for r in p.findall('w:r', NS)),
        'numbering': p.find('w:pPr/w:numPr', NS) is not None,
        'runs': [{'text': run_text(r),
                  'color': (r.find('w:rPr/w:color', NS).get('{%s}val' % NS['w']) if r.find('w:rPr/w:color', NS) is not None else None)} for r in p.findall('w:r', NS)],
    }
for key, name in FILES.items():
    path = Path('E:/الهوية مباشرة') / name
    with zipfile.ZipFile(path) as z:
        xml = ET.fromstring(z.read('word/document.xml'))
        rows = [[{'text': '\n'.join(paragraph(p)['text'] for p in c.findall('.//w:p', NS)),
                  'paragraphs': [paragraph(p) for p in c.findall('.//w:p', NS)]}
                 for c in tr.findall('w:tc', NS)] for tr in xml.findall('.//w:tbl/w:tr', NS)]
        data = {'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'rows': rows, 'paragraphs': [paragraph(p) for p in xml.findall('.//w:body/w:p', NS)]}
        (DEST / (key + '.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')
        print(key, len(rows), 'rows;', len(data['paragraphs']), 'paragraphs')
