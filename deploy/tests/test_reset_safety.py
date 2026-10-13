"""No Docker writes: verify destructive reset preconditions fail closed."""
import importlib.machinery
import importlib.util
import contextlib
import json
import re
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
loader = importlib.machinery.SourceFileLoader("jiafeng_deploy", str(DEPLOY / "dev"))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)


def output(value):
    return subprocess.CompletedProcess([], 0, value, "")


class ResetSafetyTest(unittest.TestCase):
    current_tables = {
        'jf_account',
        'jf_account_name',
        'jf_account_review',
        'jf_ai_chunk',
        'jf_ai_task',
        'jf_audit',
        'jf_bootstrap_ready',
        'jf_certificate',
        'jf_consultation_event',
        'jf_copyright_confirmation',
        'jf_course_attempt',
        'jf_course_learning',
        'jf_course_publication',
        'jf_delivery_preference',
        'jf_draft',
        'jf_education_declaration',
        'jf_education_group',
        'jf_education_identity',
        'jf_education_member',
        'jf_engagement',
        'jf_entity',
        'jf_file',
        'jf_idempotency',
        'jf_job',
        'jf_login_attempt',
        'jf_media_accessibility',
        'jf_notification_delivery',
        'jf_public_cache_state',
        'jf_region_node',
        'jf_registration',
        'jf_report_period',
        'jf_resource',
        'jf_review_binding',
        'jf_review_delivery',
        'jf_review_reminder_state',
        'jf_review_window',
        'jf_revision',
        'jf_revision_file',
        'jf_scheduled_delivery',
        'jf_schema_version',
        'jf_search_outbox',
        'jf_search_state',
        'jf_submission_import',
        'jf_venue_area',
    }

    def test_reset_inventory_and_foreign_key_order_cover_all_versioned_tables(self):
        resources = DEPLOY.parent / 'apps/server/ruoyi-modules/ruoyi-jiafeng/src/main/resources/db/jiafeng'
        sql = (DEPLOY / 'mysql/reset-demo.sql').read_text()
        names = {'jf_schema_version', 'jf_bootstrap_ready'}
        preserved = {'jf_schema_version', 'jf_bootstrap_ready', 'jf_region_node',
                     'jf_public_cache_state', 'jf_search_state', 'jf_review_reminder_state'}
        for migration in resources.glob('V*.sql'):
            for table, body in re.findall(r'CREATE TABLE IF NOT EXISTS (jf_\w+)\s*\((.*?)\)\s*(?:ENGINE[^;]*)?;', migration.read_text(), re.S | re.I):
                names.add(table)
                if table in preserved:
                    self.assertNotIn(f'DELETE FROM {table};', sql)
                    continue
                statement = f'DELETE FROM {table};'
                self.assertIn(statement, sql, table)
                for parent in re.findall(r'REFERENCES\s+(jf_\w+)', body):
                    if parent not in preserved:
                        self.assertLess(sql.index(statement), sql.index(f'DELETE FROM {parent};'), f'{table} before {parent}')
        self.assertEqual(names, self.current_tables)

    def setUp(self):
        self.values = {"COMPOSE_PROJECT_NAME": "jiafeng-dev",
            "JIAFENG_DEV_ACCOUNTS_ENABLED": "true"}

    def test_rejects_non_development_projects_before_docker_access(self):
        with patch.object(deploy, "compose") as compose:
            for project in ("another-project", "jiafeng-prod", "jiafeng-restore-old"):
                with self.assertRaises(ValueError):
                    deploy.reset_scope({**self.values, "COMPOSE_PROJECT_NAME": project})
            compose.assert_not_called()

    def test_rejects_disabled_development_accounts(self):
        with patch.object(deploy, "compose") as compose:
            with self.assertRaises(ValueError):
                deploy.reset_scope({**self.values, "JIAFENG_DEV_ACCOUNTS_ENABLED": "false"})
            compose.assert_not_called()

    def inspect_container(self, *, project="jiafeng-dev"):
        labels = {"com.docker.compose.project": project,
            "com.docker.compose.service": "mysql",
            "com.docker.compose.project.config_files": str(DEPLOY / "compose.yaml")}
        mounts = [{"Destination": "/var/lib/mysql", "Type": "volume", "Name": "owned-mysql"}]
        return output("\n".join(json.dumps(item) for item in (labels, mounts, "running")))

    def test_rejects_foreign_container(self):
        with patch.object(deploy, "compose", return_value=output("container-id")), \
                patch.object(deploy, "run", return_value=self.inspect_container(project="other")) as run:
            with self.assertRaisesRegex(ValueError, "container does not belong"):
                deploy.reset_scope(self.values)
            self.assertEqual(run.call_count, 1)

    def test_rejects_foreign_volume(self):
        foreign = output(json.dumps({"com.docker.compose.project": "other",
            "com.docker.compose.volume": "mysql-data"}))
        with patch.object(deploy, "compose", return_value=output("container-id")), \
                patch.object(deploy, "run", side_effect=[self.inspect_container(), foreign]):
            with self.assertRaisesRegex(ValueError, "volume labels"):
                deploy.reset_scope(self.values)

    @contextlib.contextmanager
    def owned_scope(self, tables):
        inspections = []
        for service, destination in (("mysql", "/var/lib/mysql"), ("redis", "/data"), ("storage", "/data")):
            labels = {"com.docker.compose.project": "jiafeng-dev",
                "com.docker.compose.service": service,
                "com.docker.compose.project.config_files": str(DEPLOY / "compose.yaml")}
            mounts = [{"Destination": destination, "Type": "volume", "Name": f"jiafeng-dev_{service}-data"}]
            inspections.append(output("\n".join(json.dumps(item) for item in (labels, mounts, "running"))))
            inspections.append(output(json.dumps({"com.docker.compose.project": "jiafeng-dev",
                "com.docker.compose.volume": f"{service}-data"})))
        with patch.object(deploy, "compose", return_value=output("owned-container")), \
                patch.object(deploy, "run", side_effect=inspections), \
                patch.object(deploy, "query", return_value="\n".join(sorted(tables))) as query:
            yield query

    def test_current_ai_schema_allows_read_only_ownership_check(self):
        with self.owned_scope(self.current_tables) as query:
            volumes = deploy.reset_scope(self.values)
            self.assertEqual(volumes["storage"], "jiafeng-dev_storage-data")
            query.assert_called_once()
            self.assertTrue(query.call_args.args[0].startswith("SELECT "))

    def test_unknown_table_or_missing_ai_migration_still_fails_closed(self):
        for tables in (self.current_tables | {"jf_unreviewed_data"}, self.current_tables - {"jf_ai_chunk"}):
            with self.subTest(tables=tables), self.owned_scope(tables):
                with self.assertRaisesRegex(ValueError, "Business schema changed"):
                    deploy.reset_scope(self.values)

    def test_reset_sql_clears_ai_before_sources_without_resetting_schema_history(self):
        script = (DEPLOY / "mysql" / "reset-demo.sql").read_text()
        for table in ("jf_ai_task", "jf_ai_chunk"):
            position = script.index(f"DELETE FROM {table};")
            for referenced in ("jf_file", "jf_entity", "jf_account"):
                self.assertLess(position, script.index(f"DELETE FROM {referenced};"))
        self.assertLess(script.index("START TRANSACTION;"), script.index("DELETE FROM jf_ai_task;"))
        self.assertGreater(script.index("COMMIT;"), script.index("DELETE FROM jf_ai_chunk;"))
        self.assertNotIn("DELETE FROM jf_schema_version", script)
        self.assertNotIn("TRUNCATE", script)

    def test_missing_seed_stops_before_backup(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(deploy, "HERE", Path(directory)), \
                patch.object(deploy, "backup") as backup:
            with self.assertRaisesRegex(ValueError, "Missing deploy/seed-showcase"):
                deploy.reset_demo(self.values)
            backup.assert_not_called()

    def test_backup_failure_cannot_reach_cleanup(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(deploy, "HERE", Path(directory)), \
                patch.object(deploy, "reset_scope", return_value={}), \
                patch.object(deploy, "query", return_value="") as query, \
                patch.object(deploy, "backup", side_effect=RuntimeError("backup failed")) as backup, \
                patch.object(deploy, "compose") as compose, patch.object(deploy, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "backup failed"):
                deploy.reset_demo(self.values, empty=True)
            backup.assert_called_once_with(self.values, resume_services=False)
            self.assertEqual(query.call_count, 2)  # Read-only snapshot metadata.
            compose.assert_not_called()
            run.assert_not_called()

    def test_corrupt_backup_cannot_reach_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            backup_path = Path(directory) / "backup"
            backup_path.mkdir()
            (backup_path / "database.sql").write_text("database bytes")
            (backup_path / "sha256.json").write_text(json.dumps({"database.sql": "wrong"}))
            with patch.object(deploy, "HERE", Path(directory)), \
                    patch.object(deploy, "reset_scope", return_value={}), \
                    patch.object(deploy, "query", return_value="") as query, \
                    patch.object(deploy, "backup", return_value=backup_path), \
                    patch.object(deploy, "compose") as compose, patch.object(deploy, "run") as run:
                with self.assertRaisesRegex(ValueError, "Backup checksum mismatch"):
                    deploy.reset_demo(self.values, empty=True)
                self.assertEqual(query.call_count, 2)
                compose.assert_not_called()
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
