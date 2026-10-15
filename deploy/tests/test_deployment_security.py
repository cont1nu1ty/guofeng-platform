"""No running deployment writes: security configuration and encrypted backup checks."""
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import tarfile
import io
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

DEPLOY = Path(__file__).resolve().parents[1]


def module(name, path):
    loader = importlib.machinery.SourceFileLoader(name, str(path))
    spec = importlib.util.spec_from_loader(name, loader)
    result = importlib.util.module_from_spec(spec)
    loader.exec_module(result)
    return result


deploy = module("security_lifecycle", DEPLOY / "dev")
crypto = module("security_backup_crypto", DEPLOY / "backup_crypto.py")
scope = module("security_probe_scope", DEPLOY / "tests/probe_scope.py")


class DeploymentSecurityTest(unittest.TestCase):
    def values(self):
        result = {"COMPOSE_PROJECT_NAME": "jiafeng-demo-security-test"}
        for name in ("DB_PASSWORD", "MYSQL_ROOT_PASSWORD", "REDIS_PASSWORD", "JIAFENG_TOKEN_SECRET",
                     "JIAFENG_HEALTH_PASSWORD", "JIAFENG_DEV_PASSWORD", "JIAFENG_S3_ACCESS_KEY",
                     "JIAFENG_S3_SECRET_KEY", "JIAFENG_SEARCH_PASSWORD", "JIAFENG_AI_SERVICE_KEY"):
            result[name] = "test-only-unused"
        return result

    @unittest.skipUnless(shutil.which("docker"), "Docker Compose CLI required")
    def test_all_services_have_bounded_resources_logs_and_no_extra_ports(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "test.env"
            deploy.write_env(path, self.values())
            config = json.loads(deploy.compose("config", "--format", "json", env_file=path,
                                               capture_output=True, text=True).stdout)
        for name, item in config["services"].items():
            with self.subTest(service=name):
                self.assertGreater(int(item["mem_limit"]), 0)
                self.assertGreater(float(item["cpus"]), 0)
                self.assertGreater(int(item["pids_limit"]), 0)
                self.assertIn("no-new-privileges:true", item["security_opt"])
                self.assertEqual(item["logging"], {"driver": "local", "options": {"max-file": "5", "max-size": "10m"}})
        self.assertEqual({name for name, item in config["services"].items() if item.get("ports")}, {"web", "storage"})
        server = config["services"]["server"]
        self.assertTrue(server["read_only"])
        self.assertIn("ALL", server["cap_drop"])
        self.assertTrue(any(item["target"] == "/app/logs" and item["type"] == "volume" for item in server["volumes"]))

    @unittest.skipUnless(shutil.which("docker"), "Docker Compose CLI required")
    def test_https_overlay_replaces_both_public_port_sets(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "test.env"
            deploy.write_env(path, {**self.values(), "JIAFENG_HTTPS_ENABLED": "true",
                "JIAFENG_PUBLIC_HOST": "security.example", "JIAFENG_TLS_CERT_FILE": folder + "/chain.pem",
                "JIAFENG_TLS_KEY_FILE": folder + "/key.pem"})
            config = json.loads(deploy.compose("config", "--format", "json", env_file=path,
                                               capture_output=True, text=True).stdout)
        self.assertFalse(config["services"]["storage"].get("ports"))
        ports = config["services"]["web"]["ports"]
        self.assertEqual({(item["host_ip"], item["target"]) for item in ports}, {("127.0.0.1", 443), ("::1", 443)})
        self.assertEqual({name for name, item in config["services"].items() if item.get("ports")}, {"web"})

    def test_conflicting_or_invalid_https_switch_fails_before_docker(self):
        for values in ({"JIAFENG_HTTPS_ENABLED": "yes"}, {"JIAFENG_HTTPS_ENABLED": "true", "JIAFENG_IPV6_ENABLED": "true"}):
            with patch.object(deploy, "read_env", return_value={**self.values(), **values}), patch.object(deploy, "run") as run:
                with self.assertRaises(ValueError):
                    deploy.compose("up")
                run.assert_not_called()

    def test_credential_file_is_private_before_atomic_publish(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "test.env"
            replace = os.replace
            observed = []
            def publishing(source, target):
                observed.append(Path(source).stat().st_mode & 0o777)
                return replace(source, target)
            previous = os.umask(0)
            try:
                with patch.object(deploy.os, "replace", side_effect=publishing):
                    deploy.write_env(path, {"SYNTHETIC_SECRET": "private-test"})
            finally:
                os.umask(previous)
            self.assertEqual(observed, [0o600])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(deploy.read_env(path), {"SYNTHETIC_SECRET": "private-test"})

    def test_probes_cannot_default_to_or_explicitly_select_active_deployment(self):
        for values in ({}, {"JIAFENG_ENV_FILE": str(DEPLOY / ".env")}):
            with patch.dict(os.environ, values, clear=True):
                with self.assertRaisesRegex(ValueError, "isolated"):
                    scope.isolated_deployment()

    def test_persistent_java_log_policies_bound_file_and_archive_sizes(self):
        root = ET.parse(DEPLOY.parent / "apps/server/ruoyi-admin/src/main/resources/logback-plus.xml").getroot()
        policies = root.findall("appender/rollingPolicy")
        self.assertEqual(len(policies), 3)
        for policy in policies:
            self.assertEqual(policy.attrib["class"], "ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy")
            self.assertIn("%i", policy.findtext("fileNamePattern"))
            self.assertEqual(policy.findtext("maxFileSize"), "10MB")
            self.assertTrue(policy.findtext("totalSizeCap"))

    def test_restore_rejects_archive_traversal_links_before_any_docker_write(self):
        for name, kind in (("../../escape", tarfile.REGTYPE), ("/etc/escape", tarfile.REGTYPE), ("symlink", tarfile.SYMTYPE)):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                source = Path(folder)
                for filename in ("database.sql", "secrets.env", "images.lock.json"):
                    (source / filename).write_text("local synthetic test")
                with tarfile.open(source / "storage.tar.gz", "w:gz") as archive:
                    entry = tarfile.TarInfo(name)
                    entry.type = kind
                    entry.size = 0
                    entry.linkname = "/tmp/escape"
                    archive.addfile(entry, io.BytesIO())
                (source / "sha256.json").write_text(json.dumps({filename: deploy.file_digest(source / filename)
                    for filename in ("database.sql", "storage.tar.gz", "secrets.env", "images.lock.json")}))
                with patch.object(deploy, "run") as run, patch.object(deploy, "write_env") as write:
                    with self.assertRaisesRegex(ValueError, "unsafe archive"):
                        deploy.restore(source)
                    run.assert_not_called()
                    write.assert_not_called()


class BackupEncryptionTest(unittest.TestCase):
    def fixture(self, folder):
        source = folder / "source"
        source.mkdir()
        for name in crypto.FILES[:-1]:
            (source / name).write_bytes((name + " local synthetic backup\n").encode())
        manifest = {name: deploy.file_digest(source / name) for name in crypto.FILES[:-1]}
        (source / "sha256.json").write_text(json.dumps(manifest))
        (folder / "keys").mkdir()
        (folder / "archives").mkdir()
        key = folder / "keys/separate-key"
        key.write_bytes(b"synthetic-test-passphrase-" + os.urandom(32).hex().encode())
        key.chmod(0o600)
        return source, key

    def test_rejects_shared_key_permissions_and_incomplete_backup(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            source, key = self.fixture(base)
            key.chmod(0o644)
            with self.assertRaisesRegex(ValueError, "mode 0600"):
                crypto.crypt("encrypt", source, base / "archives/result.gpg", key)
            key.chmod(0o600)
            key.write_text("short\n" + "x" * 80)
            with self.assertRaisesRegex(ValueError, "at least 32 bytes"):
                crypto.crypt("encrypt", source, base / "archives/result.gpg", key)
            (source / "database.sql").write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                crypto.verify_backup(source)
            self.assertFalse((base / "archives/result.gpg").exists())

    def test_key_cannot_share_ciphertext_directory_for_either_operation(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            source, key = self.fixture(base)
            with self.assertRaisesRegex(ValueError, "outside"):
                crypto.crypt("encrypt", source, key.parent / "backup.gpg", key)
            with self.assertRaisesRegex(ValueError, "outside"):
                crypto.crypt("decrypt", key.parent / "backup.gpg", base / "restored", key)

    @unittest.skipUnless(shutil.which("gpg"), "Optional installed GnuPG CLI required")
    def test_encrypted_roundtrip_rejects_wrong_key_and_tamper_without_output(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            source, key = self.fixture(base)
            target = crypto.crypt("encrypt", source, base / "archives/backup.gpg", key)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            restored = crypto.crypt("decrypt", target, base / "restored", key)
            self.assertEqual({item.name: item.read_bytes() for item in source.iterdir()},
                             {item.name: item.read_bytes() for item in restored.iterdir()})
            self.assertEqual(restored.stat().st_mode & 0o777, 0o700)
            with self.assertRaisesRegex(ValueError, "already exists"):
                crypto.crypt("decrypt", target, restored, key)
            wrong = base / "keys/wrong-key"
            wrong.write_text("another-incorrect-test-only-passphrase")
            wrong.chmod(0o600)
            with self.assertRaises(subprocess.CalledProcessError):
                crypto.crypt("decrypt", target, base / "wrong-output", wrong)
            self.assertFalse((base / "wrong-output").exists())
            payload = bytearray(target.read_bytes())
            payload[-25] ^= 1
            damaged = base / "archives/damaged.gpg"
            damaged.write_bytes(payload)
            with self.assertRaises(subprocess.CalledProcessError):
                crypto.crypt("decrypt", damaged, base / "damaged-output", key)
            self.assertFalse((base / "damaged-output").exists())


if __name__ == "__main__":
    unittest.main()
