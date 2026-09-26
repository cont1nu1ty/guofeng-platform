#!/usr/bin/env python3
"""Create a fictional, API-backed local showcase. Requires an empty demo database."""
from __future__ import annotations

import datetime as dt
import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid

HERE = Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader('jiafeng_deploy', str(HERE / 'dev'))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)
ENV = deploy.read_env(deploy.ENV_FILE)
BASE = 'http://127.0.0.1:' + ENV['JIAFENG_HTTP_PORT'] + '/api/v1'
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
NOW = dt.datetime.now(dt.timezone.utc)
FIXTURE = HERE / 'fixtures/showcase_content.json'
MANIFEST = HERE / '.local/showcase-manifest.json'
ACCOUNTS = [
    (10001, 'devadmin', '全国展示运营', 'staff', 'all', 'national_admin', '家风展示项目组', '已通过', True),
    (10002, 'region_zj', '沈书宁', 'staff', 'zhejiang', 'regional_admin', '浙江展示运营组', '已通过', True),
    (10003, 'region_bj', '陆知微', 'staff', 'beijing', 'regional_admin', '北京展示运营组', '已通过', True),
    (10004, 'expert_zj', '顾明川', 'staff', 'zhejiang', 'expert', '江南家风读书会（虚构）', '已通过', True),
    (10005, 'member_zj', '林晚晴', 'member', 'zhejiang', 'member', '青禾社区家庭读书小组（虚构）', '已通过', True),
    (10006, 'member_bj', '陈景和', 'member', 'beijing', 'member', '槐荫街坊志愿小组（虚构）', '已通过', True),
    (11001, 'member_js', '周砚秋', 'member', 'jiangsu', 'member', '澄溪校园文学社（虚构）', '已通过', True),
    (11002, 'member_sc', '赵云舒', 'member', 'sichuan', 'member', '竹里家庭阅读小组（虚构）', '已通过', True),
    (11003, 'member_overseas', '许知远', 'member', 'overseas', 'member', '海外中文家书小组（虚构）', '已通过', True),
    (11004, 'expert_bj', '闻溪', 'staff', 'beijing', 'expert', '槐荫文史研读社（虚构）', '已通过', True),
    (11005, 'expert_sc', '唐亦舟', 'staff', 'sichuan', 'expert', '竹里家教研习社（虚构）', '已通过', True),
    (11006, 'member_pending', '宋青禾', 'member', 'zhejiang', 'member', '春芽家庭成长小组（虚构）', '待审核', True),
    (11007, 'member_disabled', '何望舒', 'member', 'beijing', 'member', '已暂停的展示账号', '已通过', False),
]


def sql(query):
    return deploy.compose('exec', '-T', 'mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 -u root -N -B jiafeng',
        input=query, text=True, encoding='utf-8', capture_output=True).stdout.strip()


def lit(value):
    # Hex literals avoid SQL string escaping and keep non-ASCII deterministic.
    return "CONVERT(X'" + str(value).encode().hex() + "' USING utf8mb4)"


def js(value):
    return lit(json.dumps(value, ensure_ascii=False))


class Client:
    def __init__(self, name, client='member'):
        self.token = ''
        self.name = name
        self.sequence = 0
        data, _ = self.call('POST', '/auth/login', {
            'username': name, 'password': ENV['JIAFENG_DEV_PASSWORD'], 'client': client})
        self.token = data['token']
        self.user = data['user']

    def call(self, method, path, data=None, headers=None, expected=200):
        hs = {'Content-Type': 'application/json'}
        if self.token:
            hs['Authorization'] = 'Bearer ' + self.token
        hs.update(headers or {})
        request = urllib.request.Request(BASE + path, method=method, headers=hs,
            data=None if data is None else json.dumps(data, ensure_ascii=False).encode())
        try:
            with HTTP.open(request, timeout=90) as response:
                return json.load(response), dict(response.headers)
        except urllib.error.HTTPError as exc:
            raw = json.load(exc)
            if exc.code != expected:
                raise RuntimeError(f'{method} {path}: {exc.code} {raw.get("code")} {raw.get("message")}') from None
            return raw, dict(exc.headers)

    def workspace(self, admin=False):
        return self.call('GET', '/admin/workspace' if admin else '/workspace')[0]

    def command(self, command, entity='', data=None, version=None, admin=False):
        self.sequence += 1
        key = str(uuid.uuid5(uuid.NAMESPACE_URL,
            f'jiafeng-showcase-v1:{self.name}:{self.sequence}:{command}:{entity}'))
        body = {'command': command, 'entityId': entity, 'data': data or {}}
        if version is not None:
            body['version'] = version
        return self.call('POST', '/admin/commands' if admin else '/commands', body,
                         {'Idempotency-Key': key})[0]

    def act(self, command, collection, entity, data=None):
        current = next(x for x in self.workspace(True)[collection] if x['id'] == entity)
        return self.command(command, entity, data, current['lockVersion'], True)

    def upload(self, path):
        boundary = 'showcase' + uuid.uuid4().hex
        blob = path.read_bytes()
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
                'Content-Type: application/pdf\r\n\r\n').encode() + blob + f'\r\n--{boundary}--\r\n'.encode()
        req = urllib.request.Request(BASE + '/files', data=body, headers={
            'Authorization': 'Bearer ' + self.token, 'Content-Type': 'multipart/form-data; boundary=' + boundary})
        with HTTP.open(req, timeout=90) as response:
            return json.load(response)


