"""Offline checkpoint invariants: retry original request and preserve later user edits."""
import copy
import sys
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scenarios.common import Context


class ScenarioCheckpointTest(TestCase):
    def context(self):
        ctx = Context.__new__(Context)
        ctx.state = {'steps': {}}
        ctx.env = {'JIAFENG_DEV_PASSWORD': 'local-test-only'}
        ctx.checkpoint = Mock()
        return ctx

    def client(self):
        client = Mock()
        client.name = 'devadmin'
        return client

    def test_completed_step_never_overwrites_user_edits(self):
        ctx, client = self.context(), self.client()
        client.call.return_value = ({'id': 'original'}, {})
        ctx.post(client, 'create', '/example', {'title': 'Original'})
        replay = ctx.post(client, 'create', '/example', {'title': 'Changed script'})
        self.assertEqual(replay, {'id': 'original'})
        client.call.assert_called_once()

    def test_interruption_reuses_original_version_payload_and_idempotency_key(self):
        ctx, client = self.context(), self.client()
        client.call.side_effect = [OSError('connection lost'), ({'id': 'original'}, {})]
        with self.assertRaises(OSError):
            ctx.post(client, 'create', '/example', {'version': 1})
        ctx.post(client, 'create', '/example', {'version': 2})
        self.assertEqual(client.call.call_args_list[0], client.call.call_args_list[1])

    def test_password_is_not_persisted_and_retry_reads_local_secret(self):
        ctx, client = self.context(), self.client()
        snapshots = []
        ctx.checkpoint.side_effect = lambda: snapshots.append(copy.deepcopy(ctx.state))
        client.call.return_value = ({'id': 'account'}, {})
        ctx.post(client, 'account', '/accounts', {'password': ctx.env['JIAFENG_DEV_PASSWORD']})
        self.assertNotIn('local-test-only', str(snapshots))
        self.assertEqual(client.call.call_args.args[2]['password'], 'local-test-only')

    def test_incomplete_checkpoint_cannot_be_replayed_by_another_account(self):
        ctx, client = self.context(), self.client()
        client.call.side_effect = OSError('connection lost')
        with self.assertRaises(OSError): ctx.post(client, 'create', '/example', {})
        client.name = 'other'
        with self.assertRaisesRegex(ValueError, 'account mismatch'):
            ctx.post(client, 'create', '/example', {})
