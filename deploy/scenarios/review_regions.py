"""Small, additive review/region examples for the fictional branch dataset.

All histories come from normal API transitions. This module never imports itself,
uses SQL, backdates an event, signs for an author as an administrator, or turns a
sample venue into a real navigation destination. Context owns durable checkpoints.
"""
from __future__ import annotations

import copy
import datetime as dt
import uuid


PREFIX = "review:"
FLOW_FIELDS = ("blind", "deadlineDays", "enabled", "rubrics")
REGION_SOURCE = "家风中华行虚构展示目录；非行政区划资料，不使用正式行政区划代码。"


def _payload(title, content):
    return {
        "title": title, "author": "林晚晴", "region": "zhejiang",
        "genre": "letter", "channel": "community", "themes": ["heritage", "neighbor"],
        "content": content, "copyrightAccepted": True, "attachments": [], "overseasLocation": "",
    }


WORKS = {
    "revision": _payload("饭桌旁的值日簿", (
        "给长大后的孩子：\n\n周日整理抽屉时，我们找到一本旧值日簿。最初，洗碗、浇花和整理书架都由大人安排，"
        "你只在完成后画一颗星。后来你提出，照料家里不是换取奖励，而是让每个人都能得到休息。"
        "于是我们把值日簿留在饭桌旁，每周坐下来商量一次。\n\n写下这件小事，是想记住一家人愿意倾听彼此的那个晚上。"
    )),
    "custom": _payload("借伞的人记得送回来", (
        "给刚搬来街坊的新朋友：\n\n门厅的伞架上一直有一把蓝伞。雨大时，谁需要就先带走；天晴后，谁借过就把伞晾干送回。"
        "起初大家只记得伞的颜色，后来还会留下一句谢谢，或补好松动的伞骨。\n\n孩子问，为什么没有人守着登记。"
        "我说，信任也需要照料：借走前告诉值班邻居，送回时确认伞是好的，弄坏了便主动说明。"
        "家里的约定就这样走出家门，变成了街坊彼此照应的小办法。"
    )),
    "offline_pending": _payload("外婆留在菜谱边的话", (
        "写给一起学做饭的家人：\n\n外婆的菜谱没有精确的分量，却在页边写着许多提醒：先问客人是否忌口，盛饭时把小碗留给孩子，"
        "饭后让做饭的人先坐一会儿。我们照着做了一顿晚饭，才发现这些话比菜名更值得记下来。"
        "以后无论谁掌勺，都愿意把这份体谅留在餐桌上。"
    )),
    "offline_confirmed": _payload("修好的书包继续上学", (
        "给准备新学期的孩子：\n\n你原本想换掉拉链坏了的书包，后来决定和家人一起试着修好它。我们把书本拿出来，"
        "按次序收好零件，再请邻居教我们重新穿好拉链。\n\n第二天你背着修好的书包出门，说节俭不是舍不得用新的，"
        "而是先想想旧物还能陪伴多久。这封短信记下我们一起动手的下午，也提醒大人认真听取孩子的主意。"
    )),
}
REVISION_CONTENT = WORKS["revision"]["content"] + (
    "\n\n补记：那晚我们逐项讨论了值日安排。加班的人可以提前留言，第二天再交换任务；孩子够不到的高处仍由大人负责。"
    "隔周检查时，大家发现书架整理得慢，便把它拆成两个小任务。值日簿记录的是协商和互相补位，不是给家人排名。"
)


def _current(ctx, member, sid):
    return ctx.get(member, f"/submissions/{sid}/progress")


def _action(ctx, member, operator, key, command, sid, data=None):
    return ctx.cmd(operator, PREFIX + key, command, sid, data or {},
                   _current(ctx, member, sid)["work"]["version"])


def _configure_now(ctx, desired):
    """Always inspect current config; a finally restore must not be replay-skipped."""
    current = ctx.get(ctx.admin, "/admin/bootstrap")["reviewFlow"]
    def policy(config):
        return {**{k: config.get(k) for k in FLOW_FIELDS if k != "rubrics"},
                "rubrics": [{"title": r["title"], "dimensions": [
                    {"id": d["id"], "label": d["label"], "max": d["max"],
                     "description": d.get("description", "")}
                    for d in r["dimensions"]]} for r in config.get("rubrics", [])]}
    if policy(current) == policy(desired):
        return
    ctx.admin.call("POST", "/admin/commands", {
        "command": "configureReviewFlow", "entityId": "", "data": desired,
        "version": current["lockVersion"],
    }, {"Idempotency-Key": "nonai-flow-" + str(uuid.uuid4()), "X-Workspace-Mode": "compact"})


