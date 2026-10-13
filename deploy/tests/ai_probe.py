#!/usr/bin/env python3
"""Opt-in real AI integration checks; creates fictional fixtures and uses configured models.
Run only against this local development deployment. Never prints tokens or provider keys.
"""
import json
import io
import zipfile
import os
from pathlib import Path
import time
import urllib.request
import urllib.error
import uuid
from business_probe import Client, ROOT, BASE, RESULTS, STAMP, check, draft

REPORT = Path(os.environ.get('JIAFENG_AI_REPORT', '/tmp/jiafeng-ai-http-report.json'))


def wait(client, task):
    deadline = time.monotonic() + 200
    while task['status'] in ('queued', 'running') and time.monotonic() < deadline:
        time.sleep(1.5)
        task = client.call('GET', '/ai/tasks/' + task['id'])[1]
    assert task['status'] == 'succeeded', {k: task.get(k) for k in ('id', 'mode', 'status', 'error')}
    return task


def create(client, mode, prompt='', **extra):
    body = dict(mode=mode, prompt=prompt, language='zh', **extra)
    return wait(client, client.call('POST', '/ai/tasks', body, {'Idempotency-Key': str(uuid.uuid4())})[1])


def upload(client, blob, name, mime):
    boundary = 'ai' + uuid.uuid4().hex
    raw = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + blob + f'\r\n--{boundary}--\r\n'.encode())
    req = urllib.request.Request(BASE + '/files?purpose=manuscript', data=raw, headers={'Authorization': 'Bearer ' + client.token, 'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def main():
    admin = Client('devadmin', 'admin'); zj = Client('region_zj', 'admin'); bj = Client('region_bj', 'admin')
    expert = Client('expert_zj', 'admin'); a = Client('member_zj'); b = Client('member_bj')
    status = a.call('GET', '/ai/status')[1]
    check('configured external text and OCR status', status['enabled'] and status['ocrEnabled'] and status['external'])
    a.call('GET', '/admin/ai/tasks', expected=403); expert.call('GET', '/admin/ai/tasks', expected=403)
    check('member and expert administrative logs denied')
    body = {'mode': 'family', 'prompt': '仅为虚构联调写三条家庭约定：长辈和孩子平等沟通、如实说明情况、共同分担家务。每条20字以内。', 'language': 'zh'}
    key = str(uuid.uuid4())
    first = a.call('POST', '/ai/tasks', body, {'Idempotency-Key': key})[1]
    again = a.call('POST', '/ai/tasks', body, {'Idempotency-Key': key})[1]
    a.call('POST', '/ai/tasks', {**body, 'prompt': 'different'}, {'Idempotency-Key': key}, 409)
    task = wait(a, first)
    check('real writing, durable task and idempotent replay', first['id'] == again['id'] and task['model'] == status['model'] and len(task['result']) > 15)
    b.call('GET', '/ai/tasks/' + task['id'], expected=404); admin.call('GET', '/ai/tasks/' + task['id'], expected=404)
    check('private generated text is owner only, including national admin')
    redacted = next(x for x in admin.call('GET', '/admin/ai/tasks')[1]['items'] if x['id'] == task['id'])
    check('admin task log removes private prompt, result and files', redacted.get('redacted') and not any(k in redacted for k in ('result', 'prompt', 'text', 'fileId')))
    archived = a.command('archive.ai.save', data={'mode': 'rules', 'prompt': 'forged', 'result': task['result'], 'source': 'model', 'taskId': task['id'], 'model': 'forged'})
    archive = archived.get('result', archived)
    check('archive provenance derives from owned successful task', archive['model'] == status['model'] and archive['prompt'] == body['prompt'] and not archive['userEdited'])
    b.command('archive.ai.save', data={'mode': 'rules', 'prompt': '', 'result': 'fake', 'source': 'model', 'taskId': task['id']}, expected=404)
    check('cannot archive another account task')
    for mode, prompt, text in [('letter', '仅为虚构演示写一封80字家书：女儿离家读书，父亲提醒她健康作息。不编造人物事实。', ''), ('polish', '润色以下文字，保持事实，80字以内。', '我们约好每周一起整理书架，轮流讲述本周读过的故事。')]:
        done = create(a, mode, prompt, text=text)
        check('real ' + mode + ' generation', bool(done['result']) and done['model'] == status['model'])
    support = create(a, 'support', '投稿被退回以后怎样修改重投？请简要回答。')
    check('support answer cites platform help', any(x['id'] == 'platform-help-v1' for x in support['citations']))
    file = upload(a, (ROOT / 'deploy/fixtures/files/投稿附页.pdf').read_bytes(), '中文手稿验收.pdf', 'application/pdf')
    b.call('POST', '/ai/tasks', {'mode': 'ocr', 'fileId': file['fileId']}, {'Idempotency-Key': str(uuid.uuid4())}, 404)
    ocr = create(a, 'ocr', fileId=file['fileId'])
    check('Chinese PDF OCR through S3 and durable task, owner isolation', ocr['model'] == 'glm-ocr' and len(ocr['result']) > 40)
    # A parseable original DOCX file, no invented indexed-success seed.
    unique = '榕灯学堂'
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as document:
        document.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        document.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + unique + '是联调用的虚构公益课堂。开放时间为每周六上午十点，地点为青禾社区二楼。报名请联系课堂志愿者。不是实际开放通知。' + STAMP + '</w:t></w:r></w:p></w:body></w:document>')
    kbfile = upload(zj, buffer.getvalue(), '榕灯学堂联调资料.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    kb = zj.command('saveKnowledgeDocument', data={'fileId': kbfile['fileId'], 'title': unique + '联调资料' + STAMP, 'category': '原创测试', 'region': '浙江省'}, admin=True)['result']
    kid = kb['id']
    bj.call('POST', '/admin/ai/knowledge/' + kid + '/index', {'version': kb['lockVersion'], 'audience': 'public'}, {'Idempotency-Key': str(uuid.uuid4())}, 404)
    indexed = wait(zj, zj.call('POST', '/admin/ai/knowledge/' + kid + '/index', {'version': kb['lockVersion'], 'audience': 'staff', 'language': 'zh'}, {'Idempotency-Key': str(uuid.uuid4())})[1])
    check('real file parse and staff knowledge indexing', indexed['mode'] == 'index')
    private_answer = create(a, 'knowledge', unique + '几点开放？请只按资料回答。')
    check('staff knowledge is excluded from member retrieval', not any(x['id'].startswith(kid) for x in private_answer.get('citations', [])))
    staff_answer = create(zj, 'knowledge', unique + '几点开放？请只按资料回答。')
    check('authorized region staff can retrieve internal source', any(x['id'].startswith(kid) for x in staff_answer['citations']))
    cross = create(bj, 'knowledge', unique + '几点开放？请只按资料回答。')
    check('other region cannot retrieve internal source', not any(x['id'].startswith(kid) for x in cross.get('citations', [])))
    kb = zj.entity('knowledgeBases', kid)
    wait(zj, zj.call('POST', '/admin/ai/knowledge/' + kid + '/index', {'version': kb['lockVersion'], 'audience': 'public', 'language': 'zh'}, {'Idempotency-Key': str(uuid.uuid4())})[1])
    knowledge = create(a, 'knowledge', unique + '几点开放？请只按资料回答。')
    check('public indexed file retrieved with traceable source', any(x['id'].startswith(kid) for x in knowledge['citations']) and '十点' in knowledge['result'])
    arc = a.command('archive.ai.save', data={'mode': 'knowledge', 'prompt': '', 'result': knowledge['result'], 'source': 'model', 'taskId': knowledge['id']})['result']
    kb = zj.entity('knowledgeBases', kid)
    zj.call('POST', '/admin/ai/knowledge/' + kid + '/withdraw', {'version': kb['lockVersion']})
    stale = a.call('GET', '/ai/tasks/' + knowledge['id'])[1]
    check('withdrawal prevents old answer and citations from replaying', stale['status'] == 'failed' and stale['error']['code'] == 'KNOWLEDGE_CHANGED' and 'result' not in stale)
    workspace = a.workspace()
    archives = workspace.get('aiArchives', [])
    archived_stale = next((x for x in archives if x['id'] == arc['id']), None)
    check('withdrawal also suppresses saved archive', archived_stale and archived_stale.get('sourceExpired'))
    work = a.call('POST', '/submissions', draft(title='AI辅助联调虚构稿件' + STAMP), {'Idempotency-Key': str(uuid.uuid4())})[1]
    sid = work['id']; source = zj.entity('submissions', sid)
    request = {'mode': 'review', 'prompt': '简要审核并提出需人工核实的事项', 'submissionId': sid, 'version': source['lockVersion']}
    bj.call('POST', '/ai/tasks', request, {'Idempotency-Key': str(uuid.uuid4())}, 404)
    expert.call('POST', '/ai/tasks', request, {'Idempotency-Key': str(uuid.uuid4())}, 404)
    review = create(zj, 'review', request['prompt'], submissionId=sid, version=source['lockVersion'])
    check('review uses authorized current manuscript and preserves decision', review['sourceVersion'] == source['lockVersion'] and zj.entity('submissions', sid)['status'] == source['status'])
    summary = create(zj, 'summary', '概括稿件并提取关键词，80字以内', submissionId=sid, version=source['lockVersion'])
    check('real management summary', bool(summary['result']))
    zj.act('returnSubmission', 'submissions', sid, {'reason': 'AI联调：请补充故事细节，经人工决定退修。'})
    stale_review = zj.call('GET', '/ai/tasks/' + review['id'])[1]
    check('changed manuscript version hides prior analysis', stale_review['status'] == 'failed' and stale_review['error']['code'] == 'SOURCE_CHANGED' and 'result' not in stale_review)
    word = admin.command('saveDictionaryWord', data={'word': '验收拦截词' + STAMP, 'type': '测试词', 'action': '拦截提示', 'note': '原创联调后停用'}, admin=True)['result']
    blocked = a.call('POST', '/ai/tasks', {'mode': 'letter', 'prompt': '验收拦截词' + STAMP}, {'Idempotency-Key': str(uuid.uuid4())})[1]
    deadline = time.monotonic() + 30
    while blocked['status'] in ('queued', 'running') and time.monotonic() < deadline:
        time.sleep(1); blocked = a.call('GET', '/ai/tasks/' + blocked['id'])[1]
    admin.command('toggleDictionaryWord', word['id'], {'enabled': False}, word['lockVersion'], True)
    check('UI-configured blocking word causes honest failed task', blocked['status'] == 'failed' and blocked['error']['code'] == 'AI_CONTENT_BLOCKED')
    REPORT.write_text(json.dumps({'checks': RESULTS, 'status': status, 'taskId': task['id'], 'ocrTaskId': ocr['id'], 'knowledgeId': kid, 'submissionId': sid, 'account': a.name}, ensure_ascii=False, indent=2))
    print('Report:', REPORT)

if __name__ == '__main__': main()
