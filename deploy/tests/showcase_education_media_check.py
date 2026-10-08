#!/usr/bin/env python3
"""Read-only checks of the installed fictional education/media showcase.

Requires explicit JIAFENG_ENV_FILE. Reads the private database receipt without
constructing Context or writing checkpoints. Authentication is the only POST;
all business requests are GET, all database statements are SELECT. Does not
create, repair, reset or progress sample records. Prints no credentials or signed
asset URLs. Run only after the education_media import has completed.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parents[1]
checks = []


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    checks.append(label)
    print("PASS " + label, flush=True)


def main():
    if not os.environ.get("JIAFENG_ENV_FILE"):
        raise ValueError("Set JIAFENG_ENV_FILE explicitly; no default running dataset is selected")
    sys.path.insert(0, str(HERE))
    # Importing common loads helpers only; never construct its mutating Context.
    from scenarios.common import base

    def select(query):
        stripped = query.strip().removesuffix(";")
        if not stripped.upper().startswith("SELECT ") or ";" in stripped:
            raise ValueError("This showcase checker permits one SELECT statement only")
        return base.sql(stripped + ";")

    def sql_rows(query):
        return [json.loads(line) for line in select(query).splitlines() if line]

    def receipt(identifier):
        raw = select("SELECT payload FROM jf_entity WHERE kind='setting' AND id=" + base.lit(identifier))
        if not raw:
            raise ValueError("Missing import receipt: " + identifier)
        data = json.loads(raw)
        if data.get("project") != base.ENV["COMPOSE_PROJECT_NAME"]:
            raise ValueError("Import receipt belongs to another deployment")
        return data

    class Reader(base.Client):
        def call(self, method, path, data=None, headers=None, expected=200):
            if method != "GET" and not (method == "POST" and path == "/auth/login" and not self.token):
                raise ValueError("Only authentication and business GET requests are permitted")
            return super().call(method, path, data, headers, expected)

    def get(path, client=None, expected=200):
        headers = {"Authorization": "Bearer " + client.token} if client else {}
        request = urllib.request.Request(base.BASE + path, method="GET", headers=headers)
        try:
            with base.HTTP.open(request, timeout=45) as response:
                status, value = response.status, json.load(response)
        except urllib.error.HTTPError as error:
            status, value = error.code, json.load(error)
        if status != expected:
            raise AssertionError(f"GET {path}: expected {expected}, received {status} ({value.get('code', 'unknown')})")
        return value

    state = receipt("demoNonAiState")
    check("education/media module has a completed database receipt", state.get("modules", {}).get("education_media") == "complete")
    expected_digest = hashlib.sha256((HERE / "fixtures/non_ai/dataset.json").read_bytes()).hexdigest()
    check("receipt matches the reviewed non-AI dataset", state.get("fingerprint") == expected_digest)
    records = state["records"]
    daily = records["education:daily"]["id"]
    integrity = records["education:integrity"]["id"]
    admin = Reader("devadmin", "admin")
    members = {name: Reader(name) for name in ("member_zj", "member_bj", "member_js", "member_sc", "member_overseas")}
    own = {name: get("/education/me", client) for name, client in members.items()}

    detail = {name: get(f"/education/courses/{daily}", client) for name, client in members.items()}
    current = detail["member_zj"]["course"]
    check("current course has version 2, three stable chapters and three exam questions",
          current["publicationVersion"] == 2 and [x["id"] for x in current["lessons"]] == ["promise", "listen", "review"]
          and {q["id"] for q in current["questions"]} == {"promise_check", "listen_check", "review_reserve"})
    check("learner questions exclude correct answers and internal explanations",
          all("answerId" not in q and "explanation" not in q for q in current["questions"])
          and current["quiz"]["answer"] == -1 and not current["quiz"]["explanation"])
    history = get(f"/education/courses/{daily}?version=1", members["member_zj"])
    check("completed first version retains two chapters and a separate completion",
          history["course"]["publicationVersion"] == 1 and len(history["course"]["lessons"]) == 2
          and history["progress"]["complete"] and history["progress"]["bestScore"] == 100
          and bool(history["progress"]["completedAt"]))
    for name in ("member_zj", "member_overseas"):
        p = detail[name]["progress"]
        check(name + " has not started current version", not p["lessons"] and p["percent"] == 0
              and not p["complete"] and p["bestScore"] is None)
    p = detail["member_bj"]["progress"]
    check("member_bj has one reading confirmation and no passed quiz",
          p["lessons"] == ["promise"] and p["percent"] == 25 and not p["quizPassed"] and not p["complete"])
    p = detail["member_js"]["progress"]
    check("member_js read all chapters but failed server-scored exam",
          len(p["lessons"]) == 3 and p["bestScore"] == 66 and not p["quizPassed"]
          and p["percent"] == 75 and not p["complete"] and p["completedAt"] is None)
    p = detail["member_sc"]["progress"]
    check("member_sc passed the current-version exam and completed the course",
          len(p["lessons"]) == 3 and p["bestScore"] == 100 and p["quizPassed"]
          and p["percent"] == 100 and p["complete"] and bool(p["completedAt"]))
    get(f"/education/courses/{daily}?version=1", members["member_overseas"], expected=404)
    check("historical version is hidden from an unassigned learner without history", True)
    publications = sql_rows("SELECT JSON_OBJECT('version',publication_version,'legacy',legacy,'chapters',JSON_LENGTH(payload->'$.lessons'),'bank',JSON_LENGTH(payload->'$.questions'),'exam',JSON_LENGTH(payload->'$.examQuestionIds')) FROM jf_course_publication WHERE course_id=" + base.lit(daily) + " ORDER BY publication_version")
    check("immutable publications retain full bank and distinct exam selections",
          publications == [{"version": 1, "legacy": 0, "chapters": 2, "bank": 4, "exam": 2},
                           {"version": 2, "legacy": 0, "chapters": 3, "bank": 4, "exam": 3}])
    second = get(f"/education/courses/{integrity}", members["member_zj"])
    check("integrity course has two chapters and only its first chapter confirmed",
          len(second["course"]["lessons"]) == 2 and second["progress"]["lessons"] == ["public_goods"]
          and not second["progress"]["complete"])

    for name, status in (("member_zj", "approved"), ("member_bj", "pending"), ("member_js", "rejected")):
        identity = own[name]["identity"]
        check(name + " education identity is " + status, identity is not None and identity["status"] == status
              and (status == "pending" or bool(identity["reason"])))
    group_specs = (("unconfirmed", "member_bj", False, 1, 2),
                   ("old-confirmed", "member_zj", False, 2, 1),
                   ("current-confirmed", "member_zj", True, 1, 1))
    for key, name, confirmed, version, publication in group_specs:
        identifier = records["education:group:" + key]["id"]
        group = next(g for g in own[name]["groups"] if g["id"] == identifier)
        declarations = [d for d in own[name]["declarations"] if d["groupId"] == identifier]
        check(key + " group has the intended assignment and current confirmation state",
              group["version"] == version and group["publicationVersion"] == publication
              and group["confirmed"] == confirmed and group["members"] == 1)
        if key == "unconfirmed":
            check("unconfirmed group has no declaration history", not declarations)
        else:
            check(key + " retains an exact text/hash/time declaration", len(declarations) == 1
                  and declarations[0]["groupVersion"] == 1 and bool(declarations[0]["confirmedAt"])
                  and hashlib.sha256(declarations[0]["text"].encode()).hexdigest() == declarations[0]["textHash"])
            check(key + " confirmation is bound to the correct text version",
                  (declarations[0]["textHash"] == group["declarationHash"]) == confirmed)
        if key == "current-confirmed":
            check("cadre group is restricted and points at the integrity publication",
                  group["cadreOnly"] and group["courseId"] == integrity)
    other_groups = {g["id"] for g in own["member_overseas"]["groups"]}
    check("unassigned member has none of the added groups", all(records["education:group:" + key]["id"] not in other_groups for key, *_ in group_specs))

    public = get("/workspace")
    check("private import receipts are absent from public workspace", "demoNonAiState" not in json.dumps(public))
    public_media = {m["id"]: m for m in public["mediaItems"]}
    for key in ("captions-draft", "captions-live", "captions-replaced"):
        identifier = records["education:media:" + key]["id"]
        check(key + " parent media is public", identifier in public_media and public_media[identifier]["status"] == "已发布")
        track = get(f"/admin/media/{identifier}/accessibility", admin)
        visible = get(f"/media/{identifier}/accessibility")
        check(key + " retains three manually written draft cues", len(track["draft"]["cues"]) == 3)
        if key == "captions-live":
            check("published captions and existing synthetic narration are visible",
                  len(visible["cues"]) == 3 and bool(visible["narrationUrl"]) and bool(visible["publishedAt"])
                  and "合成" in public_media[identifier]["excerpt"])
            # Fetch only the first bytes, without saving or printing signed URLs.
            url = urllib.parse.urljoin(base.BASE, visible["narrationUrl"])
            request = urllib.request.Request(url, headers={"Range": "bytes=0-63"}, method="GET")
            with base.HTTP.open(request, timeout=30) as response:
                head = response.read(64)
                check("public associated narration resolves to audio bytes", response.status in (200, 206)
                      and (head.startswith(b"ID3") or len(head) >= 2 and head[0] == 255 and head[1] & 224 == 224))
        else:
            check(key + " exposes neither stale cues nor narration", not visible["cues"] and not visible["narrationUrl"])
            check(key + " publication status is correct", bool(track["publishedAt"]) == (key == "captions-replaced"))
        if key == "captions-replaced":
            mismatch = select("SELECT COUNT(*) FROM jf_media_accessibility a JOIN jf_entity e ON e.id=a.media_id WHERE a.media_id=" + base.lit(identifier) + " AND a.published IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(a.published,'$.sourceFileId'))<>JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.sourceFileId'))")
            check("replacement really differs from the published caption source binding", mismatch == "1")

    catalog = receipt("demoCatalogState")["manifest"]["refs"]["mediaItems"]
    for key, expected in (("media_draft", "草稿"), ("member_returned", "已退回")):
        identifier = catalog[key]["id"]
        row = get(f"/admin/records/mediaItems/{identifier}", admin)
        check("original " + key + " scenario is preserved and private", row["status"] == expected and identifier not in public_media)

    identifier = records["education:panorama"]["id"]
    hall = next(h for h in public["hallPeople"] if h["id"] == identifier)
    url = hall["panoramaUrl"]
    check("published hall exposes the approved HTTPS panorama with honest context",
          url == records["education:panorama"]["panoramaUrl"] and urllib.parse.urlparse(url).scheme == "https"
          and "非展馆实景" in hall["introduction"] and "虚构" in hall["introduction"] and "CC0" in hall["sourceTitle"])
    # This proves source reachability, not WebGL rendering or phone compatibility.
    request = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(request, timeout=30) as response:
        check("external panorama is reachable as an image over HTTPS with CORS",
              response.status == 200 and response.geturl().startswith("https://")
              and response.headers.get_content_type() == "image/jpeg"
              and response.headers.get("Access-Control-Allow-Origin") == "*")

    print(json.dumps({"passed": len(checks), "businessMutations": 0,
                      "scope": "installed educational and media showcase; authentication, GET, SELECT only",
                      "limits": ["No browser rendering or phone test", "No course progress or media commands executed", "External panorama availability is time dependent"]},
                     ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
