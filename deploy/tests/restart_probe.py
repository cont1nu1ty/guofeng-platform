#!/usr/bin/env python3
"""Verify repeat startup and full recreation preserve existing DB and private S3 data.

Run only against this local development Compose project while other writers pause.
Requires the fixture produced by backup_restore.py; never creates replacement data.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = Path(os.environ.get("JIAFENG_ENV_FILE", ROOT / "deploy/.env"))
values = dict(line.split("=", 1) for line in ENV_PATH.read_text().splitlines()
              if line and not line.startswith("#"))
origin = "http://127.0.0.1:" + values["JIAFENG_HTTP_PORT"]
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
fixture = json.loads((ROOT / "deploy/.local/backup-check.json").read_text())
compose = ["docker", "compose", "--env-file", str(ENV_PATH),
           "-f", str(ROOT / "deploy/compose.yaml")]
runtime_env = {key: value for key, value in os.environ.items()
               if not key.startswith("COMPOSE_")}


def api(path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(origin + "/api/v1" + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers)
    with opener.open(request, timeout=30) as response:
        return json.load(response)


def login():
    return api("/auth/login", body={"username": "member_bj",
        "password": values["JIAFENG_DEV_PASSWORD"], "client": "member"})["token"]


def data(token):
    work = api("/submissions/" + fixture["submissionId"] + "/progress", token)["work"]
    download = api("/files/" + fixture["fileId"] + "/download", token)
    with opener.open(download["url"], timeout=30) as response:
        digest = hashlib.sha256(response.read()).hexdigest()
    assert digest == fixture["fileSha256"], "Existing S3 fixture changed"
    return {"submissionSha256": hashlib.sha256(json.dumps(work,
        ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
        "fileSha256": digest}


def query(sql):
    command = compose + ["exec", "-T", "mysql", "sh", "-c",
        'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 '
        '--batch --skip-column-names -u"$MYSQL_USER" "$MYSQL_DATABASE"']
    return subprocess.run(command, input=sql, text=True, check=True,
        capture_output=True, env=runtime_env).stdout.strip()


def counts():
    tables = query("SELECT table_name FROM information_schema.tables "
        "WHERE table_schema=DATABASE() AND LEFT(table_name,3)='jf_' "
        "ORDER BY table_name;").splitlines()
    assert tables and all(re.fullmatch(r"jf_[a-z0-9_]+", table) for table in tables)
    rows = query("\n".join(f"SELECT '{table}', COUNT(*) FROM `{table}`;"
        for table in tables)).splitlines()
    return {row.split("\t")[0]: int(row.split("\t")[1]) for row in rows}


def deploy(*args):
    with (ROOT / "deploy/.local/restart-probe.log").open("a") as log:
        subprocess.run([str(ROOT / "deploy/dev"), *args], check=True,
            stdout=log, stderr=subprocess.STDOUT, env={**runtime_env,
                "JIAFENG_ENV_FILE": str(ENV_PATH)})


before_data = data(login())
before_counts = counts()
deploy("up")
after_repeat_counts = counts()
assert before_counts == after_repeat_counts, "Repeated up changed business row counts"
# down never removes data volumes; recreating all five services exercises volume persistence.
deploy("down")
deploy("up")
after_restart_counts = counts()
assert before_counts == after_restart_counts, "Full stack recreation changed business row counts"
health = api("/health")
assert health == {"status": "ok", "schemaVersion": 6}
after_data = data(login())
assert before_data == after_data, "Business or private S3 data changed after restart"
report = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "project": values["COMPOSE_PROJECT_NAME"], "health": health,
    "repeatUpPreservesAllJfRows": True, "fullStackRecreationPreservesAllJfRows": True,
    "freshLoginWorks": True, "submissionPreserved": True, "signedFileGetPreserved": True,
    "submissionId": fixture["submissionId"], "fileId": fixture["fileId"],
    **after_data, "beforeCounts": before_counts, "afterRepeatCounts": after_repeat_counts,
    "afterRestartCounts": after_restart_counts,
    "comparisonNote": "Row counts compared before fresh-login audit writes; no secrets or signed URLs retained."}
(ROOT / "deploy/.local/restart-check.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
