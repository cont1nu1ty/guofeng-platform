#!/usr/bin/env python3
"""S3 contract probe using only Python stdlib; creates and deletes its own object."""
import datetime
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from probe_scope import isolated_deployment

urlopen = urllib.request.build_opener(urllib.request.ProxyHandler({})).open

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH, values, lifecycle = isolated_deployment()
endpoint = values["JIAFENG_S3_PUBLIC_ENDPOINT"].rstrip("/")
key = "verification/中文文件-" + secrets.token_hex(6) + ".txt"
path = "/jiafeng-private/" + urllib.parse.quote(key, safe="/")
content = "家风存储持久性验证\n".encode()


def mac(key, text):
    return hmac.new(key, text.encode(), hashlib.sha256).digest()


def signed(method, payload=b"", expires=None):
    now = datetime.datetime.now(datetime.timezone.utc)
    date, stamp = now.strftime("%Y%m%d"), now.strftime("%Y%m%dT%H%M%SZ")
    scope = date + "/us-east-1/s3/aws4_request"
    host = urllib.parse.urlparse(endpoint).netloc
    query = ""
    digest = hashlib.sha256(payload).hexdigest()
    if expires is None:
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        canonical_headers = f"host:{host}\nx-amz-content-sha256:{digest}\nx-amz-date:{stamp}\n"
    else:
        digest = "UNSIGNED-PAYLOAD"
        signed_headers = "host"
        canonical_headers = f"host:{host}\n"
        query = urllib.parse.urlencode(sorted({
            "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
            "X-Amz-Credential": values["JIAFENG_S3_ACCESS_KEY"] + "/" + scope,
            "X-Amz-Date": stamp,
            "X-Amz-Expires": str(expires),
            "X-Amz-SignedHeaders": signed_headers,
        }.items()), quote_via=urllib.parse.quote)
    canonical = "\n".join([method, path, query, canonical_headers, signed_headers, digest])
    to_sign = "AWS4-HMAC-SHA256\n" + stamp + "\n" + scope + "\n" + hashlib.sha256(canonical.encode()).hexdigest()
    signing_key = mac(mac(mac(mac(("AWS4" + values["JIAFENG_S3_SECRET_KEY"]).encode(), date), "us-east-1"), "s3"), "aws4_request")
    signature = hmac.new(signing_key, to_sign.encode(), hashlib.sha256).hexdigest()
    if expires is not None:
        return endpoint + path + "?" + query + "&X-Amz-Signature=" + signature
    headers = {
        "x-amz-date": stamp,
        "x-amz-content-sha256": digest,
        "Authorization": f"AWS4-HMAC-SHA256 Credential={values['JIAFENG_S3_ACCESS_KEY']}/{scope}, SignedHeaders={signed_headers}, Signature={signature}",
    }
    request = urllib.request.Request(endpoint + path, data=payload if method == "PUT" else None, headers=headers, method=method)
    return urlopen(request, timeout=15).read()


results = {}
try:
    signed("PUT", content)
    results["signedUploadChineseFilename"] = signed("GET") == content
    try:
        urlopen(endpoint + path)
        results["anonymousDenied"] = False
    except urllib.error.HTTPError as error:
        results["anonymousDenied"] = error.code == 403
    for label, anonymous in (
        ("anonymousHeadDenied", urllib.request.Request(endpoint + path, method="HEAD")),
        ("anonymousBucketListingDenied", urllib.request.Request(endpoint + "/jiafeng-private?list-type=2")),
        ("anonymousWriteDenied", urllib.request.Request(endpoint + path, data=b"synthetic anonymous write probe", method="PUT")),
    ):
        try:
            with urlopen(anonymous, timeout=10):
                results[label] = False
        except urllib.error.HTTPError as error:
            results[label] = error.code == 403
    # If the negative write check unexpectedly succeeded, repair only our own
    # random fixture so positive signed operations can still be assessed.
    if not results["anonymousWriteDenied"]:
        signed("PUT", content)
    url = signed("GET", expires=1)
    results["signedDownload"] = urlopen(url).read() == content
    time.sleep(2)
    try:
        urlopen(url)
        results["expiredSignatureDenied"] = False
    except urllib.error.HTTPError as error:
        results["expiredSignatureDenied"] = error.code == 403
    if os.environ.get("CHECK_STORAGE_RESTART") == "1":
        lifecycle.compose("restart", "storage", stdout=subprocess.DEVNULL)
        for attempt in range(30):
            try:
                results["restartKeepsBytes"] = signed("GET") == content
                break
            except (urllib.error.URLError, ConnectionError):
                time.sleep(1)
        else:
            results["restartKeepsBytes"] = False
finally:
    signed("DELETE")
print(json.dumps(results, ensure_ascii=False, indent=2))
(ENV_PATH.parent / "storage-security-check.json").write_text(json.dumps({
    "sourceProject": values["COMPOSE_PROJECT_NAME"], "checks": results}, ensure_ascii=False, indent=2) + "\n")
if not all(results.values()):
    raise SystemExit(1)
