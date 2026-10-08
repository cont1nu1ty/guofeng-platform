#!/usr/bin/env python3
"""Check installed fictional credentials without creating or editing domain records.

Only SELECT SQL and GET APIs are used, except session login and the existing
resource-download POST. Authorized certificate/resource downloads deliberately
create normal download audit records; these are automated verification activity,
not evidence of a human user's download. Secrets and signed URLs stay in memory.
No seed module, Context, or older business probe is imported.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_CERTIFICATE_FIELDS = {
    'certificateNo', 'title', 'issuer', 'status', 'issuedAt', 'revokedAt', 'fileHash',
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def literal(value):
    return "CONVERT(X'" + str(value).encode().hex() + "' USING utf8mb4)"


class Session:
    def __init__(self, check, name=None, admin=False):
        self.check, self.name, self.token, self.user = check, name, '', {}
        if name:
            data = self.request('POST', '/auth/login', {
                'username': name, 'password': check.env['JIAFENG_DEV_PASSWORD'],
                'client': 'admin' if admin else 'member',
            }, label='login ' + name)
            self.token, self.user = data['token'], data['user']

    def request(self, method, path, data=None, *, expected=200, label='API check'):
        allowed_post = path == '/auth/login' or re.fullmatch(r'/resources/[^/]+/download', path)
        require(method == 'GET' or (method == 'POST' and allowed_post), 'Write endpoint is not permitted')
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        request = urllib.request.Request(self.check.base + path, method=method, headers=headers,
            data=None if data is None else json.dumps(data, ensure_ascii=False).encode())
        try:
            with self.check.http.open(request, timeout=45) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        except (urllib.error.URLError, TimeoutError, OSError):
            raise AssertionError(label + ': connection failed (URL and credentials withheld)') from None
        require(status == expected, f'{label}: expected HTTP {expected}, received {status}')
        try:
            return json.loads(raw)
        except (ValueError, UnicodeError):
            raise AssertionError(label + ': expected JSON response') from None

    def get(self, path, **kwargs):
        return self.request('GET', path, **kwargs)

    def pages(self, path):
        result, page = [], 1
        while True:
            data = self.get(f'{path}?page={page}&pageSize=100', label='paginated listing')
            result.extend(data['items'])
            if len(result) >= int(data['total']):
                return result
            require(data['items'] and page < 100, 'Pagination did not terminate')
            page += 1


class Check:
    def __init__(self, env_path):
        self.env_path = Path(env_path).resolve()
        self.env = {}
        for line in self.env_path.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                self.env[key.strip()] = value.strip().strip('"').strip("'")
        self.base = 'http://127.0.0.1:' + self.env['JIAFENG_HTTP_PORT'] + '/api/v1'
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self.results, self.downloads = [], []
        self.report = {
            'project': self.env['COMPOSE_PROJECT_NAME'], 'baseUrl': self.base,
            'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'scope': 'Existing fictional demo accounts and credential/resource records only',
            'activityBoundary': 'Session login plus automated authorized downloads create normal session/audit activity; no domain records are created or edited.',
            'checks': self.results, 'automatedDownloads': self.downloads,
        }

    def sql(self, query):
        require(query.lstrip().upper().startswith('SELECT ') and ';' not in query.rstrip(';'),
                'Only one SELECT statement is permitted')
        environment = {k: v for k, v in os.environ.items() if not k.startswith('COMPOSE_')}
        environment.update(self.env)
        command = ['docker', 'compose', '--env-file', str(self.env_path), '-f', str(ROOT / 'deploy/compose.yaml'),
                   '-p', self.env['COMPOSE_PROJECT_NAME'], 'exec', '-T', 'mysql', 'sh', '-c',
                   'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 --batch --raw --skip-column-names -u root jiafeng']
        result = subprocess.run(command, input='START TRANSACTION READ ONLY;\n' + query.rstrip(';') + ';\nROLLBACK;\n',
                                text=True, encoding='utf-8', capture_output=True, env=environment, timeout=45)
        require(result.returncode == 0, 'Read-only database query failed; database details withheld')
        return result.stdout.strip()

    def passed(self, label, condition=True):
        require(condition, label)
        self.results.append(label)
        print('PASS', label, flush=True)

    def download(self, response, expected_hash, label):
        url = response.get('url', '')
        parsed = urllib.parse.urlsplit(url)
        expected = urllib.parse.urlsplit(self.env['JIAFENG_S3_PUBLIC_ENDPOINT'])
        require(parsed.scheme in ('http', 'https') and parsed.netloc == expected.netloc,
                label + ': download host must match the configured object store')
        try:
            with self.http.open(url, timeout=45) as stream:
                require(stream.status == 200, label + ': object download failed')
                body = stream.read(20 * 1024 * 1024 + 1)
        except (urllib.error.URLError, TimeoutError, OSError):
            raise AssertionError(label + ': object download failed (signed URL withheld)') from None
        require(len(body) <= 20 * 1024 * 1024 and body.startswith(b'%PDF-'), label + ': expected bounded PDF')
        digest = hashlib.sha256(body).hexdigest()
        self.passed(label, digest == expected_hash)
        self.downloads.append({'label': label, 'bytes': len(body), 'sha256': digest,
                               'activity': 'automated verification, not a manual user download'})

    def records(self):
        raw = self.sql("SELECT payload FROM jf_entity WHERE id='demoNonAiState' AND kind='setting'")
        require(bool(raw), 'Non-AI demo receipt is not installed')
        state = json.loads(raw)
        require(state['project'] == self.env['COMPOSE_PROJECT_NAME'], 'Receipt project mismatch')
        require(state['modules'].get('accounts_credentials') == 'complete', 'Wait for the accounts_credentials import module to complete')
        self.records = {key: value for key, value in state['records'].items() if key.startswith('accounts:')}
        expected = {'accounts:role:' + role for role in ('content_operator', 'review_manager', 'data_operator')}
        expected |= {'accounts:qualification:' + status for status in ('pending', 'approved', 'rejected')}
        expected |= {'accounts:certificate:' + kind for kind in ('award', 'completion-revoked', 'completion-replacement')}
        expected |= {'accounts:resource:' + kind for kind in ('guide', 'regional', 'draft', 'withdrawn')}
        expected.add('accounts:rights:shared_ladder')
        self.passed('Database receipt locates all 14 fictional account/credential/resource scenarios',
                    expected.issubset(self.records) and all(self.records[key].get('fictional') for key in expected))
        self.report['receiptPhase'] = state['phase']
        self.report['receiptScenarioCount'] = len(self.records)

    def business_snapshot(self):
        # No passwords, tokens, signed URLs, or private material text are returned.
        statements = []
        for prefix, table, id_column, fields in (
            ('accounts:role:', 'jf_account', 'user_id', "version,enabled,roles,region_ids"),
            ('accounts:qualification:', 'jf_account', 'user_id', "version,enabled,roles,region_ids"),
            ('accounts:certificate:', 'jf_certificate', 'id', "version,status,file_hash,active_source_key"),
            ('accounts:resource:', 'jf_resource', 'id', "version,status,file_id,license_text,audience,region_id"),
        ):
            ids = [literal(r['id']) for key, r in self.records.items() if key.startswith(prefix)]
            statements.append(f"SELECT CONCAT({id_column},':',SHA2(CONCAT_WS('|',{fields}),256)) AS fingerprint FROM {table} WHERE {id_column} IN ({','.join(ids)})")
        return self.sql('SELECT fingerprint FROM (' + ' UNION ALL '.join(statements) + ') snapshots ORDER BY fingerprint')

    def audit_count(self):
        ids = [literal(row['id']) for key, row in self.records.items()
               if key.startswith(('accounts:certificate:', 'accounts:resource:'))]
        return int(self.sql("SELECT COUNT(*) FROM jf_audit WHERE action IN ('certificate.download','resource.download') AND target_id IN (" + ','.join(ids) + ')'))

    def accounts(self, admin):
        matrix = {
            'content_operator': (['/admin/resources', '/admin/records/contents', '/admin/records/notificationDrafts'],
                                 ['/admin/accounts', '/admin/certificates', '/admin/records/submissions', '/admin/records/activityLog']),
            'review_manager': (['/admin/certificates', '/admin/records/submissions'],
                               ['/admin/accounts', '/admin/resources', '/admin/records/contents', '/admin/records/activityLog']),
            'data_operator': (['/admin/records/submissions', '/admin/records/activityLog'],
                              ['/admin/accounts', '/admin/resources', '/admin/certificates', '/admin/records/notificationDrafts']),
        }
        for role, (allowed, denied) in matrix.items():
            record = self.records['accounts:role:' + role]
            session = Session(self, record['username'], True)
            account = admin.get('/admin/accounts/' + record['id'])
            self.passed(role + ' has its explicit role, Zhejiang scope and approved manual dossier',
                        account['roles'] == [role] and account['regionIds'] == ['zhejiang']
                        and account['accountReviewStatus'] == 'approved' and account['enabled'])
            for endpoint in allowed:
                session.get(endpoint, label=role + ' allowed module')
            for endpoint in denied:
                session.get(endpoint, expected=403, label=role + ' denied module')
            self.passed(role + ' allowed modules work and unrelated modules return 403')
        for status in ('pending', 'approved', 'rejected'):
            record = self.records['accounts:qualification:' + status]
            detail = admin.get('/admin/accounts/' + record['id'])
            expected_role = 'expert' if status == 'approved' else 'member'
            session = Session(self, record['username'], status == 'approved')
            actions = [r['action'] for r in detail['reviews'] if r['subject'] == 'expert']
            required_actions = ['submitted'] if status == 'pending' else ['submitted', status]
            self.passed('Manual expert dossier ' + status + ' retains evidence history and correct role',
                        detail['expertReviewStatus'] == status and detail['roles'] == [expected_role]
                        and sorted(actions) == sorted(required_actions) and session.user['roles'] == [expected_role])

    def certificates(self, admin, zj, bj, anonymous):
        owners = {'member_zj': zj, 'member_bj': bj}
        listings = {name: {row['id']: row for row in owner.pages('/me/certificates')}
                    for name, owner in owners.items()}
        administration = {row['id']: row for row in admin.pages('/admin/certificates')}
        for kind in ('award', 'completion-revoked', 'completion-replacement'):
            record = self.records['accounts:certificate:' + kind]
            owner = owners[record['username']]
            other_name = 'member_bj' if record['username'] == 'member_zj' else 'member_zj'
            row = listings[record['username']].get(record['id'])
            self.passed(kind + ' appears only for its owner with the recorded state',
                        row and row['status'] == record['status'] and record['id'] not in listings[other_name]
                        and administration[record['id']]['status'] == record['status'])
            verified = anonymous.get('/certificates/verify/' + row['verifyToken'], label=kind + ' anonymous verification')
            self.passed(kind + ' anonymous verification reports state without holder or source identity',
                        set(verified) == PUBLIC_CERTIFICATE_FIELDS and verified['status'] == record['status']
                        and verified['certificateNo'] == record['certificateNo'] and verified['fileHash'] == row['fileHash'])
            path = '/certificates/' + record['id'] + '/download'
            owners[other_name].get(path, expected=404, label=kind + ' cross-owner download')
            anonymous.get(path, expected=401, label=kind + ' anonymous download')
            if record['status'] == 'revoked':
                owner.get(path, expected=410, label='revoked owner download')
                self.passed('Revoked certificate stops new authorized download links')
            else:
                self.download(owner.get(path, label=kind + ' authorized download'), row['fileHash'], kind + ' owner PDF matches issuance SHA-256')
        confirmation = self.records['accounts:rights:shared_ladder']
        mine = bj.get('/me/copyright-confirmations')
        other = zj.get('/me/copyright-confirmations')
        evidence = next((r for r in mine['items'] if r['id'] == confirmation['id']), None)
        self.passed('Original author sees attributable full-text ordinary confirmation; other owner cannot see it',
                    evidence and evidence['submissionId'] == confirmation['submissionId'] and evidence['agreementText']
                    and not mine['agreement']['signature'] and confirmation['id'] not in {r['id'] for r in other['items']})

    def resources(self, admin, zj, bj, anonymous):
        rows = {row['id']: row for row in admin.pages('/admin/resources')}
        visible = {name: {row['id'] for row in session.pages('/resources')}
                   for name, session in (('zhejiang', zj), ('beijing', bj), ('anonymous', anonymous))}
        for kind in ('guide', 'regional', 'draft', 'withdrawn'):
            record = self.records['accounts:resource:' + kind]
            row = rows[record['id']]
            self.passed(kind + ' resource retains receipt state, scope and locked version',
                        row['status'] == record['status'] and row['version'] == record['version']
                        and row['audience'] == record['audience'] and row['regionId'] == record['regionId'])
            expected_visibility = {'guide': {'zhejiang', 'beijing', 'anonymous'}, 'regional': {'zhejiang'},
                                   'draft': set(), 'withdrawn': set()}[kind]
            self.passed(kind + ' resource visibility follows publication and regional authorization',
                        {name for name, ids in visible.items() if record['id'] in ids} == expected_visibility)
            path = '/resources/' + record['id'] + '/download'
            payload = {'version': row['version'], 'acceptedLicense': True}
            if kind in ('draft', 'withdrawn'):
                for name, session in (('owner-scope', zj), ('other-region', bj), ('administrator', admin)):
                    session.request('POST', path, payload, expected=404, label=kind + ' ' + name + ' download')
                self.passed(kind + ' resource download returns 404 even for an administrator')
                continue
            anonymous.request('POST', path, payload, expected=401, label=kind + ' anonymous download')
            if kind == 'regional':
                bj.request('POST', path, payload, expected=404, label='cross-region resource download')
                self.passed('Regional resource denies unauthorized Beijing download')
            if kind == 'guide':
                require(row['version'] == 3 and '许可第2版' in row['licenseText'], 'Updated resource licence is missing')
                zj.request('POST', path, {**payload, 'version': 2}, expected=412, label='stale resource licence')
                zj.request('POST', path, {**payload, 'acceptedLicense': False}, expected=422, label='unaccepted resource licence')
                self.passed('Current licence v2 is displayed; stale resource version and unaccepted licence are rejected')
            response = zj.request('POST', path, payload, label=kind + ' authorized download')
            self.download(response, row['sha256'], kind + ' authorized resource PDF matches catalog SHA-256')

    def run(self):
        self.records()
        before = self.business_snapshot()
        before_audit = self.audit_count()
        admin, zj, bj, anonymous = Session(self, 'devadmin', True), Session(self, 'member_zj'), Session(self, 'member_bj'), Session(self)
        self.accounts(admin)
        self.certificates(admin, zj, bj, anonymous)
        self.resources(admin, zj, bj, anonymous)
        self.passed('Checks preserve account authorizations and certificate/resource business states', before == self.business_snapshot())
        audit_delta = self.audit_count() - before_audit
        self.passed('Four automated successful downloads create four normal download audit records', audit_delta == 4)
        self.report.update(status='passed', completedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
                           checkCount=len(self.results), automatedDownloadAuditDelta=audit_delta)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', required=True, type=Path, help='Explicit installed demo environment file; never printed')
    parser.add_argument('--output', type=Path, help='Optional safe JSON evidence report, excluding tokens and signed URLs')
    args = parser.parse_args()
    check = Check(args.env)
    try:
        check.run()
    except (AssertionError, KeyError, ValueError, OSError, subprocess.SubprocessError) as error:
        # Only our static assertion text is safe to expose; exception details can contain URLs.
        reason = str(error) if isinstance(error, AssertionError) else type(error).__name__ + ' (details withheld)'
        check.report.update(status='failed', failure=reason, checkCount=len(check.results))
        print('FAIL', reason, file=sys.stderr)
        code = 1
    else:
        print(f'PASS {len(check.results)} checks; domain records unchanged; 4 automated download audits', flush=True)
        code = 0
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(check.report, ensure_ascii=False, indent=2) + '\n')
        args.output.chmod(0o600)
    return code


if __name__ == '__main__':
    raise SystemExit(main())
