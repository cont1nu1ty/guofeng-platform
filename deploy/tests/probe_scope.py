"""Fail closed before deployment probes can write to or stop a running project."""
import importlib.machinery
import importlib.util
import os
from pathlib import Path
import re

DEPLOY = Path(__file__).resolve().parents[1]


def isolated_deployment():
    configured = os.environ.get("JIAFENG_ENV_FILE", "")
    if not configured:
        raise ValueError("Set JIAFENG_ENV_FILE to an isolated jiafeng-demo-* environment; the active demo is never a probe default")
    path = Path(configured).resolve()
    if path == (DEPLOY / ".env").resolve():
        raise ValueError("Deployment probes refuse deploy/.env; select an isolated jiafeng-demo-* environment")
    loader = importlib.machinery.SourceFileLoader("jiafeng_probe_deploy", str(DEPLOY / "dev"))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    lifecycle = importlib.util.module_from_spec(spec)
    loader.exec_module(lifecycle)
    values = lifecycle.read_env(path)
    if not re.fullmatch(r"jiafeng-demo-[a-z0-9][a-z0-9_-]*", values.get("COMPOSE_PROJECT_NAME", "")):
        raise ValueError("Deployment probes require an isolated jiafeng-demo-* project")
    if values.get("JIAFENG_DEV_ACCOUNTS_ENABLED") != "true":
        raise ValueError("Deployment probes require development accounts in the isolated project")
    # Container and volume labels are checked before any network/API write.
    lifecycle.demo_scope(values)
    return path, values, lifecycle
