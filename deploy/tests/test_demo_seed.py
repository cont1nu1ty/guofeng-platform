"""Import lifecycle regressions without Docker, network, or local data writes."""
import contextlib
import importlib.machinery
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

DEPLOY = Path(__file__).resolve().parents[1]


def load(name, path):
    loader = importlib.machinery.SourceFileLoader(name, str(path))
    spec = importlib.util.spec_from_loader(name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


deploy = load('demo_deploy_test', DEPLOY / 'dev')
state = deploy.demo_state_module()


class DemoSeedTest(unittest.TestCase):
    values = {'COMPOSE_PROJECT_NAME': 'jiafeng-demo-test', 'JIAFENG_DEV_ACCOUNTS_ENABLED': 'true'}

    def receipt(self, phase, **fields):
        return {'project': self.values['COMPOSE_PROJECT_NAME'], 'fingerprint': 'fixture-hash',
                'phase': phase, **fields}

    @contextlib.contextmanager
    def lifecycle(self, receipt):
        query = Mock(return_value=json.dumps(receipt) if receipt else '')
        with patch.object(deploy, 'reset_scope'), \
                patch.object(deploy, 'seed_demo_records'), \
                patch.object(deploy, 'demo_state_module', return_value=state), \
                patch.object(state, 'fingerprint', return_value='fixture-hash'), \
                patch.object(deploy, 'query', query), \
                patch.object(deploy, 'run') as run, contextlib.redirect_stdout(io.StringIO()):
            yield query, run

    def test_up_never_requests_demo_data(self):
        with patch.object(deploy.sys, 'argv', ['dev', 'up']), \
                patch.object(deploy, 'initialize', return_value={**self.values, 'JIAFENG_HTTP_PORT': '18080'}), \
                patch.object(deploy, 'compose') as compose, patch.object(deploy, 'seed_demo') as seed, \
                patch.object(deploy, 'wait_search') as wait_search, \
                patch.object(deploy, 'run') as run, contextlib.redirect_stdout(io.StringIO()):
            deploy.main()
            compose.assert_called_once()
            seed.assert_not_called()
            run.assert_not_called()

    def test_completed_install_is_read_only_even_after_user_edits(self):
        # A successful receipt is durable: do not reapply desired business states.
        with self.lifecycle(self.receipt('complete', userContentMayHaveChanged=True)) as (query, run):
            deploy.seed_demo(self.values, already_locked=True)
            run.assert_not_called()
            self.assertTrue(all(call.args[0].startswith('SELECT ') for call in query.call_args_list))

    def test_changed_dataset_refuses_overwrite(self):
        with self.lifecycle(self.receipt('complete', fingerprint='older-fixture')) as (_, run):
            with self.assertRaisesRegex(ValueError, 'dataset differs'):
                deploy.seed_demo(self.values, already_locked=True)
            run.assert_not_called()

    def test_foreign_database_receipt_refuses_import(self):
        with self.lifecycle(self.receipt('complete', project='jiafeng-demo-other')) as (_, run):
            with self.assertRaisesRegex(ValueError, 'another project'):
                deploy.seed_demo(self.values, already_locked=True)
            run.assert_not_called()

    def test_interrupted_base_never_retries_or_cleans_data(self):
        with self.lifecycle(self.receipt('base-running')) as (query, run):
            with self.assertRaisesRegex(ValueError, 'reset-demo'):
                deploy.seed_demo(self.values, already_locked=True)
            run.assert_not_called()
            self.assertEqual(query.call_count, 1)

    def test_partial_catalog_resumes_without_replaying_base(self):
        base = self.receipt('base-complete', baseManifest={'refs': {}})
        catalog = self.receipt('complete', manifest={'refs': {}})
        with self.lifecycle(base) as (query, run):
            query.side_effect = [json.dumps(base), json.dumps(base), json.dumps(catalog), '1']
            deploy.seed_demo(self.values, already_locked=True)
            self.assertEqual(run.call_count, 1)
            self.assertEqual(Path(run.call_args.args[0][-1]).name, 'seed-catalog.py')

    def test_fresh_import_runs_base_before_catalog(self):
        base = self.receipt('base-complete', baseManifest={'refs': {}})
        with self.lifecycle(None) as (query, run):
            query.side_effect = ['', json.dumps(base), json.dumps(self.receipt('complete')), '1']
            deploy.seed_demo(self.values, already_locked=True)
            self.assertEqual([Path(call.args[0][-1]).name for call in run.call_args_list],
                             ['seed-showcase.py', 'seed-catalog.py'])

    def test_catalog_failure_does_not_mark_import_complete(self):
        base = self.receipt('base-complete', baseManifest={'refs': {}})
        with self.lifecycle(base) as (query, run):
            run.side_effect = RuntimeError('catalog interrupted')
            with self.assertRaisesRegex(RuntimeError, 'interrupted'):
                deploy.seed_demo(self.values, already_locked=True)
            self.assertTrue(all(call.args[0].startswith('SELECT ') for call in query.call_args_list))

    def test_legacy_manifest_only_provides_matching_project_references(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'legacy.json'
            path.write_text(json.dumps({'project': 'jiafeng-demo-other', 'phase': 'complete', 'refs': {'secret': 1}}))
            self.assertEqual(state.local_reference(path, self.values['COMPOSE_PROJECT_NAME']), {})
            path.write_text(json.dumps({'project': self.values['COMPOSE_PROJECT_NAME'],
                                        'phase': 'complete', 'refs': {'activities': {'id': 'a'}}}))
            self.assertEqual(state.local_reference(path, self.values['COMPOSE_PROJECT_NAME']),
                             {'activities': {'id': 'a'}})

    def test_missing_receipt_during_checkpoint_is_not_success(self):
        receipt = state.Receipt(Mock(return_value='0'), self.values['COMPOSE_PROJECT_NAME'], 'fixture-hash')
        with self.assertRaisesRegex(ValueError, 'disappeared'):
            receipt.save(self.receipt('complete'))


class ScriptBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.env = Path(self.directory.name) / 'demo.env'
        self.env.write_text('COMPOSE_PROJECT_NAME=jiafeng-demo-test\nJIAFENG_HTTP_PORT=19080\n'
                            'JIAFENG_DEV_PASSWORD=test-only-unused-password\nJIAFENG_DEV_ACCOUNTS_ENABLED=true\n')

    def script(self, name):
        with patch.dict(os.environ, {'JIAFENG_ENV_FILE': str(self.env)}):
            return load(name.replace('-', '_') + '_test', DEPLOY / (name + '.py'))

    def test_base_rejects_existing_cloud_draft_without_writes(self):
        base = self.script('seed-showcase')
        # No receipt, no entities, but one real draft: count-only entity checks
        # must not let installation overwrite that member's cloud draft.
        with patch.object(base, 'sql', side_effect=['', '0', '1']) as sql, \
                patch.object(base, 'bootstrap_accounts') as bootstrap, patch.object(base, 'HTTP') as http:
            with self.assertRaisesRegex(ValueError, 'Business data already exists'):
                base.main()
            bootstrap.assert_not_called()
            http.open.assert_not_called()
            self.assertTrue(all(call.args[0].startswith('SELECT ') for call in sql.call_args_list))

    def test_changed_account_cannot_start_import_or_write_receipt(self):
        base = self.script('seed-showcase')
        defaults = [{'id': uid, 'version': 1, 'enabled': 1, 'realm': realm,
                     'regions': [region], 'roles': [role]}
                    for uid, _, _, realm, region, role, *_ in base.ACCOUNTS if uid < 11000]
        for field, value in [('version', 2), ('enabled', 0), ('realm', 'member'),
                             ('regions', ['beijing']), ('roles', ['expert'])]:
            with self.subTest(changed_field=field):
                accounts = [dict(row) for row in defaults]
                accounts[0][field] = value
                raw = '\n'.join(json.dumps(row) for row in accounts)
                with patch.object(base, 'sql', side_effect=['', '0', '0', raw]) as sql, \
                        patch.object(base, 'bootstrap_accounts') as bootstrap, \
                        patch.object(base, 'HTTP') as http, patch.object(base, 'Client') as client:
                    with self.assertRaisesRegex(ValueError, 'accounts were changed'):
                        base.main()
                    bootstrap.assert_not_called()
                    client.assert_not_called()
                    http.open.assert_not_called()
                    self.assertTrue(all(call.args[0].startswith('SELECT ') for call in sql.call_args_list))

    def test_catalog_completion_survives_missing_local_manifest(self):
        catalog = self.script('seed-catalog')
        digest = catalog.base.state_module.fingerprint(DEPLOY)
        receipt = {'project': 'jiafeng-demo-test', 'fingerprint': digest, 'phase': 'complete'}
        with patch.object(catalog.base, 'sql', return_value=json.dumps(receipt)), \
                patch.object(catalog, 'STATE', Path(self.directory.name) / 'does-not-exist.json'), \
                patch.object(catalog, 'Client') as client, contextlib.redirect_stdout(io.StringIO()):
            catalog.main()
            client.assert_not_called()

    def test_unmarked_legacy_catalog_is_preserved(self):
        catalog = self.script('seed-catalog')
        admin = Mock()
        admin.workspace.return_value = {'banners': [{'id': 'user-edited-banner'}]}
        with patch.object(catalog.base, 'sql', return_value='') as sql, \
                patch.object(catalog, 'Client', return_value=admin), \
                patch.object(catalog.base.state_module, 'local_reference', return_value={}):
            with self.assertRaisesRegex(ValueError, 'reviewed receipt migration'):
                catalog.main()
            admin.command.assert_not_called()
            admin.upload.assert_not_called()
            self.assertTrue(all(call.args[0].startswith('SELECT ') for call in sql.call_args_list))

    def test_catalog_recovers_uploaded_file_from_database_without_local_manifest(self):
        catalog = self.script('seed-catalog')
        digest = catalog.base.state_module.fingerprint(DEPLOY)
        refs = {
            'mediaItems': {'member_pending': {'id': 'pending', 'complete': True},
                           'member_returned': {'id': 'returned', 'complete': True}},
            'supportTickets': {'support_open': {'id': 'open', 'complete': True},
                               'support_answered': {'id': 'answered', 'complete': True}}}
        installed = {'project': 'jiafeng-demo-test', 'fingerprint': digest, 'phase': 'catalog-running',
                     'manifest': {'refs': refs, 'files': {
                         'devadmin:everyday-values.mp4': {'ownerId': '10001', 'sha256': 'saved-checksum',
                                                        'name': 'everyday-values.mp4', 'startedAtMillis': 1}}}}
        base_receipt = {**installed, 'phase': 'base-complete', 'baseManifest': {'refs': {}}}
        reads = iter([installed, base_receipt])
        uploaded = {'fileId': 'same-uploaded-file', 'name': 'everyday-values.mp4', 'type': 'video'}
        statements = []
        def query(sql):
            statements.append(sql)
            if sql.startswith('SELECT payload'):
                return json.dumps(next(reads))
            if sql.startswith('SELECT JSON_OBJECT'):
                return json.dumps(uploaded)
            return '1'
        workspace = {'banners': [], 'contents': [], 'venues': [], 'hallPeople': [],
                     'mediaItems': [{'id': 'pending'}, {'id': 'returned'}],
                     'supportTickets': [{'id': 'open'}, {'id': 'answered'}]}
        admin = Mock(name='admin')
        admin.name, admin.user = 'devadmin', {'id': '10001'}
        admin.workspace.return_value = workspace
        def save(command, **kwargs):
            self.assertEqual(command, 'saveMedia')
            self.assertEqual(kwargs['data']['sourceFileId'], 'same-uploaded-file')
            row = {'id': 'new-media', 'status': '草稿', 'lockVersion': 1}
            workspace['mediaItems'].append(row)
            return {'result': row}
        admin.command.side_effect = save
        member = Mock()
        fixture = Path(self.directory.name) / 'catalog.json'
        fixture.write_text(json.dumps({'datasetVersion': 'test', 'contents': [], 'venues': [],
            'hallPeople': [], 'banners': [], 'mediaItems': [{'key': 'resume_file',
            'source': 'everyday-values.mp4', 'data': {'title': 'Recovered file'}, 'status': '草稿'}]}))
        with patch.object(catalog.base, 'sql', side_effect=query), \
                patch.object(catalog, 'Client', side_effect=[admin, member]), \
                patch.object(catalog, 'FIXTURE', fixture), \
                patch.object(catalog, 'STATE', Path(self.directory.name) / 'new-local-manifest.json'), \
                contextlib.redirect_stdout(io.StringIO()):
            catalog.main()
        admin.upload.assert_not_called()
        member.command.assert_not_called()
        self.assertEqual(admin.command.call_count, 1)
        recovery = next(sql for sql in statements if sql.startswith('SELECT JSON_OBJECT'))
        self.assertIn('owner_id=10001', recovery)
        self.assertIn('UNIX_TIMESTAMP(created_at)*1000>=1', recovery)
        final = json.loads((Path(self.directory.name) / 'new-local-manifest.json').read_text())
        self.assertEqual(final['files']['devadmin:everyday-values.mp4']['fileId'], 'same-uploaded-file')
        self.assertTrue(final['refs']['mediaItems']['resume_file']['complete'])


if __name__ == '__main__':
    unittest.main()
