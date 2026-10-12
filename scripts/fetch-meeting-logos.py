import urllib.request, hashlib, json, re, subprocess, io
from PIL import Image
from xml.etree import ElementTree
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/images/organizations'
SOURCES = [
 ('education-eastern.svg', 'الإدارة العامة للتعليم بالمنطقة الشرقية', 'https://sites.moe.gov.sa/assets/images/moe-logo.svg'),
 ('iau.svg', 'جامعة الإمام عبدالرحمن بن فيصل', 'https://www.iau.edu.sa/sites/all/themes/uod_base/assets/images/dga_theme/logo.svg'),
 ('kfu.webp', 'جامعة الملك فيصل', 'https://www.kfu.edu.sa/Style%20Library/UD/ar-sa/images/kfu-logo-normal.webp'),
 ('uhb.jpg', 'جامعة حفر الباطن', 'https://www.uhb.edu.sa/themes/custom/uhb/images/uhb-header-logo.jpg'),
 ('kfupm.svg', 'جامعة الملك فهد للبترول والمعادن', 'https://www.kfupm.edu.sa/images/default-source/default-album/kfupm_logo_en.svg?sfvrsn=f12b570c_0'),
 ('pmu.png', 'جامعة الأمير محمد بن فهد', 'https://www.pmu.edu.sa/images/c-logo-new.png'),
]
records = []
for name, org, url in SOURCES:
    try:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=35) as response:
                data = response.read()
                kind = response.headers.get('Content-Type', '')
        except urllib.error.URLError:
            # Windows trust-store fallback. Certificate verification remains enabled.
            data = subprocess.run(['curl.exe', '-L', '--fail', '--ssl-auto-client-cert', '--silent', '--show-error', '--max-time', '35', url], check=True, capture_output=True).stdout
            kind = 'validated from bytes'
        original_hash = hashlib.sha256(data).hexdigest()
        if name.endswith('.svg'):
            # The KFUPM response contains UTF-8 bytes with an incorrect UTF-16 declaration.
            data = re.sub(br'encoding=[\"\']utf-16[\"\']', b'encoding="utf-8"', data, flags=re.I)
            if not ElementTree.fromstring(data).tag.endswith('svg'):
                raise ValueError('Not an SVG')
        else:
            Image.open(io.BytesIO(data)).verify()
        (DEST / name).write_bytes(data)
        records.append({'organization': org, 'file': 'public/images/organizations/' + name, 'source': url,
                        'retrievedAt': '2026-10-11', 'sha256': hashlib.sha256(data).hexdigest(), 'originalSha256': original_hash, 'contentType': kind, 'visualReview': 'pending'})
        print(name, len(data), kind)
    except Exception as e:
        print(name, type(e).__name__, str(e)[:160])
out = ROOT / 'docs/design/2026-10-11-partners'
out.mkdir(parents=True, exist_ok=True)
(out / 'download-provenance.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf8')
