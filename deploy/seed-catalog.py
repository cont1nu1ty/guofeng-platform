#!/usr/bin/env python3
"""Add the original catalog showcase without replacing any existing user content.

Requires the real local backend. Every save/upload uses the authenticated API.
A per-project checkpoint and deterministic command keys make retries additive.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import importlib.util
import json
import mimetypes
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('showcase_seed', HERE / 'seed-showcase.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FIXTURE = HERE / 'fixtures/catalog_content.json'
PROJECT = base.ENV['COMPOSE_PROJECT_NAME']
STATE = HERE / '.local' / f'{PROJECT}-catalog-manifest.json'
ASSETS = HERE.parent / 'apps/miniapp/src/pkg-content/static/media'

class Client(base.Client):
    def command(self, command, entity='', data=None, version=None, admin=False, key=None):
        body = {'command': command, 'entityId': entity, 'data': data or {}}
        if version is not None:
            body['version'] = version
        key = key or str(uuid.uuid4())
        return self.call('POST', '/admin/commands' if admin else '/commands', body,
                         {'Idempotency-Key': 'catalog-v1:' + key})[0]

    def upload(self, path, purpose='media'):
        boundary = 'catalog' + uuid.uuid4().hex
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
                f'Content-Type: {mime}\r\n\r\n').encode() + path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
        req = urllib.request.Request(base.BASE + '/files?purpose=' + purpose, data=body, headers={
            'Authorization': 'Bearer ' + self.token, 'Content-Type': 'multipart/form-data; boundary=' + boundary})
        try:
            with base.HTTP.open(req, timeout=90) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            error = json.load(exc)
            raise RuntimeError(f'Upload failed: {exc.code} {error.get("code")} {error.get("message")}') from None


def main():
    if not re.fullmatch(r'jiafeng-(?:dev|demo-[a-z0-9][a-z0-9_-]*)', PROJECT) or base.ENV.get('JIAFENG_DEV_ACCOUNTS_ENABLED') != 'true':
        raise ValueError('Catalog examples require the isolated local development project')
    fixture = json.loads(FIXTURE.read_text())
    admin = Client('devadmin', 'admin')
    initial = admin.workspace(True)
    if 'banners' not in initial:
        raise ValueError('Deploy the catalog backend before adding its examples')
    legacy_path = HERE / '.local/showcase-manifest.json'
    legacy = json.loads(legacy_path.read_text())['refs'] if legacy_path.exists() else {}
    previous = json.loads(STATE.read_text()) if STATE.exists() else {}
    # A reset or isolated restore can have new IDs. Never overwrite existing rows;
    # only discard stale checkpoint references which are absent from this database.
    live = {x['id'] for group in initial.values() if isinstance(group, list)
            for x in group if isinstance(x, dict) and 'id' in x}
    refs = {kind: {key: row for key, row in values.items() if row.get('id') in live}
            for kind, values in previous.get('refs', {}).items()}
    files = previous.get('files', {}) if any(refs.values()) else {}
    manifest = {'datasetVersion': fixture['datasetVersion'], 'project': PROJECT,
                'fictional': True, 'fixtureSha256': hashlib.sha256(FIXTURE.read_bytes()).hexdigest(),
                'seededAt': previous.get('seededAt', dt.datetime.now(dt.timezone.utc).isoformat()),
                'refs': refs, 'files': files}
    def checkpoint():
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    def file(client, filename):
        key = client.name + ':' + filename
        if key not in files:
            saved = client.upload(ASSETS / filename)
            files[key] = {**saved, 'sha256': hashlib.sha256((ASSETS / filename).read_bytes()).hexdigest()}
            checkpoint()
        return files[key]['fileId']
    def ref(kind, key):
        value = refs.get(kind, {}).get(key) or legacy.get(kind, {}).get(key)
        if not value or value['id'] not in {x['id'] for x in admin.workspace(True).get(kind, [])}:
            raise ValueError(f'Missing published showcase reference {kind}/{key}; run the base showcase first')
        return value['id']
    commands = {'contents': ('saveContent', 'setContentStatus'),
                'mediaItems': ('saveMedia', 'setMediaStatus'),
                'venues': ('saveVenue', 'setVenueStatus'),
                'hallPeople': ('saveHallPerson', 'setHallPersonStatus'),
                'banners': ('saveBanner', 'setBannerStatus')}
    for kind, (save, status) in commands.items():
        refs.setdefault(kind, {})
        for item in fixture[kind]:
            key = item['key']
            if key in refs[kind] and refs[kind][key].get('complete'):
                continue  # Preserve deliberate edits made by users after installation.
            if key not in refs[kind]:
                data = dict(item['data'])
                if item.get('source'):
                    data['sourceFileId'] = file(admin, item['source'])
                if item.get('poster'):
                    data['posterFileId'] = file(admin, item['poster'])
                if item.get('coverKey'):
                    data['coverFileId'] = file(admin, item['coverKey'])
                if item.get('activityKey'):
                    data['activityId'] = ref('activities', item['activityKey'])
                if item.get('targetKey'):
                    data['targetId'] = ref(*item['targetKey'])
                response = admin.command(save, data=data, admin=True, key=key + ':save')
                entity = response['result']
                refs[kind][key] = {'id': entity['id'], 'title': data['title'], 'intendedStatus': item['status'], 'complete': False}
                checkpoint()
            entity_id = refs[kind][key]['id']
            entity = next(x for x in admin.workspace(True)[kind] if x['id'] == entity_id)
            if item['status'] != entity['status']:
                admin.command(status, entity_id, {'status': item['status']}, entity['lockVersion'], True, key=key + ':publish')
            refs[kind][key]['complete'] = True
            checkpoint()
    # Pending/returned member submissions and real support requests demonstrate
    # the private-to-operator workflow without polluting old manuscript records.
    member = Client('member_zj')
    refs.setdefault('mediaItems', {})
    for key, state, title in [('member_pending', '待审核', '我家的三条约定 · 待审核投稿'),
                              ('member_returned', '已退回', '一张借用卡 · 待补充说明')]:
        if refs['mediaItems'].get(key, {}).get('complete'):
            continue
        if key not in refs['mediaItems']:
            data = {'title': title, 'category': 'documentary', 'type': 'short', 'collection': '会员投稿展示',
                    'excerpt': '原创静音动画作为文件流转样例，用于演示运营审核；不是实际用户纪实。',
                    'duration': '00:12', 'transcript': '认真对待每一次约定，让家风落在日常小事中。',
                    'region': 'zhejiang', 'language': 'zh', 'sample': True,
                    'sourceFileId': file(member, 'everyday-values.mp4')}
            response = member.command('media.submit', data=data, key=key + ':submit')
            refs['mediaItems'][key] = {'id': response['result']['id'], 'title': title, 'intendedStatus': state, 'complete': False}
            checkpoint()
        if state == '已退回':
            row = next(x for x in admin.workspace(True)['mediaItems'] if x['id'] == refs['mediaItems'][key]['id'])
            if row['status'] != state:
                admin.command('setMediaStatus', row['id'], {'status': state, 'reviewNote': '请补充视频中引用文字的出处，并确认公开展示授权。保留原编号后重新提交。'}, row['lockVersion'], True, key=key + ':return')
        refs['mediaItems'][key]['complete'] = True
        checkpoint()
    refs.setdefault('supportTickets', {})
    for key, subject, body, reply in [
        ('support_open', '退回的短片怎样补充资料？', '我看到短片被退回，想确认补充出处后是否可以使用原编号再次提交。', ''),
        ('support_answered', '活动满额以后还能报名吗？', '我想参加旧物小展，页面显示已满额。是否还有其他可以参与的共读活动？', '当前满额活动暂不新增报名。你可以在活动列表查看“报名中”的其他场次；本展示环境中的活动均为虚构，不作为实际出行安排。')]:
        if refs['supportTickets'].get(key, {}).get('complete'):
            continue
        if key not in refs['supportTickets']:
            result = member.command('support.create', data={'subject': subject, 'body': body, 'category': 'other'}, key=key + ':create')['result']
            refs['supportTickets'][key] = {'id': result['id'], 'title': subject, 'complete': False}
            checkpoint()
        if reply:
            row = next(x for x in admin.workspace(True)['supportTickets'] if x['id'] == refs['supportTickets'][key]['id'])
            if row['status'] != '已回复':
                admin.command('replySupportTicket', row['id'], {'reply': reply, 'status': '已回复'}, row['lockVersion'], True, key=key + ':reply')
        refs['supportTickets'][key]['complete'] = True
        checkpoint()
    manifest['completedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    manifest['counts'] = {kind: len(items) for kind, items in refs.items()}
    checkpoint()
    print(json.dumps({'catalogExamplesAdded': True, 'project': PROJECT, 'counts': manifest['counts'],
                      'preservedExistingData': True}, ensure_ascii=False))

if __name__ == '__main__':
    main()