def _custom_flow():
    rubric = {"title": "家书共读标准", "dimensions": [
        {"id": "meaning", "label": "主题与生活细节", "max": 65,
         "description": "围绕家风主题，交代具体行动与人物之间的相互照应。"},
        {"id": "expression", "label": "表达与结构", "max": 35,
         "description": "语言清楚，结构连贯，避免暴露不必要的家庭身份信息。"},
    ]}
    return {"blind": True, "deadlineDays": 7,
            "enabled": [True, True, True, False, True, True],
            "rubrics": [copy.deepcopy(rubric) for _ in range(6)]}


def _record_work(ctx, key, member, sid, scenario, **extra):
    progress = _current(ctx, member, sid)
    current_revision = next(row for row in progress["revisions"]
                            if row["revisionNumber"] == progress["work"]["revisionNumber"])
    ctx.record(PREFIX + key, kind="submission", id=sid, actor=member.name,
               title=progress["work"]["title"], scenario=scenario, fictional=True,
               revisionId=current_revision["id"],
               revisionVersions=[{"revisionNumber": t["revisionNumber"],
                                  "flowVersion": t["flowVersion"], "source": t["source"]}
                                 for t in progress["revisionTimelines"]], **extra)
    return progress


def _reviews(ctx):
    member = ctx.client("member_zj")
    operator = ctx.client("region_zj", True)
    expert = ctx.client("expert_zj", True)
    saved_key = PREFIX + "original-flow"
    if saved_key not in ctx.records:
        original = ctx.get(ctx.admin, "/admin/bootstrap")["reviewFlow"]
        if not original.get("rubrics"):
            # Fresh installations store the legacy rule implicitly. Read its exact
            # server-projected dimensions from a base revision instead of duplicating
            # the historical scoring definition in the scenario script. Restoration
            # must pass these explicitly, or configureReviewFlow retains custom rules.
            base_progress = ctx.get(ctx.admin, "/submissions/" + ctx.ref("submissions", "weekend_pact") + "/progress")
            legacy = [copy.deepcopy(s["rubric"]) for s in base_progress["timeline"]["stages"]]
            if len(legacy) != 6 or any(r["ruleVersion"] != "jiafeng-four-v1" for r in legacy):
                raise ValueError("The base revision does not provide the unchanged legacy review standard")
            original["rubrics"] = legacy
        ctx.record(saved_key, kind="configuration-snapshot", fictional=True,
                   data={k: copy.deepcopy(original[k]) for k in FLOW_FIELDS})
    original = ctx.records[saved_key]["data"]
    try:
        # An interrupted invocation may have left the temporary config active.
        _configure_now(ctx, original)
        old = ctx.post(member, PREFIX + "revision:create", "/submissions", WORKS["revision"])
        sid = old["id"]
        _action(ctx, member, operator, "revision:approve-old", "approveSubmission", sid)
        _action(ctx, member, operator, "revision:blind-old", "prepareBlindMaterial", sid,
                {"content": WORKS["revision"]["content"], "confirmed": True})
        _action(ctx, member, operator, "revision:assign-old", "assignReview", sid,
                {"expertId": expert.user["id"]})
        _action(ctx, member, operator, "revision:return", "returnSubmission", sid,
                {"reason": "请补充值日安排如何协商和调整的具体经过，保留家庭成员之间相互体谅的细节。"})

        rows = [{**WORKS[key], "copyrightAccepted": False, "ownerId": member.user["id"],
                 "sourceName": "青禾社区家书共写日文字归集（虚构）", "sourceRef": source}
                for key, source in (("offline_pending", "QH-JS-001"), ("offline_confirmed", "QH-JS-002"))]
        plan = ctx.post(operator, PREFIX + "imports:preview", "/admin/submission-imports/preview", {"rows": rows})
        if plan["errors"] or len(plan["rows"]) != 2:
            raise ValueError("Fictional manuscript import precheck failed: " + str(plan["errors"]))
        imported = ctx.post(operator, PREFIX + "imports:confirm", "/admin/submission-imports/confirm",
                            {"rows": rows, "fingerprint": plan["fingerprint"]})["imported"]
        pending, confirmed = imported
        agreement = ctx.get(member, "/rights/agreement")
        ctx.post(member, PREFIX + "imports:author-confirm", f'/submissions/{confirmed["id"]}/copyright-confirmations', {
            "version": _current(ctx, member, confirmed["id"])["work"]["version"],
            "revisionId": confirmed["revisionId"], "agreementVersion": agreement["version"], "accepted": True,
        })

        _configure_now(ctx, _custom_flow())
        revised = {**WORKS["revision"], "content": REVISION_CONTENT}
        ctx.request(member, PREFIX + "revision:resubmit", "POST", f"/submissions/{sid}/revisions", revised,
                    {"If-Match": '"' + str(_current(ctx, member, sid)["work"]["version"]) + '"'})
        custom = ctx.post(member, PREFIX + "custom:create", "/submissions", WORKS["custom"])
    finally:
        _configure_now(ctx, original)

    # The global setting has now been restored. New tasks use each revision's own snapshot.
    for key, work_id, text in (("revision", sid, REVISION_CONTENT),
                               ("custom", custom["id"], WORKS["custom"]["content"]),
                               ("offline_confirmed", confirmed["id"], WORKS["offline_confirmed"]["content"])):
        _action(ctx, member, operator, key + ":approve", "approveSubmission", work_id)
        _action(ctx, member, operator, key + ":blind", "prepareBlindMaterial", work_id,
                {"content": text, "confirmed": True})
    ids = [sid, custom["id"]]
    allocation_input = {"ids": ids, "group": "文学创作组",
                        "versions": {i: _current(ctx, member, i)["work"]["version"] for i in ids}}
    allocation = ctx.post(operator, PREFIX + "allocation:preview", "/admin/review-assignments/preview", allocation_input)
    if allocation["excluded"] or len(allocation["rows"]) != len(ids):
        raise ValueError("Fictional batch allocation has no matching available expert: " + str(allocation["excluded"]))
    ctx.post(operator, PREFIX + "allocation:confirm", "/admin/review-assignments/confirm",
             {**allocation_input, "fingerprint": allocation["fingerprint"]})

    now = dt.datetime.now(dt.timezone.utc)
    _action(ctx, member, operator, "offline_confirmed:future", "assignReview", confirmed["id"], {
        "expertId": expert.user["id"], "startsAt": (now + dt.timedelta(days=7)).isoformat(),
        "dueAt": (now + dt.timedelta(days=14)).isoformat(),
    })
    _record_work(ctx, "revision", member, sid, "returned-old-version-and-current-custom-rubric")
    _record_work(ctx, "custom", member, custom["id"], "active-custom-rubric-rule-allocation")
    _record_work(ctx, "offline-pending", member, pending["id"], "offline-awaiting-owner-confirmation",
                 confirmationByAdmin=False)
    _record_work(ctx, "offline-confirmed", member, confirmed["id"], "offline-owner-confirmed-future-window",
                 confirmationActor=member.name, confirmationByAdmin=False)
    # The original dataset already creates this deadline through a real short window.
    # Do not backdate another task or reassign the original one to manufacture history.
    ctx.record(PREFIX + "overdue", kind="submission", id=ctx.ref("submissions", "balcony_boxes"),
               actor="member_bj", title="阳台上的三个纸箱", scenario="existing-natural-expiry",
               fictional=True, reused=True)
    ctx.record(PREFIX + "allocation", kind="assignment-plan", submissionIds=ids,
               rule=allocation["rule"], rows=allocation["rows"], fictional=True)