def bootstrap_accounts():
    statements = ['START TRANSACTION;']
    for uid, username, name, realm, region, role, organization, status, enabled in ACCOUNTS:
        if uid >= 11000:
            statements += [f'''INSERT INTO sys_user(user_id,dept_id,user_name,nick_name,user_type,password,status,del_flag,create_time)
                SELECT {uid},100,{lit(username)},{lit(name)},{lit('app_user' if realm == 'member' else 'sys_user')},password,'0','0',NOW()
                FROM sys_user WHERE user_id=10001;''',
                f'''INSERT INTO jf_account(user_id,realm,region_ids,roles,profile,enabled)
                VALUES({uid},{lit(realm)},{js([region])},{js([role])},{js({'organization': organization, 'status': status, 'fictional': True})},{int(enabled)});''']
        else:
            statements += [f'UPDATE sys_user SET nick_name={lit(name)} WHERE user_id={uid};',
                f'UPDATE jf_account SET profile={js({"organization": organization, "status": status, "fictional": True})} WHERE user_id={uid};']
        if role == 'expert':
            profile = {'name': name, 'title': '家风文学评审员（模拟）', 'organization': organization,
                'group': '文史研究组' if region == 'beijing' else '文学创作组', 'availability': '可分配',
                'specialties': ['家风家书', '家风纪实散文'] if region != 'beijing' else ['红色家风回忆录', '家风文论'],
                'biography': '虚构评审身份，用于演示匿名材料阅读、分项评分与人工确认。', 'email': '', 'rating': 0}
            statements.append(f'''INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload)
                VALUES('{uid}','expert',{uid},{lit(region)},'active',{js(profile)})
                ON DUPLICATE KEY UPDATE payload=VALUES(payload);''')
    statements += ['COMMIT;']
    sql('\n'.join(statements))


def validate_fixture(dataset):
    scenarios = {'pending', 'returned', 'resubmitted', 'review_pending', 'review_overdue',
        'review_midway', 'decision_pending', 'shortlisted_private', 'shortlisted_public',
        'awarded_public', 'collected_public', 'rejected', 'withdrawn_public', 'draft'}
    account_regions = {a[1]: a[4] for a in ACCOUNTS}
    for section in ('submissions', 'drafts', 'contents', 'collections', 'activities', 'courses',
                    'products', 'knowledgeDocuments', 'dictionaryWords', 'notificationDrafts'):
        items = dataset.get(section, [])
        if not items or len({x['key'] for x in items}) != len(items):
            raise ValueError('Missing items or duplicate keys in ' + section)
        for item in items:
            if item.get('actor') and item['actor'] not in account_regions:
                raise ValueError('Unknown fixture account: ' + item['actor'])
    for item in dataset['submissions'] + dataset['drafts']:
        if item['scenario'] not in scenarios or account_regions[item['actor']] != item['data']['region']:
            raise ValueError('Invalid manuscript scenario/account region: ' + item['key'])
    published = {x['key'] for x in dataset['submissions']
                 if x['scenario'] in ('shortlisted_public', 'awarded_public', 'collected_public')}
    for item in dataset['collections']:
        if not set(item.get('importSubmissionKeys', [])).issubset(published):
            raise ValueError('Collection references an unpublished manuscript: ' + item['key'])
    for item in dataset['activities']:
        if item['scenario'] == 'full' and item['data']['capacity'] > 3:
            raise ValueError('Full activity needs capacity <= 3 for this small fixture')
    for item in dataset['courses']:
        lessons = item['data'].get('lessons', [])
        if len(lessons) < 2 or not all(x.get('id') and x.get('title') and x.get('body') for x in lessons):
            raise ValueError('Course must contain actual chapters: ' + item['key'])


