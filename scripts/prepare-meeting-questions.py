"""Prepare the supplied banks as unapproved drafts, preserving source order and keys."""
import json, re, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs/question-bank/2026-10-11'
DEST.mkdir(parents=True, exist_ok=True)
LETTERS = ['أ', 'ب', 'ج']
MARKER = re.compile(r'((?<![\u0621-\u065f])[أبج]|ج(?=ـ))ـ?\s*[.\-]\s*')
BOOK_SHA = 'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd'
assert hashlib.sha256((ROOT / 'public/documents/national-belonging.pdf').read_bytes()).hexdigest() == BOOK_SHA
def clean(text):
    return re.sub(r'\s+', ' ', text).strip()
def parse(cell):
    text = ''
    for p in cell['paragraphs']:
        part = p['text'].strip()
        part = part.replace('فيهب.', 'فيه ب.')
        if not part: continue
        if p['numbering']:
            part = LETTERS[len(list(MARKER.finditer(text)))] + '. ' + part
        text += '\n' + part
    marks = list(MARKER.finditer(text))
    assert [m.group(1).replace('ا', 'أ') for m in marks] in (['أ','ب'], ['أ','ب','ج']), text
    title = clean(text[:marks[0].start()])
    options = [clean(text[m.end():marks[i+1].start() if i+1<len(marks) else len(text)]) for i,m in enumerate(marks)]
    # Repair only the damaged Word religious symbol and surrounding extraction artifacts.
    title = re.sub(r'-\s*ﷺ\s*-', 'ﷺ', title)
    title = re.sub(r'-\s*ﷺ', 'ﷺ', title)
    # Balance two quotation brackets checked on PDF pages 31 and 23.
    title = title.replace('إلى (.....):', 'إلى (.....)):')
    title = title.replace('(أو مخرجي هم ؟!))', '(أو مخرجي هم؟!)')
    return title, options
banks, reviews = [], []
for stage, count in [('middle',20), ('highschool',25), ('university',30)]:
    raw = json.loads((ROOT / f'tmp/meeting-sources/{stage}.json').read_text(encoding='utf8'))
    assert len(raw['rows']) == count + 1
    for n, row in enumerate(raw['rows'][1:],1):
        title, options = parse(row[1])
        letter = row[2]['text'].strip().replace('ـ','').replace('ا','أ')
        key = LETTERS.index(letter)
        assert key < len(options)
        ref = clean(row[3]['text'])
        official = n > count - 3
        printed = None if official or ref=='الغلاف' else int(ref.split('-')[0])
        printed_end = int(ref.split('-')[1]) if not official and '-' in ref else None
        pdf = None if official else 1 if printed is None else printed + 2
        source = 'مصدر رسمي' if official else 'غلاف كتاب الانتماء واللحمة الوطنية' if printed is None else f'كتاب الانتماء واللحمة الوطنية، ص {ref}'
        record = {
            'id': f'{stage}-1448-{n:03d}', 'stage': stage, 'title': title,
            'type': 'single_choice', 'options': options, 'correctAnswers': [key], 'correct': key,
            'pdfPage': pdf, 'printedPage': printed,
            'hintPdfPageStart': None if official else pdf if printed_end else max(1,pdf-1),
            'hintPdfPageEnd': None if official else printed_end+2 if printed_end else pdf,
            'sourceKind': 'official' if official else 'book',
            'sourceRow': f'{Path(raw["file"]).name} | table 1, row {n+1}, item {n}',
            'sourceVerified': False, 'preserveOptionOrder': True, 'source': source,
            'answerExplanation': f'الإجابة الصحيحة وفق المصدر: {options[key]}',
            'sourceExcerpt': options[key] if not official else '', 'topic': 'الجهة المنظمة' if official else 'الانتماء واللحمة الوطنية',
            'difficulty': 'medium', 'bookVersionId': 'national-belonging-ec07ef57',
            'version': 1, 'active': True, 'approved': False, 'fixture': False,
        }
        if printed_end:
            record.update(printedPageEnd=printed_end, pdfPageEnd=printed_end+2)
        if official:
            position = n-(count-3)
            if position == 1:
                record.update(sourceUrl='https://www.pv.gov.sa/', source='ملف الجهات المنظمة؛ تعريف الرئاسة الرسمي',
                    sourceExcerpt='ملف الجهات المنظمة يحدد فرع الرئاسة العامة في المنطقة الشرقية جهةً منظمةً ومنفذةً. الموقع الرسمي يثبت مسمى الرئاسة؛ الاعتماد على الملف في تحديد تنظيم المسابقة.')
            elif position == 2:
                record.update(sourceUrl='https://my.gov.sa/en/emergency-contact', source='المنصة الوطنية — أرقام التواصل',
                    sourceExcerpt='تربط المنصة الوطنية الرقم 1909 بالرئاسة العامة لهيئة الأمر بالمعروف والنهي عن المنكر. يؤيده خبر وكالة الأنباء السعودية https://www.spa.gov.sa/2009196 .')
            else:
                record.update(sourceUrl='https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/d7ab6b0a-b50b-4be5-9284-a9a700f209d4/1', source='هيئة الخبراء — تنظيم الرئاسة، المادة السادسة',
                    sourceExcerpt='المادة السادسة تقرر الدعوة بالرفق واللين والإسهام مع الجهات المختصة في مكافحة المخدرات وبيان أضرارها؛ لذا الخياران الأول والثاني صحيحان.')
        banks.append(record)
        reviews.append({'id': record['id'], 'fileSha256': raw['sha256'], 'sourceRow': record['sourceRow'],
            'originalText': row[1]['text'], 'originalAnswerKey': row[2]['text'].strip(), 'originalPageReference': ref,
            'normalizedTitle': title, 'normalizedOptions': options, 'answerIndex': key,
            'bookMapping': None if official else {'printedStart': printed, 'printedEnd': printed_end or printed, 'pdfStart': pdf, 'pdfEnd': printed_end+2 if printed_end else pdf},
            'review': 'Text/options/key checked against OOXML; book references visually checked against SHA-bound PDF; committee approval pending'})
assert len(banks)==75 and len({q['id'] for q in banks})==75
(DEST / 'official-drafts.json').write_text(json.dumps(banks, ensure_ascii=False, indent=2)+'\n',encoding='utf8')
(DEST / 'source-review.json').write_text(json.dumps({'bookSha256': BOOK_SHA, 'records': reviews},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Prepared 75 unapproved drafts: 20 middle, 25 highschool, 30 university; 9 official-source questions')
