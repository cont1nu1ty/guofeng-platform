package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JfSubmissions {
  private final JfStore store;
  private final JfAuth auth;
  private final JfFiles files;
  private final JfRubrics rubrics;
  private final JfReviewProgress reviewProgress;

  public JfSubmissions(JfStore s, JfAuth a, JfFiles f, JfRubrics rubrics, JfReviewProgress reviewProgress) {
    store = s;
    auth = a;
    files = f;
    this.rubrics = rubrics;
    this.reviewProgress = reviewProgress;
  }

  public record Draft(Map<String, Object> data, long version) {}

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Draft getDraft() {
    var a = auth.require();
    store.db().update("INSERT IGNORE INTO jf_draft(user_id) VALUES(?)", a.id);
    var r = store.db().queryForMap("SELECT payload,version FROM jf_draft WHERE user_id=?", a.id);
    return new Draft(
        r.get("payload") == null ? null : parse(text(r.get("payload"))), number(r.get("version")));
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Draft saveDraft(Map<String, Object> value, String match) {
    var a = auth.require();
    getDraft();
    var r = store.db().queryForMap("SELECT version FROM jf_draft WHERE user_id=? FOR UPDATE", a.id);
    match(number(r.get("version")), match);
    Map<String, Object> clean = value == null ? null : validate(value, a, false);
    store
        .db()
        .update(
            "UPDATE jf_draft SET payload=?,version=version+1,updated_at=NOW() WHERE user_id=?",
            clean == null ? null : json(clean),
            a.id);
    return new Draft(clean, number(r.get("version")) + 1);
  }

  public static void match(long version, String match) {
    require(match != null, 428, "VERSION_REQUIRED", "缺少 If-Match 版本");
    require(
        ('"' + Long.toString(version) + '"').equals(match),
        412,
        "VERSION_CONFLICT",
        "云端记录已更新，请重新读取后确认修改");
  }

  private Map<String, Object> validate(Map<String, Object> data, JfAuth.Actor a, boolean submit) {
    Map<String, Object> d = new LinkedHashMap<>();
    d.put("title", required(data, "title", submit ? 2 : 0, 50));
    d.put("content", required(data, "content", submit ? 20 : 0, 10000));
    String r = region(data.getOrDefault("region", "all"));
    if (submit)
      require(
          !r.equals("all") && (a.national() || a.regions.contains(r)),
          422,
          "INVALID_REGION",
          "投稿地区须属于当前账号获准范围");
    d.put("region", r);
    d.put("author", str(data, "author").isBlank() ? a.name : required(data, "author", 0, 100));
    String genre = str(data, "genre"), channel = str(data, "channel");
    require(
        List.of(
                "letter",
                "essay",
                "poetry",
                "memoir",
                "biography",
                "family-rules",
                "family-notes",
                "commentary")
            .contains(genre),
        422,
        "INVALID_GENRE",
        "请选择有效体裁");
    require(
        List.of("public-service", "school", "community", "special").contains(channel),
        422,
        "INVALID_CHANNEL",
        "请选择投稿通道");
    d.put("genre", genre);
    d.put("channel", channel);
    List<Object> themes = list(data.get("themes"));
    require(
        themes.size() <= 3
            && themes.stream()
                .allMatch(
                    x ->
                        List.of(
                                "integrity",
                                "filial",
                                "neighbor",
                                "patriotism",
                                "heritage",
                                "family-history")
                            .contains(text(x))),
        422,
        "INVALID_THEMES",
        "请选择不超过三个有效主题");
    d.put("themes", themes);
    d.put("tags", themes);
    boolean accepted = bool(data.get("copyrightAccepted"));
    require(!submit || accepted, 422, "AGREEMENT_REQUIRED", "请确认版权声明");
    d.put("copyrightAccepted", accepted);
    d.put("agreementVersion", "jiafeng-pilot-1");
    if (submit) d.put("agreementAcceptedAt", now());
    String overseas = required(data, "overseasLocation", 0, 150);
    require(
        !submit || !r.equals("overseas") || overseas.length() >= 2,
        422,
        "OVERSEAS_LOCATION_REQUIRED",
        "请填写海外国家和城市");
    d.put("overseasLocation", overseas);
    if (data.containsKey("contentDelta")) {
      Map<String, Object> delta = obj(data.get("contentDelta"));
      List<Object> ops = list(delta.get("ops"));
      require(!ops.isEmpty() && ops.size() <= 10000, 422, "INVALID_RICH_TEXT", "富文本格式无效");
      StringBuilder plain = new StringBuilder();
      for (Object item : ops) {
        Map<String, Object> op = obj(item);
        require(op.get("insert") instanceof String, 422, "INVALID_RICH_TEXT", "富文本仅允许文本");
        require(
            op.keySet().stream().allMatch(k -> Set.of("insert", "attributes").contains(k)),
            422,
            "INVALID_RICH_TEXT",
            "富文本操作不允许");
        plain.append(str(op, "insert"));
        Map<String, Object> attrs = obj(op.get("attributes"));
        for (var entry : attrs.entrySet()) {
          String key = entry.getKey();
          Object v = entry.getValue();
          require(
              Set.of("bold", "italic", "underline", "header", "list").contains(key),
              422,
              "INVALID_RICH_TEXT",
              "包含不允许的富文本样式");
          if (Set.of("bold", "italic", "underline").contains(key))
            require(v instanceof Boolean, 422, "INVALID_RICH_TEXT", "样式值无效");
          else if (key.equals("header"))
            require(List.of(2L, 3L).contains(number(v)), 422, "INVALID_RICH_TEXT", "标题层级无效");
          else
            require(List.of("ordered", "bullet").contains(v), 422, "INVALID_RICH_TEXT", "列表格式无效");
        }
      }
      require(
          plain.toString().stripTrailing().equals(str(d, "content").stripTrailing()),
          422,
          "CONTENT_MISMATCH",
          "正文与富文本不一致");
      d.put("contentDelta", delta);
    }
    List<Object> attachments = list(data.get("attachments"));
    require(attachments.size() <= 5, 422, "TOO_MANY_FILES", "每篇作品最多五个附件");
    List<Object> clean = new ArrayList<>();
    for (Object item : attachments) {
      Map<String, Object> f = obj(item);
      String fid = str(f, "fileId");
      if (fid.isEmpty()) fid = str(f, "id");
      clean.add(files.manuscriptMetadata(fid, a.id));
    }
    d.put("attachments", clean);
    if (data.containsKey("editingWorkId")) d.put("editingWorkId", str(data, "editingWorkId"));
    return d;
  }

  /** Offline provenance is not an author's agreement. Only text is imported in this workflow. */
  public Map<String, Object> validateOffline(Map<String, Object> input, JfAuth.Actor owner) {
    var fields = copy(input);
    fields.put("copyrightAccepted", false);
    fields.put("attachments", List.of());
    fields.remove("contentDelta");
    fields.remove("editingWorkId");
    var clean = validate(fields, owner, false);
    clean.put("title", required(input, "title", 2, 50));
    clean.put("content", required(input, "content", 20, 10000));
    require(!str(clean, "region").equals("all") && owner.region(str(clean, "region")), 422, "INVALID_REGION", "归集地区须属于接收账号获准范围");
    require(!str(clean, "region").equals("overseas") || str(clean, "overseasLocation").length() >= 2, 422, "OVERSEAS_LOCATION_REQUIRED", "海外稿件须填写国家和城市");
    clean.put("source", "线下归集");
    clean.put("sourceRef", required(input, "sourceRef", 1, 100));
    clean.put("sourceName", required(input, "sourceName", 1, 100));
    clean.put("copyrightAccepted", false);
    clean.put("requiresAuthorConfirmation", true);
    clean.remove("agreementAcceptedAt");
    return clean;
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object submit(Map<String, Object> input, String submissionId, String key, String match) {
    var a = auth.require();
    return store.idempotent(
        a,
        "submit:" + Objects.toString(submissionId, "new"),
        key,
        input,
        () -> {
          Map<String, Object> d = validate(input, a, true);
          Map<String, Object> submittedDraft = copy(d);
          JfStore.Entity existing = null;
          if (submissionId != null) {
            existing = store.find("submission", submissionId, true);
            require(Objects.equals(a.id, existing.owner()), 404, "NOT_FOUND", "稿件不存在或不可见");
            match(existing.version(), match);
            require(existing.status().equals("returned"), 409, "INVALID_STATE", "只有退回稿件可重新提交");
            for (String source : List.of("source", "sourceName", "sourceRef"))
              if (existing.data().containsKey(source)) d.put(source, existing.data().get(source));
          }
          int revision =
              existing == null ? 1 : (int) number(existing.data().get("revisionNumber")) + 1;
          d.putAll(
              m(
                  "revisionNumber",
                  revision,
                  "progressIndex",
                  0,
                  "decision",
                  "undecided",
                  "published",
                  false,
                  "submittedAt",
                  now(),
                  "reviews",
                  existing == null ? List.of() : existing.data().getOrDefault("reviews", List.of()),
                  "history",
                  existing == null
                      ? new ArrayList<>()
                      : new ArrayList<>(list(existing.data().get("history")))));
          List<Object> history = list(d.get("history"));
          history.add(
              m(
                  "time",
                  now(),
                  "action",
                  existing == null ? "提交作品" : "修改后重新提交",
                  "actor",
                  a.name,
                  "note",
                  "已受理，等待初审",
                  "revision",
                  revision));
          JfStore.Entity result =
              existing == null
                  ? store.create("submission", a.id, str(d, "region"), "pending_initial_review", d)
                  : store.save(existing, str(d, "region"), "pending_initial_review", d);
          String revId = id("rev_");
          var reviewSnapshot = JfRubrics.snapshot(store.find("setting", "reviewFlow", true).data());
          d.put("flowSnapshot", reviewSnapshot);
          store
              .db()
              .update(
                  "INSERT INTO jf_revision(id,submission_id,revision_number,payload)"
                      + " VALUES(?,?,?,?)",
                  revId,
                  result.id(),
                  revision,
                  json(d));
          rubrics.bind(revId, reviewSnapshot, "submission");
          for (Object item : list(d.get("attachments")))
            store
                .db()
                .update(
                    "INSERT INTO jf_revision_file(revision_id,file_id) VALUES(?,?)",
                    revId,
                    str(obj(item), "fileId"));
          d.put("revisionId", revId);
          result = store.save(result, result.region(), result.status(), d);
          store.audit(
              a,
              "submit",
              result.id(),
              result.region(),
              m("revisionId", revId, "revisionNumber", revision));
          clearMatchingDraft(a.id, submittedDraft);
          return work(result, a);
        });
  }

  private void clearMatchingDraft(long owner, Map<String, Object> submitted) {
    var rows =
        store
            .db()
            .queryForList("SELECT payload,version FROM jf_draft WHERE user_id=? FOR UPDATE", owner);
    if (rows.isEmpty() || rows.getFirst().get("payload") == null) return;
    var saved = parse(text(rows.getFirst().get("payload")));
    for (String transientField : List.of("agreementAcceptedAt", "copyrightAccepted")) {
      saved.remove(transientField);
      submitted.remove(transientField);
    }
    if (saved.equals(submitted))
      store
          .db()
          .update(
              "UPDATE jf_draft SET payload=NULL,version=version+1,updated_at=NOW() WHERE user_id=?",
              owner);
  }

  public static boolean isPublic(JfStore.Entity e) {
    return bool(e.data().get("published"))
        && Set.of("shortlisted", "awarded", "collected").contains(e.status());
  }

  public static String statusLabel(String s) {
    return switch (s) {
      case "pending_initial_review" -> "待初审";
      case "in_review" -> "评审中";
      case "returned" -> "退回修改";
      case "shortlisted" -> "已入围";
      case "awarded" -> "已获奖";
      case "collected" -> "已入藏";
      case "rejected" -> "未入围";
      default -> s;
    };
  }

  public Map<String, Object> work(JfStore.Entity e, JfAuth.Actor a) {
    boolean mine = a != null && Objects.equals(a.id, e.owner());
    Map<String, Object> d = copy(e.data());
    d.putAll(
        m(
            "id",
            e.id(),
            "region",
            e.region(),
            "version",
            e.version(),
            "lockVersion",
            e.version(),
            "status",
            e.status(),
            "statusLabel",
            statusLabel(e.status()),
            "isMine",
            mine,
            "isDemo",
            false,
            "excerpt",
            str(e.data(), "content")
                .substring(0, Math.min(100, str(e.data(), "content").length()))));
    d.remove("blindContent");
    d.remove("blindConfirmed");
    d.remove("flowSnapshot");
    // Authors receive the evaluation, never the expert identity or internal staff history.
    if (mine) {
      d.put("reviews", list(d.get("reviews")).stream().map(raw -> {
        var review = copy(obj(raw)); review.put("reviewer", "匿名评审专家"); return review;
      }).toList());
      d.put("history", list(d.get("history")).stream().map(raw -> {
        var history = copy(obj(raw)); history.remove("actor"); return history;
      }).toList());
    }
    for (String internal :
        List.of("blindPreparedBy", "flowInstanceId", "reviewManagerId", "revisionId", "importedBy"))
      d.remove(internal);
    if (!mine && (a == null || !a.operator() || !a.region(e.region()))) {
      Set<String> publicFields =
          Set.of(
              "id",
              "title",
              "author",
              "content",
              "contentDelta",
              "genre",
              "channel",
              "themes",
              "tags",
              "region",
              "version",
              "lockVersion",
              "revisionNumber",
              "status",
              "statusLabel",
              "isMine",
              "isDemo",
              "excerpt",
              "published",
              "submittedAt");
      d.keySet().removeIf(k -> !publicFields.contains(k));
    }
    return d;
  }

  public Map<String, Object> progress(String id) {
    var a = auth.require();
    var e = store.find("submission", id, false);
    auth.ownOrOperate(a, e);
    if (!Objects.equals(a.id, e.owner())) JfAccess.require(a, "submissions:read");
    var result = work(e, a);
    List<Object> revisions = new ArrayList<>();
    for (var row :
        store
            .db()
            .queryForList(
                "SELECT id,revision_number,payload,created_at FROM jf_revision WHERE"
                    + " submission_id=? ORDER BY revision_number",
                id))
      revisions.add(
          m(
              "id",
              row.get("id"),
              "revisionNumber",
              row.get("revision_number"),
              "content",
              reviewProgress.revisionContent(parse(text(row.get("payload")))),
              "createdAt",
              timestamp(row.get("created_at"))));
    return m("work", result, "revisions", revisions, "timeline", reviewProgress.current(e),
        "revisionTimelines", reviewProgress.revisions(e));
  }
}