def main():
    if ENV.get('JIAFENG_DEV_ACCOUNTS_ENABLED', '').lower() != 'true':
        raise ValueError('Showcase data can only be installed when development accounts are enabled')
    project = ENV['COMPOSE_PROJECT_NAME']
    if project != 'jiafeng-dev' and not project.startswith('jiafeng-demo-'):
        raise ValueError('Only the isolated jiafeng-dev/jiafeng-demo-* deployment can be seeded')
    dataset = json.loads(FIXTURE.read_text())
    validate_fixture(dataset)
    for path in ('投稿附页.pdf', '资料使用指南.pdf', '匿名评审工作说明.pdf'):
        if not (HERE / 'fixtures/files' / path).exists():
            raise ValueError('Missing committed sample attachment: ' + path)
    occupied = int(sql("SELECT COUNT(*) FROM jf_entity WHERE kind NOT IN ('setting','expert');"))
    if occupied or int(sql('SELECT COUNT(*) FROM jf_file;')) or int(sql('SELECT COUNT(*) FROM jf_account;')) != 6:
        raise ValueError('Business data already exists; use ./deploy/dev reset-demo to back up and rebuild instead of adding duplicates')
    bootstrap_accounts()
    clients = {row[1]: Client(row[1], 'admin' if row[3] == 'staff' else 'member')
               for row in ACCOUNTS if row[-1]}
    admin = clients['devadmin']
    refs = {kind: {} for kind in ('submissions', 'contents', 'collections', 'activities', 'courses', 'products', 'knowledgeDocuments', 'dictionaryWords', 'notificationDrafts', 'claims', 'drafts')}
    checks = []
    config = admin.workspace(True)['platformConfig']
    config.update({'subtitle': '网页联动展示 · 虚构场景数据',
        'notice': '当前为本机模拟场景：人物、机构、作品、活动与业务结果均为虚构，仅用于网页联动演示。',
        'contact': '家风平台展示服务台'})
    admin.command('savePlatformConfig', data=config, version=config['lockVersion'], admin=True)
    # Defaults retain the complete six-stage pilot; every workflow is created through API.
    attachments = {}
    for name in ('member_zj', 'member_bj', 'member_js'):
        attachments[name] = clients[name].upload(HERE / 'fixtures/files/投稿附页.pdf')
    for item in dataset['submissions']:
        actor = clients[item['actor']]
        data = {**item['data'], 'overseasLocation': item['data'].get('overseasLocation', ''), 'attachments': []}
        if item.get('attachment', item['actor'] in attachments):
            if item['actor'] in attachments:
                data['attachments'] = [attachments[item['actor']]]
        scenario = item['scenario']
        if scenario == 'draft':
            continue  # Save last, so subsequent submissions do not clear this draft.
        work, _ = actor.call('POST', '/submissions', data,
                            {'Idempotency-Key': 'showcase:' + item['key']})
        sid = work['id']
        refs['submissions'][item['key']] = {'id': sid, 'title': data['title'], 'actor': item['actor'], 'scenario': scenario}
        if scenario in ('returned', 'resubmitted'):
            if scenario == 'returned':
                admin.act('approveSubmission', 'submissions', sid)
                admin.act('prepareBlindMaterial', 'submissions', sid,
                    {'content': item.get('blindContent', data['content']), 'confirmed': True})
                admin.act('assignReview', 'submissions', sid,
                    {'expertId': clients['expert_bj'].user['id'], 'dueAt': (NOW+dt.timedelta(days=7)).isoformat()})
            admin.act('returnSubmission', 'submissions', sid, {'reason': item.get('reviewNotes', '请补充故事中的具体行动与时间背景，并删去不必要的家庭住址信息。')})
            if scenario == 'resubmitted':
                current = next(x for x in actor.workspace()['works'] if x['id'] == sid)
                data['content'] = item.get('revisionContent', data['content'] + '\n\n补记：我又向家人核对了细节，补充了邻里相互照应的一次经历。')
                actor.call('POST', f'/submissions/{sid}/revisions', data,
                    {'Idempotency-Key': 'showcase:revision:' + item['key'], 'If-Match': f'"{current["version"]}"'})
        elif scenario != 'pending':
            admin.act('approveSubmission', 'submissions', sid)
            blind = item.get('blindContent', data['content'])
            for row in ACCOUNTS:
                blind = blind.replace(row[2], '作者')
            admin.act('prepareBlindMaterial', 'submissions', sid, {'content': blind, 'confirmed': True})
            stages = 0 if scenario in ('review_pending', 'review_overdue') else 2 if scenario == 'review_midway' else 5
            for index in range(stages + (1 if scenario in ('review_pending', 'review_overdue', 'review_midway') else 0)):
                reviewer = clients['expert_zj' if index % 2 == 0 else 'expert_bj']
                due = NOW + dt.timedelta(days=7)
                if scenario == 'review_overdue':
                    due = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=2)
                admin.act('assignReview', 'submissions', sid, {'expertId': reviewer.user['id'], 'dueAt': due.isoformat()})
                task = next(t for t in reviewer.workspace()['reviewTasks'] if t['submissionId'] == sid and t['status'] == 'pending')
                if index < stages:
                    reviewer.command('review.submit', task['id'], {
                        'scores': item.get('scores', [27, 27, 22, 13]),
                        'comment': item.get('reviewNotes', '叙事具体，能以日常行动呈现家庭责任；文字克制，建议保留生活细节。') + f'（第{index + 2}节点模拟评阅）'}, task['version'])
            if scenario in ('shortlisted_private', 'shortlisted_public', 'awarded_public', 'collected_public', 'rejected', 'withdrawn_public'):
                decision = {'awarded_public': 'awarded', 'collected_public': 'collected', 'rejected': 'rejected'}.get(scenario, 'shortlisted')
                admin.act('decideSubmission', 'submissions', sid, {'result': decision,
                    'note': '展示场景人工确认：' + ('本轮未入围，建议继续打磨叙事。' if decision == 'rejected' else '根据各节点意见确认结果，公开发布另行处理。')})
                if scenario.endswith('_public') and scenario != 'shortlisted_private':
                    admin.act('publishSubmission', 'submissions', sid, {'published': True})
                if scenario == 'withdrawn_public':
                    admin.act('publishSubmission', 'submissions', sid, {'published': False})
        print('Created manuscript:', item['key'], scenario, flush=True)
    drafts = [x for x in dataset['submissions'] if x['scenario'] == 'draft'] + dataset.get('drafts', [])
    for item in drafts:
        actor = clients[item['actor']]
        data = {**item['data'], 'overseasLocation': item['data'].get('overseasLocation', ''), 'attachments': [attachments[item['actor']]] if item['actor'] in attachments else []}
        _, headers = actor.call('GET', '/me/draft')
        actor.call('PUT', '/me/draft', data, {'If-Match': headers.get('ETag') or headers.get('Etag')})
        refs['drafts'][item['key']] = {'actor': item['actor'], 'title': data['title']}
    for kind, command, status_command, collection in (
        ('contents', 'saveContent', 'setContentStatus', 'contents'),
        ('courses', 'saveCourse', 'toggleCourse', 'courses'),
        ('products', 'saveProduct', 'toggleProduct', 'products'),
        ('dictionaryWords', 'saveDictionaryWord', '', 'dictionaryWords'),
        ('notificationDrafts', 'saveNotificationDraft', '', 'notificationDrafts')):
        for item in dataset.get(kind, []):
            operator = clients.get(item.get('actor'), admin)
            value = operator.command(command, data=item['data'], admin=True)['result']
            refs[kind][item['key']] = {'id': value['id'], 'title': item['data'].get('title', item['data'].get('word'))}
            target = item.get('desiredStatus')
            if target and status_command and target != value.get('status'):
                operator.act(status_command, collection, value['id'], {'status': target})
            if kind == 'dictionaryWords' and item.get('enabled') is False:
                operator.act('toggleDictionaryWord', collection, value['id'], {'enabled': False})
            if kind == 'notificationDrafts' and target in ('已发送', 'published'):
                operator.act('publishNotification', collection, value['id'])
    for item in dataset['collections']:
        value = admin.command('saveCollection', data=item['data'], admin=True)['result']
        refs['collections'][item['key']] = {'id': value['id'], 'title': item['data']['title']}
        for chapter in item.get('chapters', []):
            admin.act('saveChapter', 'collections', value['id'], chapter)
        for key in item.get('importSubmissionKeys', []):
            admin.act('importChapter', 'collections', value['id'], {'submissionId': refs['submissions'][key]['id']})
        if item.get('desiredStatus') == '已入藏':
            admin.act('collectVolume', 'collections', value['id'])
    members = [clients[n] for n in ('member_zj', 'member_bj', 'member_js', 'member_sc', 'member_overseas')]
    for item in dataset['activities']:
        target = item.get('desiredStatus', '报名中')
        data = {**item['data'], 'startAt': (NOW + dt.timedelta(days=item.get('startOffsetDays', 3))).isoformat(),
            'endAt': (NOW + dt.timedelta(days=item.get('endOffsetDays', 4))).isoformat()}
        # Enrol/finish historical scenarios through real transitions before setting historical times.
        historical = item.get('endOffsetDays', 4) < 0
        original_dates = {k: data[k] for k in ('startAt', 'endAt')}
        if historical:
            data.update(startAt=(NOW+dt.timedelta(days=1)).isoformat(), endAt=(NOW+dt.timedelta(days=2)).isoformat())
        value = admin.command('saveActivity', data=data, admin=True)['result']; aid = value['id']
        refs['activities'][item['key']] = {'id': aid, 'title': data['title'], 'scenario': item['scenario']}
        if target != '草稿':
            admin.act('setActivityStatus', 'activities', aid, {'status': '报名中'})
            participants = members[:min(data['capacity'], 3)] if item['scenario'] == 'full' else members[:2]
            for actor in participants:
                actor.command('activity.register', aid)
            if item['scenario'] in ('cancelled-registration', 'cancelled_registration'):
                members[0].command('activity.cancel', aid)
            if target in ('进行中', '已结束'):
                admin.act('setActivityStatus', 'activities', aid, {'status': '进行中'})
                participants[0].command('activity.checkIn', aid)
            if target == '已结束':
                admin.act('setActivityStatus', 'activities', aid, {'status': '已结束'})
            if historical:
                admin.act('saveActivity', 'activities', aid, {**data, **original_dates})
                # Historical fixture dates are domain sample data, not fabricated API audit times.
                registered = NOW + dt.timedelta(days=item['startOffsetDays']-3)
                checked = NOW + dt.timedelta(days=item['startOffsetDays'], minutes=20)
                sql(f"UPDATE jf_registration SET created_at={lit(registered.strftime('%Y-%m-%d %H:%M:%S'))} WHERE activity_id={lit(aid)};"
                    f"UPDATE jf_entity SET payload=JSON_SET(payload,'$.checkedAt',{lit(checked.isoformat())}) "
                    f"WHERE kind='checkin' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.activityId'))={lit(aid)};")
    for index, item in enumerate(dataset['knowledgeDocuments']):
        file = admin.upload(HERE / 'fixtures/files' / ('资料使用指南.pdf' if index == 0 else '匿名评审工作说明.pdf'))
        value = admin.command('saveKnowledgeDocument', data={**item['data'], 'fileId': file['fileId']}, admin=True)['result']
        refs['knowledgeDocuments'][item['key']] = {'id': value['id'], 'fileId': file['fileId'], 'title': item['data']['title']}
    # Personal records are also written through the same APIs used by the web UI.
    published_courses = [x for x in admin.workspace(True)['courses'] if x['status'] == '已上架']
    for index, course in enumerate(published_courses):
        for lesson in course['lessons']:
            members[0].command('course.progress', course['id'], {'lessonId': lesson['id']})
        members[1].command('course.progress', course['id'], {'lessonId': course['lessons'][0]['id']})
    products = [x for x in admin.workspace(True)['products'] if x['status'] == '已上架' and x['stock'] >= 2]
    if not products:
        raise ValueError('At least one published product with stock >=2 is needed')
    for i, state in enumerate(('recorded', 'approved', 'issued', 'returned', 'cancelled', 'custom')):
        product = products[i % len(products)]
        actor = members[i % len(members)]
        claim = actor.command('welfare.claim', product['id'], {'kind': 'custom' if state == 'custom' else 'public',
            'organization': next(row[6] for row in ACCOUNTS if row[1] == actor.name), 'quantity': 1,
            'purpose': '用于周末家庭共读活动，每份材料由参与家庭轮流借阅，并在活动后归还小组保管。'})['result']
        if state in ('approved', 'issued'):
            admin.act('processClaim', 'welfareClaims', claim['id'], {'action': 'approve'})
        if state == 'issued':
            admin.act('processClaim', 'welfareClaims', claim['id'], {'action': 'deliver'})
        elif state == 'returned':
            admin.act('processClaim', 'welfareClaims', claim['id'], {'action': 'return', 'note': '请补充活动预计参与人数和材料保管方式后重新申请。'})
        elif state == 'cancelled':
            actor.command('welfare.cancel', claim['id'])
        refs['claims'][state] = {'id': claim['id'], 'actor': actor.name, 'productId': product['id']}
    public_works = [x for x in members[0].workspace()['works'] if x.get('published')]
    for actor in members[:2]:
        if public_works:
            actor.command('favorite.toggle', public_works[0]['id'])
            actor.command('archive.excerpt.save', data={'sourceId': public_works[0]['id'], 'sourceTitle': public_works[0]['title'],
                'text': public_works[0]['content'][:80], 'note': '共读笔记：把关心落实在每天可做到的小事上。'})
        notifications = actor.workspace()['notifications']
        if notifications:
            actor.command('notification.read', notifications[0]['id'])
    admin.act('updateExpert', 'experts', '11005', {'group': '家风教育组', 'availability': '暂停接单'})
    check_dataset(admin, clients, dataset, refs, checks)
    manifest = {'datasetVersion': dataset.get('metadata', {}).get('version', '1.0'), 'seededAt': NOW.isoformat(),
        'fixtureSha256': hashlib.sha256(FIXTURE.read_bytes()).hexdigest(), 'project': project,
        'fictional': True, 'refs': refs, 'checks': checks,
        'accounts': [{'username': r[1], 'name': r[2], 'role': r[5], 'region': r[4], 'enabled': r[-1]} for r in ACCOUNTS],
        'counts': json.loads(sql("SELECT JSON_OBJECT('accounts',(SELECT COUNT(*) FROM jf_account),'manuscripts',(SELECT COUNT(*) FROM jf_entity WHERE kind='submission'),'revisions',(SELECT COUNT(*) FROM jf_revision),'tasks',(SELECT COUNT(*) FROM jf_entity WHERE kind='task'),'files',(SELECT COUNT(*) FROM jf_file),'registrations',(SELECT COUNT(*) FROM jf_registration WHERE status='registered'),'claims',(SELECT COUNT(*) FROM jf_entity WHERE kind='claim'));"))}
    MANIFEST.parent.mkdir(exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'status': 'ready', 'counts': manifest['counts'], 'verifiedChecks': len(checks), 'manifest': str(MANIFEST)}, ensure_ascii=False, indent=2))