def _regions(ctx):
    def node(key, parent, name, english, enabled=True):
        saved = ctx.post(ctx.admin, PREFIX + "area:" + key, "/admin/regions", {
            "parentId": parent, "name": name, "nameEn": english,
            "officialCode": "", "source": REGION_SOURCE, "enabled": enabled,
        })
        ctx.record(PREFIX + "area:" + key, kind="region", id=saved["id"], title=name,
                   enabled=enabled, parentId=parent, fictional=True, official=False)
        return saved["id"]

    city = node("qinghe", "zhejiang", "青禾市", "Qinghe City")
    county = node("shulin", city, "书林区", "Shulin District")
    node("xiqiao-empty", city, "溪桥县", "Xiqiao County")
    node("qiaonan-disabled", city, "桥南区", "Qiaonan District", False)
    hidden_city = node("yunlan-disabled", "zhejiang", "云岚市", "Yunlan City", False)
    node("songfeng-hidden", hidden_city, "松风区", "Songfeng District")

    # Preserve the original catalog's natural titles, images and sample=true.
    # Coordinates are illustrative metadata, not a claim about a real venue.
    for key, system, latitude, longitude, area in (
        ("venue_practice", "wgs84", 30.20, 120.10, county),
        ("venue_en", "gcj02", 30.21, 120.11, city),
    ):
        venue_id = ctx.ref("venues", key)
        current = ctx.entity("venues", venue_id)
        data = {**current, "latitude": latitude, "longitude": longitude, "sample": True,
                "visitorNotice": ("虚构展示阵地，坐标仅说明坐标系和地区绑定，不对应实际地址，不提供真实导航。"
                                  if current["language"] == "zh" else
                                  "Fictional venue. Illustrative coordinates explain area binding only; no real-world navigation is offered.")}
        saved = ctx.cmd(ctx.admin, PREFIX + "venue:" + key + ":coordinates", "saveVenue", venue_id,
                        data, current["lockVersion"])
        binding = ctx.post(ctx.admin, PREFIX + "venue:" + key + ":bind", f"/admin/regions/venues/{venue_id}", {
            "areaId": area, "coordinateSystem": system, "version": saved["lockVersion"],
        })
        ctx.cmd(ctx.admin, PREFIX + "venue:" + key + ":publish", "setVenueStatus", venue_id,
                {"status": "已发布"}, binding["version"])
        ctx.record(PREFIX + "venue:" + key, kind="venue", id=venue_id, title=current["title"],
                   areaId=area, coordinateSystem=system, sample=True, fictional=True,
                   scenario="illustrative-coordinate-metadata-with-navigation-disabled")
    ctx.record(PREFIX + "venue:unbound", kind="venue", id=ctx.ref("venues", "venue_integrity"),
               title="澄溪清廉家风学习馆", coordinateSystem="unknown", areaId="", sample=True,
               fictional=True, reused=True, scenario="unbound-and-unverified-coordinates")


