"""No Docker writes: verify destructive reset preconditions fail closed."""
import importlib.machinery
import importlib.util
import json
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
