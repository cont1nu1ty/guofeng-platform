#!/usr/bin/env python3
"""Opt-in local security probe. Uses only a new, explicitly named isolation project.

Creates fictional records and tiny synthetic media; does not reset data, alter model
configuration, restart services or invoke an enabled model.
"""
import concurrent.futures
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import urllib.error
import uuid
import wave

from business_probe import Client, BASE, ENV, RESULTS, check
from probe_scope import isolated_deployment


def upload(client, raw, name, mime, purpose, expected=200):
    boundary = "security" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
            f'Content-Type: {mime}\r\n\r\n'.encode() + raw + f'\r\n--{boundary}--\r\n'.encode())
    request = urllib.request.Request(BASE + "/files?purpose=" + purpose, data=body,
        headers={"Authorization": "Bearer " + client.token, "Content-Type": "multipart/form-data; boundary=" + boundary})
    for attempt in range(9):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                status, data = response.status, json.load(response)
        except urllib.error.HTTPError as error:
            with error:
                status, raw = error.code, error.read()
            try: data = json.loads(raw)
            except (ValueError, UnicodeDecodeError): data = {"code": "HTTP_ERROR", "status": status}
        if status != 429 or attempt == 8: break
        # Nginx refuses before upstream processing. Separate ingress tests verify
        # the limiter; this bounded wait lets the fixture exercise the decoder.
        time.sleep(10)
    assert status == expected, {"name": name, "status": status, "expected": expected, "response": data}
    return data


def main():
    _, scoped, _ = isolated_deployment()
    project = ENV.get("COMPOSE_PROJECT_NAME", "")
    assert project.startswith("jiafeng-demo-security-"), "requires a new jiafeng-demo-security-* project"
    target = urllib.parse.urlsplit(BASE)
    assert target.hostname in {"127.0.0.1", "localhost", "::1"}, "loopback only"
    assert scoped["COMPOSE_PROJECT_NAME"] == project and target.port == int(scoped["JIAFENG_HTTP_PORT"]), "API must use the isolated project's port"
    assert ENV.get("JIAFENG_AI_ENABLED", "false").lower() == "false", "probe requires disabled models"
    assert shutil.which("ffmpeg"), "local fixture generation requires ffmpeg"
    a, b = Client("member_zj"), Client("member_bj")
    admin, expert = Client("devadmin", "admin"), Client("expert_zj", "admin")
    status = a.call("GET", "/ai/status")[1]
    assert not status["enabled"]
    check("isolated AI is disabled; no external model is requested")
    anonymous = Client.__new__(Client); anonymous.token = ""
    anonymous.call("GET", "/ai/tasks", expected=401)
    anonymous.call("POST", "/ai/tasks", {"mode": "letter", "prompt": "fictional"}, expected=401)
    a.call("GET", "/admin/ai/tasks", expected=403)
    expert.call("GET", "/admin/ai/tasks", expected=403)
    check("anonymous AI task access and member/expert administrative access are refused")

    body = {"mode": "letter", "prompt": "虚构安全测试资料，不是真实家庭信息。", "language": "zh",
            "ownerId": b.user["id"], "status": "succeeded", "result": "forged result", "region": "all"}
    key = str(uuid.uuid4())
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        tasks = list(pool.map(lambda _: a.call("POST", "/ai/tasks", body, {"Idempotency-Key": key})[1], range(2)))
    task = tasks[0]
    assert task["id"] == tasks[1]["id"] and "result" not in task
    a.call("POST", "/ai/tasks", {**body, "prompt": "different"}, {"Idempotency-Key": key}, 409)
    check("real simultaneous AI task replay creates one task and rejects changed payload/forged result")
    for client in (b, admin, expert): client.call("GET", "/ai/tasks/" + task["id"], expected=404)
    assert task["id"] not in {x["id"] for x in b.call("GET", "/ai/tasks")[1]["items"]}
    check("private task detail/list remain owner scoped including national administrator")
    redacted = next(x for x in admin.call("GET", "/admin/ai/tasks")[1]["items"] if x["id"] == task["id"])
    assert redacted.get("redacted") and not any(k in redacted for k in ("prompt", "text", "fileId", "result"))
    check("administrative task metadata does not expose private input, file IDs or output")
    deadline = time.monotonic() + 30
    while task["status"] in {"queued", "running"} and time.monotonic() < deadline:
        time.sleep(.5)
        task = a.call("GET", "/ai/tasks/" + task["id"])[1]
    assert task["status"] == "failed" and task["error"]["code"] == "AI_NOT_CONFIGURED" and "result" not in task, task
    check("disabled adapter produces durable explicit failure with no demo fallback")

    wav = io.BytesIO()
    with wave.open(wav, "wb") as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(8000)
        audio.writeframes(b"\x00\x00" * 1600)
    recording = upload(a, wav.getvalue(), "合成静音.wav", "audio/wav", "recitation")
    assert recording["duration"] > 0 and recording["mimeType"] == "audio/mpeg"
    a.call("GET", "/files/" + recording["fileId"] + "/download")
    b.call("GET", "/files/" + recording["fileId"] + "/download", expected=404)
    expert.call("GET", "/files/" + recording["fileId"] + "/download", expected=404)
    check("synthetic WAV decodes to private MP3; other member/expert original download is refused")
    upload(a, b"RIFF\x00\x00\x00\x00WAVEcorrupt", "损坏.wav", "audio/wav", "recitation", 422)
    upload(a, b"#EXTM3U\nhttp://127.0.0.1:9/forbidden\n", "伪装.mp3", "audio/mpeg", "recitation", 422)
    upload(a, b"\x00\x00\x00\x18ftypisomcorrupt", "损坏.mp4", "video/mp4", "media", 422)
    check("damaged WAV/MP4 and a playlist disguised as MP3 are refused")
    with tempfile.TemporaryDirectory(prefix="jiafeng-security-media-") as directory:
        video = Path(directory) / "synthetic.mp4"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=32x32:r=5:d=0.4",
                        "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-threads", "1", str(video)], check=True, timeout=15)
        media = upload(a, video.read_bytes(), "合成黑色视频.mp4", "video/mp4", "media")
        assert media["duration"] > 0 and media["mimeType"] == "video/mp4"
    check("synthetic MP4 still normalizes successfully after malformed media refusals")

    report = Path(os.environ.get("JIAFENG_SECURITY_AI_REPORT", "/tmp/jiafeng-security-ai-report.json"))
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({"project": project, "base": BASE, "checks": RESULTS, "taskStatus": task["status"],
        "errorCode": task["error"]["code"], "fixtures": "fictional prompt, synthetic silence/black frames, controlled corrupt files"}, ensure_ascii=False, indent=2))
    print("Report:", report)


if __name__ == "__main__": main()
