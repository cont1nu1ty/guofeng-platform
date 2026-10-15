"""Dual-stack configuration checks; never start Docker services or alter data."""
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
loader = importlib.machinery.SourceFileLoader("ipv6_deploy_test", str(DEPLOY / "dev"))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)


class Ipv6DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.values = {"COMPOSE_PROJECT_NAME": "jiafeng-demo-test",
                       "JIAFENG_DEV_ACCOUNTS_ENABLED": "true"}

    def test_default_and_explicit_enabled_file_selection(self):
        base = DEPLOY / "compose.yaml"
        overlay = DEPLOY / "compose.ipv6.yaml"
        self.assertEqual(deploy.compose_files(self.values), [base])
        self.assertEqual(deploy.compose_files({**self.values, "JIAFENG_IPV6_ENABLED": "false"}), [base])
        self.assertEqual(deploy.compose_files({**self.values, "JIAFENG_IPV6_ENABLED": "true"}), [base, overlay])

    def test_invalid_switch_fails_before_docker(self):
        with patch.object(deploy, "read_env", return_value={**self.values, "JIAFENG_IPV6_ENABLED": "yes"}), \
                patch.object(deploy, "run") as run:
            with self.assertRaisesRegex(ValueError, "must be true or false"):
                deploy.compose("up")
            run.assert_not_called()

    def test_all_lifecycle_calls_use_ordered_files_without_foreign_compose_env(self):
        with patch.object(deploy, "read_env", return_value={**self.values, "JIAFENG_IPV6_ENABLED": "true"}), \
                patch.dict(os.environ, {"COMPOSE_FILE": "/tmp/foreign.yaml"}), \
                patch.object(deploy, "run") as run:
            deploy.compose("ps")
        command = run.call_args.args[0]
        self.assertEqual([command[i + 1] for i, item in enumerate(command) if item == "-f"],
                         [DEPLOY / "compose.yaml", DEPLOY / "compose.ipv6.yaml"])
        self.assertNotIn("COMPOSE_FILE", run.call_args.kwargs["env"])

    def inspections(self, config_files):
        result = []
        for service, destination, config in zip(
                ("mysql", "redis", "storage"), ("/var/lib/mysql", "/data", "/data"), config_files):
            labels = {"com.docker.compose.project": self.values["COMPOSE_PROJECT_NAME"],
                      "com.docker.compose.service": service,
                      "com.docker.compose.project.config_files": config}
            mounts = [{"Destination": destination, "Type": "volume",
                       "Name": f'jiafeng-demo-test_{service}-data'}]
            result.append(subprocess.CompletedProcess([], 0,
                "\n".join(json.dumps(item) for item in (labels, mounts, "running")), ""))
            result.append(subprocess.CompletedProcess([], 0, json.dumps({
                "com.docker.compose.project": self.values["COMPOSE_PROJECT_NAME"],
                "com.docker.compose.volume": f"{service}-data"}), ""))
        return result

    def test_incremental_dual_stack_update_preserves_ownership_for_unchanged_services(self):
        base = str(DEPLOY / "compose.yaml")
        dual = base + "," + str(DEPLOY / "compose.ipv6.yaml")
        with patch.object(deploy, "compose", return_value=subprocess.CompletedProcess([], 0, "container-id", "")), \
                patch.object(deploy, "run", side_effect=self.inspections([base, base, dual])):
            volumes = deploy.demo_scope({**self.values, "JIAFENG_IPV6_ENABLED": "true"})
        self.assertEqual(volumes["storage"], "jiafeng-demo-test_storage-data")

    def test_foreign_incomplete_or_reordered_override_sequences_are_rejected(self):
        base, overlay = str(DEPLOY / "compose.yaml"), str(DEPLOY / "compose.ipv6.yaml")
        for config in (overlay, overlay + "," + base, base + ",/tmp/foreign.yaml",
                       base + "," + overlay + ",/tmp/foreign.yaml"):
            with self.subTest(config=config), \
                    patch.object(deploy, "compose", return_value=subprocess.CompletedProcess([], 0, "container-id", "")), \
                    patch.object(deploy, "run", side_effect=self.inspections([config, base, base])) as run:
                with self.assertRaisesRegex(ValueError, "container does not belong"):
                    deploy.demo_scope(self.values)
                self.assertEqual(run.call_count, 1)

    def test_restore_turns_off_inherited_external_ipv6(self):
        class CapturedRestore(Exception):
            pass

        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            old_values = {**self.values, "JIAFENG_IPV6_ENABLED": "true",
                          "JIAFENG_IPV6_BIND_ADDRESS": "::",
                          "JIAFENG_S3_PUBLIC_IPV6_ENDPOINT": "http://[2001:db8::1]:19340"}
            deploy.write_env(source / "secrets.env", old_values)
            for name in ("database.sql", "storage.tar.gz", "images.lock.json"):
                (source / name).write_text("test backup placeholder")
            (source / "sha256.json").write_text(json.dumps({
                name: deploy.file_digest(source / name) for name in
                ("database.sql", "storage.tar.gz", "images.lock.json", "secrets.env")}))
            with patch.object(deploy, "write_env", side_effect=CapturedRestore) as write, \
                    patch.object(deploy, "run") as run:
                with self.assertRaises(CapturedRestore):
                    deploy.restore(source)
            values = write.call_args.args[1]
            self.assertEqual(values["JIAFENG_IPV6_ENABLED"], "false")
            self.assertEqual(values["JIAFENG_IPV6_BIND_ADDRESS"], "::1")
            self.assertEqual(values["JIAFENG_S3_PUBLIC_IPV6_ENDPOINT"], "")
            self.assertEqual(values["JIAFENG_BIND_ADDRESS"], "127.0.0.1")
            self.assertEqual(deploy.read_env(source / "secrets.env"), old_values)
            run.assert_not_called()

    @unittest.skipUnless(shutil.which("docker"), "Docker Compose CLI is required for config parsing")
    def test_compose_merge_keeps_ipv4_and_adds_only_web_and_storage_ipv6(self):
        values = {**self.values, "JIAFENG_HTTP_PORT": "19084", "JIAFENG_S3_PORT": "19340",
                  "JIAFENG_BIND_ADDRESS": "0.0.0.0", "JIAFENG_IPV6_BIND_ADDRESS": "::",
                  "JIAFENG_S3_PUBLIC_IPV6_ENDPOINT": "http://[2001:db8::1]:19340"}
        for name in ("DB_PASSWORD", "MYSQL_ROOT_PASSWORD", "REDIS_PASSWORD", "JIAFENG_TOKEN_SECRET",
                     "JIAFENG_HEALTH_PASSWORD", "JIAFENG_DEV_PASSWORD", "JIAFENG_S3_ACCESS_KEY",
                     "JIAFENG_S3_SECRET_KEY", "JIAFENG_SEARCH_PASSWORD", "JIAFENG_AI_SERVICE_KEY"):
            values[name] = "test-only-unused"
        with tempfile.TemporaryDirectory() as folder:
            env_file = Path(folder) / "compose.env"
            for enabled in ("false", "true"):
                with self.subTest(enabled=enabled):
                    deploy.write_env(env_file, {**values, "JIAFENG_IPV6_ENABLED": enabled})
                    services = json.loads(deploy.compose("config", "--format", "json", env_file=env_file,
                                                        text=True, capture_output=True).stdout)["services"]
                    for service, port, target in (("web", "19084", 80), ("storage", "19340", 8333)):
                        mappings = {(row["host_ip"], row["published"], row["target"])
                                    for row in services[service]["ports"]}
                        expected = {("0.0.0.0", port, target)}
                        if enabled == "true":
                            expected.add(("::", port, target))
                        self.assertEqual(mappings, expected)
                    self.assertEqual({name for name, data in services.items() if data.get("ports")},
                                     {"web", "storage"})
                    self.assertEqual(services["server"]["environment"]["JIAFENG_S3_PUBLIC_IPV6_ENDPOINT"],
                                     values["JIAFENG_S3_PUBLIC_IPV6_ENDPOINT"])


if __name__ == "__main__":
    unittest.main()
