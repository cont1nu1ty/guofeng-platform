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
        with patch.object(deploy, 'require_demo_package'), \
                patch.object(deploy, 'demo_scope'), \
                patch.object(deploy, 'seed_demo_records'), \
                patch.object(deploy, 'demo_state_module', return_value=state), \
                patch.object(state, 'fingerprint', return_value='fixture-hash'), \
                patch.object(deploy, 'query', query), \
                patch.object(deploy, 'run') as run, contextlib.redirect_stdout(io.StringIO()):
            yield query, run

    def test_reset_still_refuses_unreviewed_schema(self):
        with patch.object(deploy, 'demo_scope', return_value={'storage': 'test'}), \
                patch.object(deploy, 'query', return_value='jf_account\njf_new_business_table'):
            with self.assertRaisesRegex(ValueError, 'Business schema changed'):
                deploy.reset_scope(self.values)

    def test_query_preserves_json_escaping_in_mysql_raw_output(self):
        payload = json.dumps({'text': '第一行\n"带引号"与\\路径'})
        with patch.object(deploy, 'compose', return_value=Mock(stdout=payload + '\n')) as compose:
            self.assertEqual(json.loads(deploy.query('SELECT payload FROM jf_entity;')), json.loads(payload))
            self.assertIn('--raw', compose.call_args.args[-1].split())

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


