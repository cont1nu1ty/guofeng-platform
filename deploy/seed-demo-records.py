#!/usr/bin/env python3
"""Explicit, additive private-record examples. No account edits or automatic cleanup."""
from __future__ import annotations
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('records_catalog', HERE / 'seed-catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
base = catalog.base
ASSETS = HERE.parent / 'apps/miniapp/src/pkg-content/static/audio'
FIXTURE = HERE / 'fixtures/records_content.json'


def fingerprint():
    digest = hashlib.sha256(FIXTURE.read_bytes())
    for path in sorted(ASSETS.glob('*.mp3')):
        digest.update(path.name.encode())
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def main():
    project = base.ENV['COMPOSE_PROJECT_NAME']
    if not re.fullmatch(r'jiafeng-(?:dev|demo-[a-z0-9][a-z0-9_-]*)', project) or base.ENV.get('JIAFENG_DEV_ACCOUNTS_ENABLED') != 'true':
        raise ValueError('Record examples require the isolated development environment')
    receipt = base.state_module.Receipt(base.sql, project, fingerprint(), 'demoRecordsState')
    state = receipt.read()
    if state and state.get('phase') == 'complete':
        print('Personal record examples already installed; edits and deletions were preserved.')
        return
    clients = {'devadmin': catalog.Client('devadmin', 'admin'),
               'member_zj': catalog.Client('member_zj'), 'member_bj': catalog.Client('member_bj')}
    admin = clients['devadmin']
    people = [p for p in admin.workspace(True)['hallPeople'] if p['status'] == '已发布' and p.get('language', 'zh') == 'zh']
    if not people:
        raise ValueError('Publish at least one Chinese hall person before adding record examples. Existing data was not changed.')
    # Required accounts are looked up by login, never created, renamed or reset.
    for name in ('member_zj', 'member_bj'):
        if 'member' not in clients[name].user.get('roles', []):
            raise ValueError('Example account role changed; existing data was not changed')
    if not state:
        state = receipt.create('running', personId=people[0]['id'], steps={}, files={})
    steps, files = state['steps'], state['files']
    fixture = json.loads(FIXTURE.read_text())

    def checkpoint():
        receipt.save(state)

    def step(key, client, command, data=None, entity='', version=None, staff=False):
        if key not in steps:
            steps[key] = {'request': {'command': command, 'data': data or {}, 'entity': entity,
                                      'version': version, 'admin': staff}, 'complete': False}
            checkpoint()
        saved = steps[key]
        if saved['complete']:
            return saved['result']
        # Freeze request/version before sending: a lost response retries the same idempotent operation.
        request = saved['request']
        result = client.command(request['command'], request['entity'], request['data'], request['version'],
                                request['admin'], key='private-records-v1:' + key)['result']
        saved.update(complete=True, result=result)
        checkpoint()
        return result

    def upload(client, filename, purpose):
        key = client.name + ':' + filename + ':' + purpose
        path = ASSETS / filename
        if key not in files:
            files[key] = {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                          'startedAtMillis': int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)}
            checkpoint()
        item = files[key]
        if not item.get('fileId'):
            # Recover an upload whose response arrived immediately before a checkpoint failure.
            found = base.sql("SELECT JSON_OBJECT('fileId',id,'duration',duration_ms/1000) FROM jf_file WHERE owner_id="
                + str(int(client.user['id'])) + ' AND purpose=' + base.lit(purpose)
                + ' AND source_sha256=' + base.lit(item['sourceSha256'])
                + ' AND original_name=' + base.lit(filename)
                + ' AND UNIX_TIMESTAMP(created_at)*1000>=' + str(item['startedAtMillis'])
                + ' ORDER BY created_at,id LIMIT 1;')
            item.update(json.loads(found) if found else client.upload(path, purpose))
            checkpoint()
        return item

    for item in fixture['recitations']:
        client, key = clients[item['user']], item['key']
        file = upload(client, item['audio'], 'recitation')
        record = step(key + ':save', client, 'recitation.create',
                      {'title': item['title'], 'fileId': file['fileId'], 'consent': True})
        if item['state'] == 'private':
            continue
        media = step(key + ':submit', client, 'media.submit', {
            'title': item['title'], 'category': 'recitation', 'type': 'audio', 'language': 'zh',
            'region': 'zhejiang' if item['user'] == 'member_zj' else 'beijing', 'sample': True,
            'collection': '家庭共读 · 虚构演示', 'excerpt': '原创样篇与合成示例音频，用于演示投稿审核，不代表真实用户录音。',
            'transcript': '把诚信与节俭落实在每天的小事中。', 'sourceFileId': file['fileId'], 'duration': '00:30'})
        if item['state'] == 'returned':
            step(key + ':return', admin, 'setMediaStatus',
                 {'status': '已退回', 'reviewNote': '请补充共读文字的出处，核对录音公开授权后重新提交。'},
                 media['id'], media['lockVersion'], True)
        if item['state'] == 'published-after-private-delete':
            step(key + ':publish', admin, 'setMediaStatus', {'status': '已发布'}, media['id'], media['lockVersion'], True)
            step(key + ':delete-private', client, 'recitation.remove', entity=record['id'], version=record['lockVersion'])

    for item in fixture['promises']:
        if item['key'] not in steps and any(p['personId'] == state['personId'] for p in clients[item['user']].workspace().get('familyPromises', [])):
            steps[item['key']] = {'complete': True, 'result': {'preservedExisting': True}}
            checkpoint()
            continue
        step(item['key'], clients[item['user']], 'familyPromise.save',
             {'personId': state['personId'], 'text': item['text']}, version=0)

    # A dedicated fictional entry demonstrates retaining one's promise after withdrawal,
    # without modifying any pre-existing published person.
    person = step('history:person', admin, 'saveHallPerson', {
        'title': '沈守约（虚构共读人物）', 'era': '原创家庭故事', 'region': 'all', 'language': 'zh', 'sample': True,
        'quote': '做不到的事，及时说清楚。', 'introduction': '本项目原创虚构人物，用于展示人物下架后本人约定的保留。',
        'sourceTitle': '本项目原创演示文案'}, staff=True)
    person = step('history:publish', admin, 'setHallPersonStatus', {'status': '已发布'}, person['id'], person['lockVersion'], True)
    step('history:promise', clients['member_zj'], 'familyPromise.save',
         {'personId': person['id'], 'text': '遇到安排变更时，主动说明情况，一起商量新的时间。'}, version=0)
    step('history:withdraw', admin, 'setHallPersonStatus', {'status': '已下架'}, person['id'], person['lockVersion'], True)

    for item in fixture['stories']:
        file = upload(admin, item['audio'], 'media')
        story = step(item['key'] + ':save', admin, 'saveMedia', {
            'title': item['title'], 'language': item['language'], 'region': 'all', 'sample': True,
            'category': 'recitation', 'type': 'audio', 'collection': '原创诵读故事 · 合成音频示例',
            'excerpt': item['text'], 'transcript': item['text'], 'sourceFileId': file['fileId'], 'duration': '00:30'}, staff=True)
        step(item['key'] + ':publish', admin, 'setMediaStatus', {'status': '已发布'}, story['id'], story['lockVersion'], True)

    state.update(phase='complete', completedAt=dt.datetime.now(dt.timezone.utc).isoformat())
    checkpoint()
    print(json.dumps({'personalRecordsInstalled': True, 'project': project, 'fictional': True,
                      'preservedExistingData': True}, ensure_ascii=False))


if __name__ == '__main__':
    main()
