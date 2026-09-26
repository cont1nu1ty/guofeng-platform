#!/usr/bin/env python3
"""Exercise demo installation in a NEW jiafeng-demo-bootstrap-* test project.

Requires JIAFENG_ENV_FILE pointing to its configuration and healthy services.
Edits a seeded draft, discards disposable manifests, and recreates only that
project's containers. Keeps its volumes and data for inspection; never resets.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import uuid

HERE = Path(__file__).resolve().parents[1]
assert os.environ.get('JIAFENG_ENV_FILE'), 'Specify a dedicated verification environment'
loader = importlib.machinery.SourceFileLoader('probe_deploy', str(HERE / 'dev'))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)
ENV = deploy.read_env(deploy.ENV_FILE)
PROJECT = ENV['COMPOSE_PROJECT_NAME']
assert PROJECT.startswith('jiafeng-demo-bootstrap-'), 'Dedicated bootstrap test projects only'
BASE = 'http://127.0.0.1:' + ENV['JIAFENG_HTTP_PORT'] + '/api/v1'
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
CHECKS = []


def check(name, condition):
    assert condition, name
    CHECKS.append(name)
    print('PASS:', name, flush=True)


def call(method, path, data=None, token=''):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if method == 'POST':
        headers['Idempotency-Key'] = str(uuid.uuid4())
    request = urllib.request.Request(BASE + path, method=method, headers=headers,
        data=None if data is None else json.dumps(data, ensure_ascii=False).encode())
    try:
        with HTTP.open(request, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{method} {path}: HTTP {error.code}') from None


def login(username, client):
    return call('POST', '/auth/login', {'username': username, 'client': client,
        'password': ENV['JIAFENG_DEV_PASSWORD']})['token']


def seed(expected=0):
    result = subprocess.run([str(HERE / 'dev'), 'seed-demo'], capture_output=True,
        text=True, env={**os.environ, 'JIAFENG_ENV_FILE': str(deploy.ENV_FILE)})
    if result.returncode != expected:
        # Seed tools promise sanitized errors, but retain detailed output locally.
        (HERE / '.local' / f'{PROJECT}-probe-failure.txt').write_text(result.stdout + result.stderr)
        raise AssertionError(f'seed-demo exit {result.returncode}, expected {expected}; inspect local probe-failure file')


def snapshot():
    statements = ["SELECT id,kind,owner_id,region_id,status,payload,version FROM jf_entity "
        "WHERE id NOT IN ('demoSeedState','demoCatalogState') ORDER BY id;"]
    for table, key in [('jf_account', 'user_id'), ('jf_revision', 'id'), ('jf_draft', 'user_id'),
                       ('jf_file', 'id'), ('jf_registration', 'id')]:
        statements.append(f'SELECT * FROM {table} ORDER BY {key};')
    return hashlib.sha256(deploy.query('\n'.join(statements)).encode()).hexdigest()


def check_account_guard():
    # Simulate an operator disabling a bootstrap account before any demo content
    # exists. Import must refuse BEFORE adding accounts or changing profiles.
    before = snapshot()
    deploy.query('UPDATE jf_account SET enabled=FALSE,version=version+1 WHERE user_id=10005;')
    changed = snapshot()
    seed(expected=1)
    check('Changed initial account is rejected before any import writes',
        changed == snapshot() and deploy.query("SELECT COUNT(*) FROM jf_entity "
            "WHERE id IN ('demoSeedState','demoCatalogState');") == '0')
    deploy.query('UPDATE jf_account SET enabled=TRUE,version=version-1 WHERE user_id=10005;')
    assert before == snapshot(), 'Account guard test must restore its own isolated initial state'


def main():
    deploy.reset_scope(ENV)  # Ownership checks only; no cleanup.
    empty = deploy.query("SELECT COUNT(*) FROM jf_entity WHERE kind NOT IN ('setting','expert');")
    check('Default Compose startup has no demo business records', empty == '0')
    check('Default startup has six accounts and no files', deploy.query(
        'SELECT COUNT(*) FROM jf_account; SELECT COUNT(*) FROM jf_file;') == '6\n0')
    public = call('GET', '/workspace')
    check('Unseeded public workspace has empty content catalogs',
        all(not public.get(key) for key in ('works', 'news', 'banners', 'mediaItems', 'activities')))
    check_account_guard()

    blocker = 'demo_bootstrap_nonempty_probe'
    deploy.query("INSERT INTO jf_entity(id,kind,region_id,status,payload) "
        f"VALUES('{blocker}','content','all','draft',JSON_OBJECT('title','Import protection probe')); ")
    before = snapshot()
    seed(expected=1)
    check('Unrecognized nonempty data is rejected without changes', before == snapshot())
    deploy.query(f"DELETE FROM jf_entity WHERE id='{blocker}' AND kind='content';")

    seed()
    counts = dict(line.split('\t') for line in deploy.query(
        'SELECT kind,COUNT(*) FROM jf_entity GROUP BY kind ORDER BY kind;').splitlines())
    check('First import includes submissions, review tasks and all catalog branches',
        all(int(counts.get(key, 0)) == count for key, count in {
            'submission': 16, 'task': 51, 'banner': 10, 'media': 7,
            'venue': 4, 'hallPerson': 3, 'supportTicket': 2}.items()))
    check('First import retains thirteen accounts and seventeen immutable revisions',
        deploy.query('SELECT COUNT(*) FROM jf_account; SELECT COUNT(*) FROM jf_revision;') == '13\n17')
    public = call('GET', '/workspace')
    check('Published catalogs appear through real user APIs',
        len(public['banners']) == 7 and len(public['mediaItems']) == 4 and len(public['news']) == 7)

    token = login('member_zj', 'member')
    own = call('GET', '/workspace', token=token)
    attachment = next(work['attachments'][0] for work in own['works']
        if work.get('isMine') and work.get('attachments'))
    signed = call('GET', '/files/' + attachment['fileId'] + '/download', token=token)
    try:
        with HTTP.open(signed['url'], timeout=30) as response:
            downloaded = response.read()
    except Exception:
        raise RuntimeError('Private S3 PDF download failed') from None
    check('Imported Chinese-named PDF downloads with original checksum',
        hashlib.sha256(downloaded).digest() == hashlib.sha256(
            (HERE / 'fixtures/files/投稿附页.pdf').read_bytes()).digest())

    admin = login('devadmin', 'admin')
    workspace = call('GET', '/admin/workspace', token=admin)
    draft = next(item for item in workspace['contents'] if item['status'] == '草稿')
    raw = json.loads(deploy.query("SELECT payload FROM jf_entity WHERE id='" + draft['id'] + "';"))
    raw['title'] += ' · 导入后编辑保留检查'
    call('POST', '/admin/commands', {'command': 'saveContent', 'entityId': draft['id'],
        'version': draft['lockVersion'], 'data': raw}, token=admin)
    edited = snapshot()
    seed()
    check('Completed import is a no-op and preserves later edits', edited == snapshot())

    removed = []
    for path in (HERE / '.local').glob(PROJECT + '*manifest*.json'):
        path.unlink()
        removed.append(path.name)
    check('Per-project manifests can be discarded for this test', len(removed) >= 2)
    seed()
    check('Database receipt prevents reimport after local manifests are lost', edited == snapshot())

    # Simulate loss of the final overall-complete write after catalog completion.
    deploy.query("UPDATE jf_entity SET payload=JSON_SET(payload,'$.phase','base-complete') "
        "WHERE id='demoSeedState' AND kind='setting';")
    seed()
    check('Catalog-stage retry resumes from database receipts without duplicates', edited == snapshot())

    deploy.compose('down', capture_output=True, text=True)
    deploy.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '240',
        capture_output=True, text=True)
    check('Container recreation preserves seeded data and later edits', edited == snapshot())
    seed()
    check('Import stays a no-op after container recreation', edited == snapshot())
    public = call('GET', '/workspace')
    report = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'project': PROJECT,
        'checks': CHECKS, 'passed': True, 'entityCounts': {key: int(value) for key, value in counts.items()},
        'publicCounts': {key: len(public[key]) for key in ('banners', 'mediaItems', 'venues', 'hallPeople', 'news')},
        'preservedBusinessSha256': edited, 'containerRecreation': 'down then up --no-build; no volume deletion',
        'limits': ['Dedicated local Compose test; no production or physical WeChat evidence.']}
    output = HERE.parent / 'docs/verification/previews/demo-bootstrap-2026-09-26/runtime-checks.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('Saved sanitized bootstrap verification report', flush=True)


if __name__ == '__main__':
    main()