class DataPackageBoundaryTest(unittest.TestCase):
    base_files = (
        'seed-showcase.py', 'seed-catalog.py', 'seed-demo-records.py',
        'fixtures/showcase_content.json', 'fixtures/catalog_content.json',
        'fixtures/records_content.json', 'fixtures/files/投稿附页.pdf',
        'fixtures/files/资料使用指南.pdf', 'fixtures/files/匿名评审工作说明.pdf',
    )
    extension_files = (
        'seed-non-ai.py', 'scenarios/common.py', 'scenarios/review_regions.py',
        'scenarios/education_media.py', 'scenarios/accounts_credentials.py',
        'scenarios/operations.py', 'fixtures/non_ai/dataset.json',
        'fixtures/non_ai/education-media-sources.md', 'fixtures/non_ai/generate_panorama.py',
        'fixtures/non_ai/shouyue-study-panorama.png',
    )

    def package(self, directory, names):
        for name in names:
            path = Path(directory) / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('test placeholder; never executed')

    def test_missing_package_stops_commands_before_configuration_or_docker(self):
        for command in ('seed-demo', 'seed-demo-records', 'seed-catalog', 'seed-non-ai', 'reset-demo'):
            with self.subTest(command=command), tempfile.TemporaryDirectory() as directory, \
                    patch.object(deploy, 'HERE', Path(directory)), \
                    patch.object(deploy.sys, 'argv', ['dev', command]), \
                    patch.object(deploy, 'initialize') as initialize, \
                    patch.object(deploy, 'compose') as compose, \
                    patch.object(deploy, 'backup') as backup, patch.object(deploy, 'query') as query:
                with self.assertRaisesRegex(ValueError, 'codex/demo-data-bootstrap'):
                    deploy.main()
                initialize.assert_not_called()
                compose.assert_not_called()
                backup.assert_not_called()
                query.assert_not_called()
                self.assertEqual(list(Path(directory).iterdir()), [])

    def test_scripts_without_payload_cannot_reach_reset_backup(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(deploy, 'HERE', Path(directory)), \
                patch.object(deploy, 'backup') as backup, patch.object(deploy, 'reset_scope') as scope:
            for name in ('seed-showcase.py', 'seed-catalog.py', 'seed-demo-records.py'):
                (Path(directory) / name).write_text('# test placeholder')
            with self.assertRaisesRegex(ValueError, 'fixtures/showcase_content.json'):
                deploy.reset_demo(DemoSeedTest.values)
            backup.assert_not_called()
            scope.assert_not_called()

    def test_direct_import_functions_refuse_missing_payload_before_docker(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(deploy, 'HERE', Path(directory)), patch.object(deploy, 'demo_scope') as scope, \
                patch.object(deploy, 'run') as run:
            for command in (deploy.seed_demo, deploy.seed_demo_records, deploy.seed_non_ai):
                with self.assertRaisesRegex(ValueError, 'optional demo package'):
                    command(DemoSeedTest.values)
            scope.assert_not_called()
            run.assert_not_called()
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_incomplete_non_ai_extension_stops_before_initialization_or_services(self):
        # Having the original package is insufficient: every new module, source
        # manifest and bundled asset must be present before any process is started.
        for missing in self.extension_files:
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as directory, \
                    patch.object(deploy, 'HERE', Path(directory)), \
                    patch.object(deploy.sys, 'argv', ['dev', 'seed-non-ai']), \
                    patch.object(deploy, 'initialize') as initialize, \
                    patch.object(deploy, 'compose') as compose, \
                    patch.object(deploy, 'query') as query, patch.object(deploy, 'run') as run, \
                    patch.object(deploy, 'backup') as backup, patch.object(deploy, 'demo_scope') as scope:
                self.package(directory, self.base_files + tuple(p for p in self.extension_files if p != missing))
                before = {p.relative_to(directory): p.read_bytes() for p in Path(directory).rglob('*') if p.is_file()}
                with self.assertRaises(ValueError) as failure:
                    deploy.main()
                self.assertIn(missing, str(failure.exception))
                with self.assertRaisesRegex(ValueError, 'extension is incomplete'):
                    deploy.seed_non_ai(DemoSeedTest.values)
                for mock in (initialize, compose, query, run, backup, scope):
                    mock.assert_not_called()
                self.assertEqual(before, {p.relative_to(directory): p.read_bytes()
                                         for p in Path(directory).rglob('*') if p.is_file()})
                self.assertFalse((Path(directory) / '.local').exists())

    def test_non_ai_extension_also_requires_the_base_package(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(deploy, 'HERE', Path(directory)), \
                patch.object(deploy.sys, 'argv', ['dev', 'seed-non-ai']), \
                patch.object(deploy, 'initialize') as initialize, patch.object(deploy, 'run') as run:
            self.package(directory, self.extension_files)
            with self.assertRaisesRegex(ValueError, 'fixtures/showcase_content.json'):
                deploy.main()
            initialize.assert_not_called()
            run.assert_not_called()

    def test_complete_non_ai_package_runs_only_explicit_entrypoint_after_scope_check(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(deploy, 'HERE', Path(directory)), \
                patch.object(deploy.sys, 'argv', ['dev', 'seed-non-ai']), \
                patch.object(deploy, 'initialize', return_value=DemoSeedTest.values), \
                patch.object(deploy, 'demo_scope') as scope, patch.object(deploy, 'run') as run, \
                patch.object(deploy, 'reset_scope') as reset, patch.object(deploy, 'query') as query:
            self.package(directory, self.base_files + self.extension_files)
            order = Mock()
            order.attach_mock(scope, 'scope'); order.attach_mock(run, 'run')
            deploy.main()
            self.assertEqual([call[0] for call in order.mock_calls], ['scope', 'run'])
            scope.assert_called_once_with(DemoSeedTest.values)
            run.assert_called_once_with([deploy.sys.executable, Path(directory) / 'seed-non-ai.py'],
                env={**os.environ, 'JIAFENG_ENV_FILE': str(deploy.ENV_FILE)})
            reset.assert_not_called()
            query.assert_not_called()

    def test_non_ai_invalid_arguments_stop_before_initialization(self):
        with patch.object(deploy.sys, 'argv', ['dev', 'seed-non-ai', '--unexpected']), \
                patch.object(deploy, 'initialize') as initialize, \
                patch.object(deploy, 'require_non_ai_package') as package:
            with self.assertRaisesRegex(ValueError, 'Usage: ./deploy/dev seed-non-ai'):
                deploy.main()
            initialize.assert_not_called()
            package.assert_not_called()

    def test_empty_reset_does_not_require_sample_data(self):
        with patch.object(deploy.sys, 'argv', ['dev', 'reset-demo', '--empty']), \
                patch.object(deploy, 'initialize', return_value=DemoSeedTest.values), \
                patch.object(deploy, 'require_demo_package') as package, \
                patch.object(deploy, 'reset_demo') as reset:
            deploy.main()
            package.assert_not_called()
            reset.assert_called_once_with(DemoSeedTest.values, empty=True)


if __name__ == '__main__':
    unittest.main()
