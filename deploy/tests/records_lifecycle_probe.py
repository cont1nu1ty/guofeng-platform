#!/usr/bin/env python3
"""Verify additive seed, restart and isolated backup restore after other probes finish."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
assert os.environ.get('JIAFENG_ENV_FILE'), 'Select an isolated test environment'
spec = importlib.util.spec_from_file_location('records_lifecycle_base', ROOT / 'deploy/seed-showcase.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
assert base.ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-'), 'Never run against the active user environment'
deploy = base.deploy
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TABLES = ['jf_account', 'jf_entity', 'jf_file', 'jf_revision', 'jf_revision_file', 'jf_draft', 'jf_registration', 'jf_schema_version']


def fingerprint(env_file):
    result = {}
    def query(sql):
        return deploy.compose('exec', '-T', 'mysql', 'sh', '-c',
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 -u root -N -B jiafeng',
            env_file=env_file, input=sql, text=True, capture_output=True).stdout
    for table in TABLES:
        columns = [line.split('\t')[0] for line in query('SHOW COLUMNS FROM ' + table).splitlines()]
        expression = ','.join('`' + column + '`' for column in columns)
        rows = query(f'SELECT JSON_ARRAY({expression}) FROM {table}').splitlines()
        result[table] = {'rows': len(rows), 'sha256': hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest()}
    return result


def request(values, path, token='', body=None):
    url = 'http://127.0.0.1:' + values['JIAFENG_HTTP_PORT'] + '/api/v1' + path
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, headers=headers, data=None if body is None else json.dumps(body).encode())
    with HTTP.open(req, timeout=60) as response:
        return json.load(response)


def personal(values):
    result = {}
    for username in ['member_zj', 'member_bj']:
        token = request(values, '/auth/login', body={'username': username,
            'password': values['JIAFENG_DEV_PASSWORD'], 'client': 'member'})['token']
        workspace = request(values, '/workspace', token)
        records = workspace['recitations']
        assert records, 'Seed/private API checks must precede lifecycle validation'
        file_id = records[0]['fileId']
        signed = request(values, '/files/' + file_id + '/download', token)
        with HTTP.open(signed['url'], timeout=30) as response:
            digest = hashlib.sha256(response.read()).hexdigest()
        result[username] = {'fileId': file_id, 'sha256': digest,
            'recitations': records, 'familyPromises': workspace['familyPromises']}
    return result


def run(*args, **kwargs):
    subprocess.run([str(ROOT / 'deploy/dev'), *args], check=True, **kwargs)


def main():
    report = {'sourceProject': base.ENV['COMPOSE_PROJECT_NAME'], 'passed': False}
    output = ROOT / 'docs/verification/previews/records-search-2026-09-27/lifecycle.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    restored_env = None
    try:
        before = fingerprint(deploy.ENV_FILE)
        run('seed-demo')
        run('seed-demo-records')
        assert fingerprint(deploy.ENV_FILE) == before, 'Repeated import changed business records'
        report['repeatedImportPreservesEditsAndDeletions'] = True
        original = personal(base.ENV)
        run('down')
        run('up')
        assert fingerprint(deploy.ENV_FILE) == before
        assert personal(base.ENV) == original
        report['recreatedContainersPreserveDatabaseAndPrivateAudio'] = True
        backups = set((ROOT / 'deploy/backups').glob('*'))
        run('backup')
        added = set((ROOT / 'deploy/backups').glob('*')) - backups
        assert len(added) == 1
        backup = added.pop()
        envs = set((ROOT / 'deploy/.local').glob('jiafeng-restore-*.env'))
        run('restore', str(backup), env={**os.environ, 'JIAFENG_RESTORE_HTTP_PORT': '19083', 'JIAFENG_RESTORE_S3_PORT': '19336'})
        added = set((ROOT / 'deploy/.local').glob('jiafeng-restore-*.env')) - envs
        assert len(added) == 1
        restored_env = added.pop()
        restored = deploy.read_env(restored_env)
        assert fingerprint(restored_env) == before, 'Restored business data differs'
        assert personal(restored) == original, 'Restored records or audio bytes differ'
        search_before = request(base.ENV, '/search?pageSize=50')
        search_restored = request(restored, '/search?pageSize=50')
        assert search_before['items'] == search_restored['items']
        assert search_before['counts'] == search_restored['counts']
        report.update(passed=True, businessTables=before,
            sourceRecordAndAudioChecksums={u: {'fileId': x['fileId'], 'sha256': x['sha256']} for u, x in original.items()},
            restoredProject=restored['COMPOSE_PROJECT_NAME'],
            restoredToNewVolumes=True, restoredSearchRebuilt=True,
            restoredSearchCounts=search_restored['counts'], backupManifestChecksumsVerified=True)
    finally:
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        if restored_env:
            run('down', env={**os.environ, 'JIAFENG_ENV_FILE': str(restored_env)})
    print('Lifecycle verification passed:', output)


if __name__ == '__main__':
    main()