def _consultations(ctx):
    member = ctx.client("member_zj")
    product = ctx.ref("products", "product_letter_kit")
    pending = ctx.ref("claims", "custom")
    ctx.record(PREFIX + "consultation:pending", kind="consultation", id=pending, actor=member.name,
               title="家书共写纸笺包", stage="pending", fictional=True, reused=True)
    requests = (
        ("quoted", "青禾社区周末共写小组（虚构）", "希望为亲子共写活动设计一套带留言栏的家书纸笺，请先沟通纸张与排版方案。"),
        ("closed", "书林邻里阅读小组（虚构）", "希望了解家庭故事小册的封面设计与打样方式，先沟通规格，不涉及付款或配送。"),
        ("cancelled", "溪桥家书交流小组（虚构）", "希望咨询双语家书纸笺的排版方案，待活动计划确定后再决定是否继续沟通。"),
    )
    for key, organization, purpose in requests:
        claim = ctx.cmd(member, PREFIX + "consultation:" + key + ":create", "welfare.claim", product,
                        {"kind": "custom", "organization": organization, "quantity": 1, "purpose": purpose}, admin=False)
        claim_id = claim["id"]

        def follow(suffix, stage, note, **details):
            current = ctx.get(ctx.admin, f"/admin/consultations/{claim_id}")
            return ctx.post(ctx.admin, PREFIX + "consultation:" + key + ":" + suffix,
                            f"/admin/consultations/{claim_id}",
                            {"version": current["version"], "stage": stage, "note": note, **details})

        follow("accepted", "accepted", "已接收文字需求，后续在站内沟通具体用途与规格。")
        if key in ("quoted", "closed"):
            follow("quoted", "quoted", "已按目前沟通的规格记录人工参考报价，请核对服务范围。",
                   quoteAmount="180.00" if key == "quoted" else "260.00",
                   quoteDescription="仅含一版文字排版方案与一次样稿修改。此为虚构沟通报价，不构成付款、合同或物流承诺。")
        if key == "closed":
            follow("closed", "closed", "申请人确认本轮只需了解方案，咨询已结束。未生成商业订单，也未发生收费或物流。")
        elif key == "cancelled":
            ctx.cmd(member, PREFIX + "consultation:" + key + ":cancel", "welfare.cancel", claim_id, admin=False)
        final = ctx.get(member, f"/me/consultations/{claim_id}")
        ctx.record(PREFIX + "consultation:" + key, kind="consultation", id=claim_id, actor=member.name,
                   title=organization, stage=final["stage"], cancelled=final["cancelled"],
                   eventCount=len(final["events"]), fictional=True, scenario=key)


def seed(ctx):
    """Called only by the explicit non-AI dataset importer under its lifecycle lock."""
    _reviews(ctx)
    _regions(ctx)
    _consultations(ctx)
