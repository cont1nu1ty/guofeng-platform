#!/usr/bin/env python3
"""Real HTTP + database + S3 backup/restore acceptance. Leaves labeled test data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
values = dict(line.split("=", 1) for line in (ROOT / "deploy/.env").read_text().splitlines() if line and not line.startswith("#"))
origin = "http://127.0.0.1:" + values["JIAFENG_HTTP_PORT"]


def api(base, path, method="GET", data=None, token=None, content_type="application/json", headers=None):
    outgoing = {"Content-Type": content_type, **(headers or {})}
    if token:
        outgoing["Authorization"] = "Bearer " + token
    body = json.dumps(data, ensure_ascii=False).encode() if isinstance(data, dict) else data
    request = urllib.request.Request(base + "/api/v1" + path, data=body, headers=outgoing, method=method)
    with opener.open(request, timeout=30) as response:
        return json.load(response)


def login(base):
    return api(base, "/auth/login", "POST", {"username": "member_bj", "password": values["JIAFENG_DEV_PASSWORD"], "client": "member"})["token"]


def minimal_pdf():
    # A valid small ASCII PDF; UTF-8 is exercised in the multipart filename.
    stream = b"BT /F1 14 Tf 40 80 Td (Jiafeng backup verification) Tj ET"
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>", b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, content in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + content + b"\nendobj\n")
    start = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
    return bytes(output)


def download(base, token, file_id):
    result = api(base, f"/files/{file_id}/download", token=token)
    return opener.open(result["url"], timeout=15).read()


token = login(origin)
payload = minimal_pdf()
boundary = "jf" + uuid.uuid4().hex
form = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="部署备份验收.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode() + payload + f"\r\n--{boundary}--\r\n".encode())
file = api(origin, "/files", "POST", form, token, "multipart/form-data; boundary=" + boundary)
work = api(origin, "/submissions", "POST", {"title": "部署备份验收", "content": "这是一篇用于验证数据库与私有附件备份恢复的测试稿件，不属于正式征集作品。", "region": "beijing", "genre": "letter", "channel": "community", "themes": ["heritage"], "copyrightAccepted": True, "attachments": [file]}, token, headers={"Idempotency-Key": "backup-check-" + uuid.uuid4().hex})
assert download(origin, token, file["fileId"]) == payload
before = set((ROOT / "deploy/backups").glob("*"))
subprocess.run([str(ROOT / "deploy/dev"), "backup"], check=True)
created = set((ROOT / "deploy/backups").glob("*")) - before
assert len(created) == 1
backup = created.pop()
existing_envs = set((ROOT / "deploy/.local").glob("jiafeng-restore-*.env"))
subprocess.run([str(ROOT / "deploy/dev"), "restore", str(backup)], check=True)
restored_envs = set((ROOT / "deploy/.local").glob("jiafeng-restore-*.env")) - existing_envs
assert len(restored_envs) == 1
restored_env = restored_envs.pop()
restored_values = dict(line.split("=", 1) for line in restored_env.read_text().splitlines() if line and not line.startswith("#"))
restored_origin = "http://127.0.0.1:" + restored_values["JIAFENG_HTTP_PORT"]
restored_token = login(restored_origin)
restored_work = api(restored_origin, "/submissions/" + work["id"] + "/progress", token=restored_token)["work"]
restored_bytes = download(restored_origin, restored_token, file["fileId"])
result = {
    "submissionId": work["id"], "fileId": file["fileId"],
    "submissionSurvivesRestore": restored_work["content"] == work["content"],
    "fileSurvivesRestore": hashlib.sha256(restored_bytes).digest() == hashlib.sha256(payload).digest(),
    "fileSha256": hashlib.sha256(payload).hexdigest(),
    "freshLoginWorks": True, "backupChecksumsVerified": True,
    "isolatedProject": restored_values["COMPOSE_PROJECT_NAME"],
    "sourceProject": values["COMPOSE_PROJECT_NAME"],
}
assert result["submissionSurvivesRestore"] and result["fileSurvivesRestore"]
(ROOT / "deploy/.local/backup-check.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(result, ensure_ascii=False, indent=2))
# Keep data volumes for inspection, release additional restored service ports.
subprocess.run([str(ROOT / "deploy/dev"), "down"], env={**os.environ, "JIAFENG_ENV_FILE": str(restored_env)}, check=True)
