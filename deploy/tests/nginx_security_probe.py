#!/usr/bin/env python3
"""Check the isolated HTTP edge; never defaults to or stops the active demo."""
import concurrent.futures
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import uuid

from probe_scope import isolated_deployment

ENV_PATH, values, lifecycle = isolated_deployment()
origin = "http://127.0.0.1:" + values["JIAFENG_HTTP_PORT"]
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request(path, body=None, headers=None):
    outgoing = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(origin + path, headers=outgoing,
        data=(body if isinstance(body, bytes) else json.dumps(body).encode()) if body is not None else None)
    try:
        response = opener.open(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.code, dict(response.headers.items()), response.read()


result = {"sourceProject": values["COMPOSE_PROJECT_NAME"], "isolatedEnvSelected": True}
code, headers, _ = request("/")
result["homeAccessible"] = code == 200
lower = {key.lower(): value for key, value in headers.items()}
result["nosniff"] = lower.get("x-content-type-options") == "nosniff"
result["framingDenied"] = lower.get("x-frame-options") == "DENY"
result["referrerPolicy"] = lower.get("referrer-policy") == "same-origin"
result["upstreamRoutesBlocked"] = all(request(path)[0] == 404 for path in (
    "/auth/unlock/synthetic-probe", "/system/user/list", "/resource/oss/list",
    "/workflow/definition/list", "/warm-flow/definition/list"))

code, _, payload = request("/api/v1/auth/login", {"username": "member_zj",
    "password": values["JIAFENG_DEV_PASSWORD"], "client": "member"})
login = json.loads(payload)
result["validLoginWorks"] = code == 200 and bool(login.get("token"))
if login.get("token"):
    result["validAuthenticatedReadWorks"] = request("/api/v1/auth/me", headers={
        "Authorization": "Bearer " + login["token"]})[0] == 200

marker = "synthetic_query_secret_" + uuid.uuid4().hex
code, headers, _ = request("/api/v1/health?access_token=" + marker)
request_id = next((value for key, value in headers.items() if key.lower() == "x-request-id"), "")
result["businessHealthAccessible"] = code == 200
result["serverRequestIdReturned"] = bool(request_id)
# Deliberately invalid input never exercises a real account password or lockout.
# Different forged proxy addresses must not evade the connection-source limit.
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    codes = list(pool.map(lambda number: request("/api/v1/auth/login", {}, {
        "X-Forwarded-For": f"198.51.100.{number + 1}",
        "X-Real-IP": f"198.51.100.{number + 1}", "Forwarded": "for=198.51.100.5"})[0], range(40)))
result["loginRateLimitedDespiteForgedForwardingHeaders"] = 429 in codes
result["loginBurstStatusCounts"] = {str(code): codes.count(code) for code in sorted(set(codes))}
error_marker = "synthetic_error_query_" + uuid.uuid4().hex
result["rateLimitedErrorPathChecked"] = request("/api/v1/auth/login?access_token=" + error_marker, {})[0] == 429
for route, label, count in (("files", "upload", 8), ("admin/exports", "export", 8), ("ai/tasks", "ai", 12)):
    boundary = "synthetic-nginx-probe"
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="probe.pdf"\r\n'
            'Content-Type: application/pdf\r\n\r\n%PDF-1.4 synthetic invalid unauthenticated fixture\r\n'
            f'--{boundary}--\r\n').encode() if route == "files" else {}
    headers = {"Idempotency-Key": "security-nginx-probe-" + uuid.uuid4().hex}
    if route == "files":
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        statuses = list(pool.map(lambda _: request("/api/v1/" + route, body, headers)[0], range(count)))
    result[label + "CreationRateLimited"] = 429 in statuses
    result[label + "UnauthenticatedRequestsRejected"] = all(code in (401, 429) for code in statuses)
    result[label + "CreationBurstStatusCounts"] = {str(code): statuses.count(code) for code in sorted(set(statuses))}
result["aiPollingDoesNotUseCreationQuota"] = request("/api/v1/ai/tasks")[0] == 401
logs = lifecycle.compose("logs", "--tail", "150", "web", capture_output=True, text=True).stdout
result["querySecretAbsentFromAccessLogs"] = marker not in logs
result["errorQuerySecretAbsentFromLogs"] = error_marker not in logs
result["proxyAndApplicationRequestIdsCorrelate"] = bool(request_id) and ("upstream_request_id=" + request_id) in logs

for service in ("mysql", "redis", "storage", "server", "ai", "search", "web"):
    ids = lifecycle.compose("ps", "-q", service, capture_output=True, text=True).stdout.split()
    if len(ids) != 1:
        raise AssertionError("Expected exactly one isolated service: " + service)
    # Select fields explicitly. Never dump Config.Env or runtime credentials.
    inspected = lifecycle.run(["docker", "inspect", ids[0], "--format",
        '{{json .HostConfig.Memory}}\n{{json .HostConfig.NanoCpus}}\n{{json .HostConfig.PidsLimit}}\n{{json .HostConfig.LogConfig}}'],
        capture_output=True, text=True).stdout.splitlines()
    memory, cpus, pids, logging = map(json.loads, inspected)
    result[service + "RuntimeLimitsAndLogRotation"] = memory > 0 and cpus > 0 and pids > 0 and logging == {
        "Type": "local", "Config": {"max-file": "5", "max-size": "10m"}}

path = ENV_PATH.parent / "nginx-security-check.json"
path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(result, ensure_ascii=False, indent=2))
assert all(value for value in result.values() if isinstance(value, bool)), "An isolated deployment edge check failed"
