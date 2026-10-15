#!/usr/bin/env python3
"""Authorization/session regressions; only an explicitly isolated security project is accepted."""
import datetime as dt
import json
import os
from pathlib import Path
import secrets
import time
import uuid

from probe_scope import isolated_deployment

ENV_PATH, ENV, deploy = isolated_deployment()
assert ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-security-')
assert os.environ.get('JIAFENG_TEST_URL') == 'http://127.0.0.1:' + ENV['JIAFENG_HTTP_PORT']

from business_probe import Client, ROOT, draft

CHECKS = []


def check(name, condition=True):
    assert condition, name
    CHECKS.append(name)
    print('PASS', name, flush=True)


def sql(statement):
    result = deploy.compose('exec', '-T', 'mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --default-character-set=utf8mb4 -N -B jiafeng',
        input=statement, text=True, capture_output=True)
    assert result.returncode == 0, 'isolated database fixture operation failed'
    return result.stdout.strip()


def internal(client, method, path, data=None):
    # Use only the isolated AI container's Python standard library as an HTTP transport.
    # No AI service/model endpoint is invoked; secrets are stdin data, never command arguments.
    code = """import json,sys,urllib.request,urllib.error
p=json.load(sys.stdin)
r=urllib.request.Request('http://server:8080'+p['path'],method=p['method'],
 headers={'Authorization':'Bearer '+p['token'],'clientid':'jiafeng','Content-Type':'application/json'},
 data=None if p['data'] is None else json.dumps(p['data']).encode())
try:
 with urllib.request.urlopen(r,timeout=30) as response: status=response.status;body=response.read()
except urllib.error.HTTPError as error: status=error.code;body=error.read()
print(json.dumps({'status':status,'body':json.loads(body)}))
"""
    result = deploy.compose('exec', '-T', 'ai', 'python', '-c', code,
        input=json.dumps({'token': client.token, 'method': method, 'path': path, 'data': data}),
        text=True, capture_output=True)
    assert result.returncode == 0, 'isolated internal HTTP request failed'
    return json.loads(result.stdout)


def post(client, path, data):
    return client.call('POST', path, data, {'Idempotency-Key': str(uuid.uuid4())})[1]


def password_login(name, password, client='admin', expected=200):
    time.sleep(2.05)  # Keep this correctness probe below the independently configured ingress limiter.
    session = object.__new__(Client)
    session.name = name
    session.token = ''
    result = session.call('POST', '/auth/login', {'username': name, 'password': password, 'client': client}, expected=expected)[1]
    if expected == 200:
        session.token = result['token']
        session.user = result['user']
    return session


