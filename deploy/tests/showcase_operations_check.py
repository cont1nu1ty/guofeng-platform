#!/usr/bin/env python3
"""Verify existing sample exports and preferences without creating more fixtures."""
import io, json, sys, zipfile, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scenarios.common import base, catalog

OUT = Path(__file__).resolve().parents[1] / '.local/non-ai-showcase-20261008'
records = json.loads(base.sql("SELECT payload FROM jf_entity WHERE id='demoNonAiState' AND kind='setting'"))['records']
checks = []
def check(name, condition):
    assert condition, name
    checks.append(name)

admin = catalog.Client('devadmin', 'admin')
data = catalog.Client('data_zj', 'admin')
jobsets = {name: {x['id']: x for x in client.call('GET', '/admin/exports?page=1&pageSize=100')[0]['items']}
           for name, client in [('devadmin', admin), ('data_zj', data)]}
for key, fmt in [('pdf', 'pdf'), ('docx', 'docx'), ('csv', 'csv'), ('current', 'pdf')]:
    prefix = 'operations:report:' if key == 'current' else 'operations:export:'
    record = records[prefix + key]
    row = jobsets[record['username']][record['id']]
    check('completed ' + key, row['status'] == 'completed')
    client = data if key == 'current' else admin
    link = client.call('GET', '/admin/exports/' + row['id'] + '/download')[0]
    with base.HTTP.open(link['url'], timeout=30) as response: blob = response.read()
    if fmt == 'pdf': check('valid PDF ' + key, blob.startswith(b'%PDF'))
    elif fmt == 'docx':
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            check('real Word XML', 'word/document.xml' in archive.namelist())
    else:
        text = blob.decode('utf-8-sig')
        check('CSV contains fixture titles', '外婆留在菜谱边的话' in text and '饭桌旁的值日簿' in text)
    (OUT / ('showcase-' + key + '.' + fmt)).write_bytes(blob)
failure = jobsets['devadmin'][records['operations:export:failure']['id']]
check('failed after three real attempts', failure['status'] == 'failed' and failure['attempts'] == 3 and failure['errorCode'] == 'FONT_GLYPH_MISSING')
check('cancelled export', jobsets['devadmin'][records['operations:export:cancelled']['id']]['status'] == 'cancelled')
for name in ('member_zj', 'member_bj', 'member_js', 'data_zj'):
    client = data if name == 'data_zj' else catalog.Client(name)
    prefs = client.call('GET', '/me/delivery-preferences')[0]
    expected = records['operations:preference:' + name]
    check('delivery preference ' + name, all(prefs[k] == expected[k] for k in ('digest', 'draftNotice', 'reports')))
counts = base.sql("SELECT action,COUNT(*) FROM jf_engagement WHERE target_id=" + base.lit(records['operations:engagement']['sourceId']) + ' GROUP BY action')
check('real sample engagement events', 'view\t3' in counts and 'share_intent\t3' in counts)
check('no invented automatic report history', base.sql('SELECT COUNT(*) FROM jf_report_period') == '0')
check('no invented delivery history', base.sql('SELECT COUNT(*) FROM jf_notification_delivery') == '0')
(OUT / 'operations-check.json').write_text(json.dumps({'passed': checks, 'jobs': [{'kind': r['kind'], 'status': r['status'], 'attempts': r['attempts'], 'errorCode': r['errorCode']} for rows in jobsets.values() for r in rows.values()]}, ensure_ascii=False, indent=2) + '\n')
print('PASS', len(checks), 'operations checks')
