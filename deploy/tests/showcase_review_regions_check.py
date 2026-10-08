#!/usr/bin/env python3
"""Read-only checks of imported review/region examples, located by the DB receipt.

Only authentication uses POST. Domain access uses GET and guarded SELECT queries;
no Context, seed module, business command, fixture insertion, or deadline change is
called. A before/after digest covers the domain records inspected by this check.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[2]


def literal(value):
    return "CONVERT(X'" + str(value).encode().hex() + "' USING utf8mb4)"


def policy(config):
    return {"blind": config["blind"], "deadlineDays": config["deadlineDays"], "enabled": config["enabled"],
            "rubrics": [{"title": r["title"], "dimensions": [
                {"id": d["id"], "label": d["label"], "max": d["max"], "description": d.get("description", "")}
                for d in r["dimensions"]]} for r in config["rubrics"]]}


class Reader:
    def __init__(self, env_file):
        os.environ["JIAFENG_ENV_FILE"] = str(env_file)
        loader = importlib.machinery.SourceFileLoader("showcase_readonly_deploy", str(ROOT / "deploy/dev"))
        spec = importlib.util.spec_from_loader(loader.name, loader)
        self.deploy = importlib.util.module_from_spec(spec)
        loader.exec_module(self.deploy)
        self.env = self.deploy.read_env(self.deploy.ENV_FILE)
        assert self.env["COMPOSE_PROJECT_NAME"].startswith("jiafeng-demo-"), "Only a dedicated demo project is allowed"
        self.base = "http://127.0.0.1:" + self.env["JIAFENG_HTTP_PORT"] + "/api/v1"
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self.tokens = {}; self.users = {}; self.passed = []

    def sql(self, query):
        query = query.strip().rstrip(";")
        assert query.upper().startswith("SELECT ") and ";" not in query, "Only a single SELECT is allowed"
        output = self.deploy.compose("exec", "-T", "mysql", "sh", "-c",
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 -u root -N -B --raw jiafeng',
            input=query + ";", text=True, encoding="utf-8", capture_output=True).stdout.strip()
        return [json.loads(line) for line in output.splitlines()] if output else []

    def _http(self, method, path, token="", data=None, expected=200):
        assert method == "GET" or (method == "POST" and path == "/auth/login"), "Business writes are forbidden"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(self.base + path, method=method, headers=headers,
            data=json.dumps(data).encode() if data is not None else None)
        try:
            with self.http.open(request, timeout=60) as response:
                status, result = response.status, json.load(response)
        except urllib.error.HTTPError as error:
            status, result = error.code, json.load(error)
        assert status == expected, f"GET {path}: expected {expected}, got {status}, code={result.get('code')}"
        return result

    def login(self, name, admin=False):
        response = self._http("POST", "/auth/login", data={"username": name,
            "password": self.env["JIAFENG_DEV_PASSWORD"], "client": "admin" if admin else "member"})
        self.tokens[name] = response["token"]; self.users[name] = response["user"]

    def get(self, name, path, expected=200):
        return self._http("GET", path, self.tokens.get(name, ""), expected=expected)

    def check(self, name, condition):
        assert condition, name
        self.passed.append(name)
        print("PASS", name, flush=True)


def validate(reader):
    state = reader.sql("SELECT payload FROM jf_entity WHERE kind='setting' AND id='demoNonAiState'")[0]
    assert state["project"] == reader.env["COMPOSE_PROJECT_NAME"]
    assert state["modules"].get("review_regions") == "complete", "Wait until the review module finishes"
    records = state["records"]
    ref = lambda key: records["review:" + key]
    ids = [row["id"] for key, row in records.items() if key.startswith("review:") and "id" in row]
    work_ids = [ref(key)["id"] for key in ("revision", "custom", "offline-pending", "offline-confirmed", "overdue")]
    claim_ids = [ref("consultation:" + key)["id"] for key in ("pending", "quoted", "closed", "cancelled")]
    area_ids = [row["id"] for key, row in records.items() if key.startswith("review:area:")]
    in_sql = lambda values: ",".join(literal(v) for v in values)
    works_sql, claims_sql, areas_sql = map(in_sql, (work_ids, claim_ids, area_ids))
    tasks = reader.sql("SELECT JSON_OBJECT('id',id,'status',status,'ownerId',owner_id,'payload',payload) "
                       "FROM jf_entity WHERE kind='task' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.submissionId')) IN (" + works_sql + ") ORDER BY id")
    ids += [row["id"] for row in tasks]

    def digest():
        queries = [
            "SELECT JSON_OBJECT('id',id,'version',version,'status',status,'payload',payload) FROM jf_entity WHERE id IN (" + in_sql(ids) + ") ORDER BY id",
            "SELECT JSON_OBJECT('id',id,'revision',revision_number,'payload',payload) FROM jf_revision WHERE submission_id IN (" + works_sql + ") ORDER BY id",
            "SELECT JSON_OBJECT('revisionId',revision_id,'snapshot',snapshot,'instance',flow_instance_id,'source',source) FROM jf_review_binding WHERE revision_id IN (SELECT id FROM jf_revision WHERE submission_id IN (" + works_sql + ")) ORDER BY revision_id",
            "SELECT JSON_OBJECT('id',id,'owner',owner_id,'revision',revision_id,'hash',agreement_hash) FROM jf_copyright_confirmation WHERE submission_id IN (" + works_sql + ") ORDER BY id",
            "SELECT JSON_OBJECT('id',id,'version',version,'enabled',enabled,'parent',parent_id,'name',name,'source',source) FROM jf_region_node WHERE id IN (" + areas_sql + ") ORDER BY id",
            "SELECT JSON_OBJECT('venue',venue_id,'area',area_id) FROM jf_venue_area WHERE area_id IN (" + areas_sql + ") ORDER BY venue_id",
            "SELECT JSON_OBJECT('id',id,'stage',stage,'note',note,'amount',quote_amount,'description',quote_description) FROM jf_consultation_event WHERE claim_id IN (" + claims_sql + ") ORDER BY id",
        ]
        return hashlib.sha256(json.dumps([reader.sql(q) for q in queries], ensure_ascii=False, sort_keys=True).encode()).hexdigest()

    before = digest()
    for name, admin in (("devadmin", True), ("region_bj", True), ("member_zj", False),
                        ("member_bj", False), ("expert_zj", True)):
        reader.login(name, admin)
    progress = {key: reader.get(ref(key)["actor"], "/submissions/" + ref(key)["id"] + "/progress")
                for key in ("revision", "custom", "offline-pending", "offline-confirmed", "overdue")}
    revised = progress["revision"]
    history = revised["revisionTimelines"]
    reader.check("same work retains two distinct immutable revisions and their original contents",
        [r["revisionNumber"] for r in revised["revisions"]] == [1, 2]
        and revised["revisions"][0]["id"] != revised["revisions"][1]["id"]
        and revised["revisions"][1]["content"]["content"].startswith(revised["revisions"][0]["content"]["content"])
        and revised["revisions"][1]["content"]["content"] != revised["revisions"][0]["content"]["content"])
    reader.check("old revision keeps four-dimensional rules and real stopped workflow evidence",
        history[0]["flowVersion"] != history[1]["flowVersion"]
        and all(s["rubric"]["ruleVersion"] == "jiafeng-four-v1" for s in history[0]["stages"])
        and history[0]["started"] and any(e["outcome"] == "stopped" for e in history[0]["events"]))
    for key in ("revision", "custom"):
        timeline = progress[key]["timeline"]
        reader.check(key + " keeps six nodes, custom 65/35 standards and disabled fourth node",
            len(timeline["stages"]) == 6 and timeline["stages"][3]["state"] == "disabled"
            and all([d["max"] for d in s["rubric"]["dimensions"]] == [65, 35] for s in timeline["stages"])
            and all(s["rubric"]["ruleVersion"].startswith("jiafeng-rubric-") for s in timeline["stages"]))
    global_flow = reader.get("devadmin", "/admin/bootstrap")["reviewFlow"]
    reader.check("global review policy restored while revisions retain their own versions",
        policy(global_flow) == policy(ref("original-flow")["data"])
        and all(global_flow["flowVersion"] > progress[key]["timeline"]["flowVersion"] for key in ("revision", "custom")))

    pending = progress["offline-pending"]
    confirmed = progress["offline-confirmed"]
    confirmations = reader.get("member_zj", "/me/copyright-confirmations")
    confirmed_rows = [row for row in confirmations["items"] if row["submissionId"] == ref("offline-confirmed")["id"]]
    reader.check("offline import retains provenance and pending author's unconfirmed revision",
        pending["work"]["source"] == "线下归集" and pending["work"]["requiresAuthorConfirmation"]
        and pending["work"]["copyrightAccepted"] is False and pending["work"]["status"] == "pending_initial_review"
        and not any(row["submissionId"] == ref("offline-pending")["id"] for row in confirmations["items"]))
    confirmation_owner = reader.sql("SELECT JSON_OBJECT('ownerId',owner_id,'revisionId',revision_id,'hash',agreement_hash) "
        "FROM jf_copyright_confirmation WHERE submission_id=" + literal(ref("offline-confirmed")["id"]))
    reader.check("owner confirmation leaves offline revision unchanged and records ordinary acknowledgement",
        confirmed["work"]["copyrightAccepted"] and not confirmed["work"]["requiresAuthorConfirmation"]
        and confirmed["revisions"][0]["content"]["copyrightAccepted"] is False
        and len(confirmed_rows) == len(confirmation_owner) == 1
        and confirmed_rows[0]["revisionId"] == confirmed["revisions"][0]["id"]
        and str(confirmation_owner[0]["ownerId"]) == str(reader.users["member_zj"]["id"])
        and confirmation_owner[0]["hash"] == confirmations["agreement"]["hash"]
        and confirmations["agreement"]["signature"] is False)
    for key in ("revision", "offline-pending", "offline-confirmed"):
        reader.get("member_bj", "/submissions/" + ref(key)["id"] + "/progress", 404)
    reader.check("other authors cannot read private new revision or offline progress", True)

    task_dtos = [reader.get("devadmin", "/admin/records/tasks/" + row["id"]) for row in tasks]
    for key, state in (("revision", "active"), ("custom", "active"),
                       ("offline-confirmed", "not_started"), ("overdue", "overdue")):
        rows = [row for row in task_dtos if row["submissionId"] == ref(key)["id"] and row["status"] == "待评分"]
        reader.check(key + " has one real pending task with window state " + state,
            len(rows) == 1 and rows[0]["windowStatus"] == state)
        if key in ("revision", "custom"):
            reader.check(key + " task uses current revision's custom standard",
                rows[0]["ruleVersion"] == progress[key]["timeline"]["stages"][1]["rubric"]["ruleVersion"]
                and [d["max"] for d in rows[0]["dimensions"]] == [65, 35])
    reader.check("returned old task was cancelled through the workflow",
        any(t["submissionId"] == ref("revision")["id"] and t["status"] == "已取消" for t in task_dtos))
    expert_tasks = reader.get("expert_zj", "/workspace")["reviewTasks"]
    reader.check("future task cannot be scored and expert view remains anonymous",
        any(t["submissionId"] == ref("offline-confirmed")["id"] and not t["canScore"] for t in expert_tasks)
        and all("author" not in t and "attachments" not in t for t in expert_tasks
                if t["submissionId"] in work_ids))

    city, county = ref("area:qinghe")["id"], ref("area:shulin")["id"]
    public_cities = reader.get("", "/regions/children?parentId=zhejiang")["items"]
    public_counties = reader.get("", "/regions/children?parentId=" + city)["items"]
    admin_counties = reader.get("devadmin", "/admin/regions?parentId=" + city)["items"]
    reader.check("public tree includes enabled city/county and excludes disabled nodes",
        city in {r["id"] for r in public_cities}
        and ref("area:yunlan-disabled")["id"] not in {r["id"] for r in public_cities}
        and {r["id"] for r in public_counties} == {county, ref("area:xiqiao-empty")["id"]}
        and ref("area:qiaonan-disabled")["id"] in {r["id"] for r in admin_counties})
    reader.get("", "/regions/children?parentId=" + ref("area:yunlan-disabled")["id"], 404)
    reader.get("", "/regions/venues?areaId=" + ref("area:songfeng-hidden")["id"], 404)
    reader.get("region_bj", "/admin/regions?parentId=" + city, 404)
    reader.check("disabled ancestors and cross-province staff cannot query their private descendants", True)
    reader.check("configured empty county returns a real empty venue result",
        reader.get("", "/regions/venues?areaId=" + ref("area:xiqiao-empty")["id"])["ids"] == [])
    city_venues = set(reader.get("", "/regions/venues?areaId=" + city)["ids"])
    county_venues = set(reader.get("", "/regions/venues?areaId=" + county)["ids"])
    reader.check("city venue query includes direct city and descendant county bindings",
        {ref("venue:venue_practice")["id"], ref("venue:venue_en")["id"]}.issubset(city_venues)
        and ref("venue:venue_practice")["id"] in county_venues
        and ref("venue:venue_en")["id"] not in county_venues)
    real_map_ids = {row["id"] for row in reader.get("", "/regions/venue-coordinates")["items"]}
    for key, system in (("venue_practice", "wgs84"), ("venue_en", "gcj02"), ("unbound", "unknown")):
        rid = ref("venue:" + key)["id"]
        venue = reader.get("devadmin", "/admin/records/venues/" + rid)
        binding = reader.get("devadmin", "/admin/regions/venues/" + rid)
        reader.check(key + " retains sample flag and its explicit coordinate metadata",
            venue["sample"] and binding["coordinateSystem"] == system
            and reader.get("", "/regions/venue-map/" + rid)["coordinateSystem"] == system
            and rid not in real_map_ids)
        if key == "unbound":
            reader.check("original unbound venue remains unbound", binding["area"] is None)
    reader.check("virtual region source is explicit and never impersonates official codes",
        all(not r["officialCode"] and "虚构" in r["source"] for r in public_counties + admin_counties))

    expected_stages = {"pending": [], "quoted": ["accepted", "quoted"],
                       "closed": ["accepted", "quoted", "closed"], "cancelled": ["accepted"]}
    for key, stages in expected_stages.items():
        cid = ref("consultation:" + key)["id"]
        own = reader.get("member_zj", "/me/consultations/" + cid)
        staff = reader.get("devadmin", "/admin/consultations/" + cid)
        reader.get("member_bj", "/me/consultations/" + cid, 404)
        reader.check(key + " consultation preserves owner-private append-only history",
            [e["stage"] for e in own["events"]] == stages and own["events"] == staff["events"]
            and own["cancelled"] == (key == "cancelled")
            and own["stage"] == (stages[-1] if stages else "pending")
            and all("actor" not in event for event in own["events"]))
        if key in ("quoted", "closed"):
            quote = next(e for e in own["events"] if e["stage"] == "quoted")
            reader.check(key + " quotation is a reference amount with explicit scope",
                float(quote["quoteAmount"]) == (180.0 if key == "quoted" else 260.0)
                and "不构成付款" in quote["quoteDescription"])
    reader.check("GET and SELECT verification left all inspected business records unchanged", before == digest())
    return {"project": reader.env["COMPOSE_PROJECT_NAME"], "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "readOnly": True, "businessDigest": before, "passed": reader.passed,
            "submissionIds": work_ids, "consultationIds": claim_ids,
            "boundary": "Only existing fictional dataset records were read. Authentication creates sessions; no business transitions, imports, backdated history, or functional write probes were run."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=os.environ.get("JIAFENG_ENV_FILE"), required=not os.environ.get("JIAFENG_ENV_FILE"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = validate(Reader(args.env.resolve()))
    output = args.output or args.env.parent / "showcase-review-regions-check.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"passed": len(result["passed"]), "readOnly": True, "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