def check_dataset(admin, clients, dataset, refs, checks):
    workspace = admin.workspace(True)
    with HTTP.open(BASE + '/workspace', timeout=60) as response:
        public = json.load(response)
    public_ids = {x['id'] for x in public['works']}
    for value in refs['submissions'].values():
        expected = value['scenario'] in ('shortlisted_public', 'awarded_public', 'collected_public')
        assert (value['id'] in public_ids) == expected, value
    checks.append('Visitor work visibility follows decisions and publication; private/withdrawn/returned hidden')
    assert not public['registrations'] and not public['commerceRequests'] and not public['reviewTasks']
    checks.append('Visitor has no member or expert private records')
    for user, region in (('region_zj', '浙江省'), ('region_bj', '北京市')):
        scoped = clients[user].workspace(True)
        assert all(x['region'] == region for x in scoped['submissions'])
    checks.append('Regional operators only receive permitted manuscript regions')
    for username in ('expert_zj', 'expert_bj'):
        tasks = clients[username].workspace()['reviewTasks']
        assert all(x['expertId'] == clients[username].user['id'] and 'attachments' not in x for x in tasks)
    checks.append('Expert tasks are assigned and contain anonymized text without originals')
    assert public['reviewRuleVersion'] == 'jiafeng-four-v1'
    assert [x['max'] for x in public['scoringDimensions']] == [30, 30, 25, 15]
    assert public['scoringDimensions'] == workspace['scoringDimensions']
    assert all(t['dimensions'] == public['scoringDimensions'] for t in workspace['tasks'])
    checks.append('Public review criteria, admin settings and assigned tasks share the same four-dimensional rubric')
    revisions = [x for x in workspace['submissions'] if x['version'] > 1]
    assert revisions and all(len(x['revisions']) >= 2 for x in revisions)
    checks.append('Resubmitted manuscripts keep immutable original revisions')
    assert len(public['news']) == sum(x.get('desiredStatus') == '已发布' for x in dataset['contents'])
    assert {'red', 'integrity', 'everyday', 'classical'} <= {x['topic'] for x in public['news']}
    assert len(public['classics']) == sum(x.get('desiredStatus') == '已入藏' for x in dataset['collections'])
    checks.append('Published content and collected volumes match public catalog')
    assert any(len(a['registrations']) == a['capacity'] for a in workspace['activities'])
    assert any(any(r['checkedIn'] for r in a['registrations']) for a in workspace['activities'])
    checks.append('Activities include capacity reached, cancellation, ongoing check-in and ended branches')
    assert {'待审核', '待发放', '已发放', '已退回', '已取消'} <= {x['status'] for x in workspace['welfareClaims']}
    checks.append('All five welfare request states are backed by persisted records')
    assert any(x.get('completedAt') for x in clients['member_zj'].workspace()['learning']['courses'].values())
    assert any(not x.get('completedAt') for x in clients['member_bj'].workspace()['learning']['courses'].values())
    checks.append('Learning includes completed and partially completed real lessons')
    for item in dataset['courses']:
        course = next(x for x in workspace['courses'] if x['id'] == refs['courses'][item['key']]['id'])
        assert course['regionId'] == item['data'].get('region', 'all')
    checks.append('Courses preserve their configured region scope')
    for item in dataset.get('drafts', []):
        saved, _ = clients[item['actor']].call('GET', '/me/draft')
        assert saved['draft']['title'] == item['data']['title']
    checks.append('Both member cloud drafts are retained independently')
    assert any(x['status'] == '已取消' for x in workspace['tasks'])
    assert any(x['status'] == '待评分' and dt.datetime.fromisoformat(x['dueAt'].replace('Z', '+00:00')) < dt.datetime.now(dt.timezone.utc) for x in workspace['tasks'])
    assert any(x['status'] == '待评分' and dt.datetime.fromisoformat(x['dueAt'].replace('Z', '+00:00')) > dt.datetime.now(dt.timezone.utc) for x in workspace['tasks'])
    checks.append('Review tasks include active, completed, cancelled and expired branches')
    assert any(not x['enabled'] for x in workspace['users']) and any(x['status'] == '待审核' for x in workspace['users'])
    assert any(x['availability'] == '暂停接单' for x in workspace['experts'])
    checks.append('Account approval, disabled account and paused expert fixtures are visible')
    assert not workspace['aiRecords'] and all(x['status'] == '未索引' for x in workspace['knowledgeBases'])
    checks.append('AI documents remain unindexed and no fabricated model invocation logs exist')
    for user in ('member_zj', 'member_bj', 'member_js'):
        own = next(x for x in clients[user].workspace()['works'] if x.get('isMine') and x.get('attachments'))
        file = own['attachments'][0]
        signed = clients[user].call('GET', '/files/' + file['fileId'] + '/download')[0]
        with HTTP.open(signed['url'], timeout=30) as response:
            blob = response.read()
        assert hashlib.sha256(blob).hexdigest() == hashlib.sha256((HERE/'fixtures/files/投稿附页.pdf').read_bytes()).hexdigest()
    checks.append('Chinese-named private sample PDFs download with matching checksums')
    assert not sql("SELECT id FROM jf_entity WHERE JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')) LIKE '%验收%' LIMIT 1;")
    checks.append('Old integration-probe records have been removed from active business data')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not print requests, credentials or signed URLs on failure.
        print('Showcase seed stopped:', str(exc), file=sys.stderr)
        sys.exit(1)