def main():
    admin = Client('devadmin', 'admin')
    author = Client('member_zj')
    other = Client('member_bj')
    operator = Client('region_zj', 'admin')
    expert = Client('expert_zj', 'admin')
    author.call('GET', '/admin/accounts', expected=403)
    check('member cannot enter business account administration')
    author.call('GET', '/auth/me', headers={'Authorization': '', 'Cookie': 'Authorization=Bearer ' + author.token}, expected=401)
    check('cookie alone cannot authenticate the header bearer business session')

    attachment = author.upload(b'%PDF-1.4\n% synthetic security test only\n%%EOF\n')
    work = post(author, '/submissions', {**draft(title='独立隔离安全评分验收 ' + uuid.uuid4().hex[:8]), 'attachments': [attachment]})
    sid = work['id']
    other.call('GET', '/submissions/' + sid + '/progress', expected=404)
    expert.call('GET', '/submissions/' + sid + '/progress', expected=404)
    expert.call('GET', '/files/' + attachment['fileId'] + '/download', expected=404)
    expert.call('GET', '/files/' + attachment['fileId'] + '/url', expected=404)
    check('other owner and expert cannot fetch original manuscript or either original file URL alias')

    operator.act('approveSubmission', 'submissions', sid)
    operator.act('prepareBlindMaterial', 'submissions', sid,
        {'content': '这是只用于隔离安全检查的匿名家风材料，不包含作者姓名、联系方式或原始附件。', 'confirmed': True})
    operator.act('assignReview', 'submissions', sid,
        {'expertId': expert.user['id'], 'dueAt': (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)).isoformat()})
    task = next(t for t in expert.workspace()['reviewTasks'] if t['submissionId'] == sid and t['status'] == 'pending')
    check('assigned expert receives blind material without original attachments',
        task['content'].startswith('这是只用于隔离') and 'attachments' not in task)
    saved_grants = sql("SELECT rm.role_id,rm.menu_id FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id "
        "JOIN sys_menu m ON m.menu_id=rm.menu_id WHERE r.role_key='jf_expert' AND m.perms='reviews:score'")
    assert saved_grants, 'fixture expert must initially have score permission'
    rows = [tuple(map(int, row.split('\t'))) for row in saved_grants.splitlines()]
    try:
        sql("DELETE rm FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id JOIN sys_menu m ON m.menu_id=rm.menu_id "
            "WHERE r.role_key='jf_expert' AND m.perms='reviews:score'")
        current = expert.call('GET', '/auth/me')[1]
        check('permission removal is observed by the existing authenticated expert session',
            'expert' in current['roles'] and 'reviews:score' not in current['permissions'])
        payload = {'scores': [28, 28, 23, 14], 'comment': '撤销评分权限后不能通过兼容入口提交此评分。'}
        expert.command('review.submit', task['id'], payload, task['version'], expected=403)
        expert.command('submitReview', task['id'], payload, task['version'], admin=True, expected=403)
        unchanged = next(t for t in expert.workspace()['reviewTasks'] if t['id'] == task['id'])
        check('both score entry points reject revoked permission without changing task version or state',
            unchanged['version'] == task['version'] and unchanged['status'] == 'pending')
    finally:
        sql('INSERT IGNORE INTO sys_role_menu(role_id,menu_id) VALUES ' + ','.join(f'({r},{m})' for r, m in rows))
    expert.command('review.submit', task['id'], {'scores': [28, 28, 23, 14], 'comment': '恢复有效授权后同一任务仍可合法提交评分。'}, task['version'])
    check('authorized owner can still score the unchanged task after permission is restored')

    # The retained upstream controller is independently tested over the internal network.
    # Synthetic records contain no external credentials and are always removed afterward.
    relation = 8_000_000_000_000_000 + secrets.randbelow(1_000_000_000)
    sql(f"INSERT INTO sys_social(id,user_id,auth_id,source,user_name,access_token) VALUES({relation},{author.user['id']},'security-{relation}','local-fixture','security-fixture','synthetic-not-a-token')")
    try:
        denied = internal(other, 'DELETE', '/auth/unlock/' + str(relation))
        check('upstream social unlink cannot delete another owners relation',
            denied['body'].get('code') != 200 and sql(f'SELECT COUNT(*) FROM sys_social WHERE id={relation}') == '1')
        allowed = internal(author, 'DELETE', '/auth/unlock/' + str(relation))
        check('upstream social unlink still permits the relation owner',
            allowed['body'].get('code') == 200 and sql(f'SELECT COUNT(*) FROM sys_social WHERE id={relation}') == '0')
    finally:
        sql(f'DELETE FROM sys_social WHERE id={relation}')
    retained = internal(author, 'GET', '/system/user/list')
    check('business token cannot enter retained protected upstream user administration',
        retained['status'] in (401, 403) or retained['body'].get('code') in (401, 403))
    name = 'sec_' + uuid.uuid4().hex[:14]
    password, changed_password = 'A9' + secrets.token_hex(10), 'B8' + secrets.token_hex(10)
    created = post(admin, '/admin/accounts', {'username': name, 'name': '隔离安全会话账号', 'password': password,
        'organization': '虚构安全检查机构', 'roles': ['content_operator'], 'regionIds': ['zhejiang']})
    uid = created['id']
    upstream_client = sql("SELECT client_id FROM sys_client WHERE status='0' AND LOCATE('password',grant_type)>0 LIMIT 1")
    if upstream_client:
        anonymous = object.__new__(Client)
        anonymous.token = ''
        upstream = internal(anonymous, 'POST', '/auth/login', {'clientId': upstream_client, 'grantType': 'password',
            'username': name, 'password': password})
        assert upstream['body'].get('code') == 200, 'retained upstream login fixture failed'
        upstream_session = object.__new__(Client)
        upstream_session.token = upstream['body']['data']['access_token']
        upstream_session.call('GET', '/auth/me', expected=401)
        check('retained upstream login token cannot become a business identity')
        internal(upstream_session, 'POST', '/auth/logout')
    first = password_login(name, password)
    first.call('GET', '/admin/review-alerts?scope=all', expected=403)
    check('content operator cannot read regional review alerts without review permission')
    second = password_login(name, password, 'member')

    def change(action, extra):
        version = admin.call('GET', '/admin/accounts/' + uid)[1]['version']
        post(admin, '/admin/accounts/' + uid + '/' + action, {'version': version, **extra})

    change('roles', {'roles': ['content_operator'], 'regionIds': ['beijing']})
    first.call('GET', '/auth/me', expected=401)
    second.call('GET', '/auth/me', expected=401)
    check('region authorization change invalidates both admin and member entry sessions')
    first = password_login(name, password)
    change('status', {'enabled': False})
    first.call('GET', '/auth/me', expected=401)
    password_login(name, password, expected=401)
    change('status', {'enabled': True})
    first.call('GET', '/auth/me', expected=401)
    check('disable and reenable never resurrect an old session')
    first = password_login(name, password)
    change('resetPassword', {'password': changed_password})
    first.call('GET', '/auth/me', expected=401)
    password_login(name, password, expected=401)
    first = password_login(name, changed_password)
    check('password reset rejects the old token and old password while the new password works')
    first.call('POST', '/auth/logout')
    first.call('GET', '/auth/me', expected=401)
    check('logout revokes the current session')
    change('status', {'enabled': False})

    output = ROOT / 'deploy/.local/security-2026-10-15/auth-results.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'passed': CHECKS, 'count': len(CHECKS), 'project': ENV['COMPOSE_PROJECT_NAME'],
        'submissionId': sid, 'testAccountId': uid, 'notice': 'isolated synthetic fixtures; no external model requests'}, ensure_ascii=False, indent=2) + '\n')
    print('RESULT', output, flush=True)


if __name__ == '__main__':
    main()
