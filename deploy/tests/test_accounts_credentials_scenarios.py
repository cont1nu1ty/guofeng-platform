"""Offline checks for the additive demo scenarios; no deployment configuration is loaded."""
import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'scenarios/accounts_credentials.py'
spec = importlib.util.spec_from_file_location('accounts_credentials_scenarios', MODULE)
scenarios = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scenarios)


class ContextStub:
    def __init__(self):
        self.here = MODULE.parents[1]
        self.env = {'JIAFENG_DEV_PASSWORD': 'Offline-fixture-password-2026'}
        self.admin = SimpleNamespace(name='devadmin', user={'id': '10001'})
        self.accounts, self.certificates, self.resources, self.steps, self.records = {}, {}, {}, {}, {}
        self.logins, self.writes = [], []

    def client(self, name, admin=False):
        self.logins.append((name, admin))
        uid = {'member_zj': '10005', 'member_bj': '10006'}.get(name)
        if uid is None:
            uid = next(uid for uid, a in self.accounts.items() if a['username'] == name)
        return SimpleNamespace(name=name, user={'id': uid})

    def get(self, actor, path):
        if path.startswith('/admin/accounts/'):
            return copy.deepcopy(self.accounts[path.split('/')[3]])
        if path == '/rights/agreement':
            return {'version': 'jiafeng-confirmation-1'}
        if path.endswith('/progress'):
            return {'work': {'version': 4, 'revisionNumber': 1},
                    'revisions': [{'id': 'original-revision', 'revisionNumber': 1}]}
        if path == '/education/me':
            return {'history': [{'courseId': 'original-course', 'publicationVersion': 1, 'completedAt': '2026-10-08'},
                                {'courseId': 'original-course', 'publicationVersion': 2, 'completedAt': None}]}
        if path.startswith('/me/certificates?'):
            items = [copy.deepcopy(c) for c in self.certificates.values() if c['kind'] == 'completion']
            return {'items': items, 'total': len(items)}
        raise AssertionError(path)

    def post(self, actor, key, path, data):
        if key in self.steps:
            return copy.deepcopy(self.steps[key])
        self.writes.append((key, path, copy.deepcopy(data)))
        if path == '/admin/accounts':
            uid = 'account-' + str(len(self.accounts) + 1)
            self.accounts[uid] = {**copy.deepcopy(data), 'id': uid, 'version': 1}
            result = {'id': uid}
        elif path.startswith('/admin/accounts/'):
            uid, action = path.split('/')[3:5]
            account = self.accounts[uid]
            assert data['version'] == account['version']
            if action == 'roles':
                assert account.get('expertReviewStatus') == 'approved'
                account['roles'] = data['roles']
            if action == 'review':
                account[data['subject'] + 'ReviewStatus'] = data['result']
            account['version'] += 1
            result = {'ok': True, 'id': uid}
        elif path.endswith('/copyright-confirmations'):
            result = {'id': 'confirmation-1', 'ok': True}
        elif path == '/admin/certificates':
            cid = 'certificate-' + str(len(self.certificates) + 1)
            if data['kind'] == 'completion':
                assert not any(c['kind'] == 'completion' and c['status'] == 'issued' for c in self.certificates.values())
            self.certificates[cid] = {**data, 'id': cid, 'version': 1, 'status': 'issued'}
            result = {'id': cid, 'certificateNo': 'JF-' + cid}
        elif path.endswith('/revoke'):
            self.certificates[path.split('/')[3]].update(status='revoked', version=2)
            result = {'ok': True}
        elif path == '/admin/resources':
            rid = 'resource-' + str(len(self.resources) + 1)
            self.resources[rid] = {**data, 'id': rid, 'version': 1}
            result = {'id': rid}
        elif path.startswith('/admin/resources/'):
            rid = path.split('/')[3]
            assert data['version'] == self.resources[rid]['version']
            self.resources[rid] = {**data, 'id': rid, 'version': data['version'] + 1}
            result = {'id': rid}
        else:
            raise AssertionError(path)
        self.steps[key] = copy.deepcopy(result)
        return result

    def upload(self, client, key, path, purpose):
        assert purpose == 'manuscript' and path.name == '资料使用指南.pdf'
        return {'fileId': 'original-guide-upload'}

    def ref(self, kind, key):
        return {('submissions', 'shared_ladder'): 'original-work',
                ('courses', 'course_clear_boundaries'): 'original-course'}[(kind, key)]

    def record(self, key, **fields):
        self.records[key] = fields


class AccountsCredentialsScenarioTests(unittest.TestCase):
    def test_real_sequence_and_fictional_records_preserve_existing_qualifications(self):
        ctx = ContextStub()
        scenarios.seed(ctx)
        self.assertEqual(len(ctx.accounts), 6)
        self.assertTrue(all(record.get('fictional') for record in ctx.records.values()))
        self.assertEqual({r['status'] for r in ctx.certificates.values()}, {'issued', 'revoked'})
        self.assertEqual([r['courseVersion'] for r in ctx.certificates.values() if r['kind'] == 'completion'], [1, 1])
        self.assertEqual({r['status'] for r in ctx.resources.values()}, {'draft', 'published', 'withdrawn'})
        self.assertEqual(ctx.records['accounts:resource:guide']['version'], 3)
        self.assertEqual(ctx.records['accounts:resource:guide']['licenceVersion'], 2)
        self.assertNotIn(ctx.env['JIAFENG_DEV_PASSWORD'], repr(ctx.records))
        self.assertTrue(all(key.startswith('accounts:') for key in ctx.steps))
        self.assertIn(('content_zj', True), ctx.logins)
        self.assertIn(('review_zj', True), ctx.logins)
        self.assertIn(('data_zj', True), ctx.logins)
        self.assertIn(('expert_approved', True), ctx.logins)

    def test_completed_checkpoints_do_not_repeat_mutations_or_duplicate_certificates(self):
        ctx = ContextStub()
        scenarios.seed(ctx)
        first_writes = copy.deepcopy(ctx.writes)
        ctx.resources['resource-1']['description'] = '运营人员后来编辑的说明'
        scenarios.seed(ctx)
        self.assertEqual(ctx.writes, first_writes)
        self.assertEqual(len(ctx.certificates), 3)
        self.assertEqual(ctx.resources['resource-1']['description'], '运营人员后来编辑的说明')


if __name__ == '__main__':
    unittest.main()
