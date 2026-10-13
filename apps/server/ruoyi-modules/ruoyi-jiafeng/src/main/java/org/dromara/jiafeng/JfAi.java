package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Durable jobs; every network/model call runs outside database transactions. */
@Service
public class JfAi {
  static final Set<String> MODES = Set.of("family", "letter", "polish", "knowledge", "support", "ocr", "review", "summary");
  private final JfStore store;
  private final JfAuth auth;
  private final JfSchema schema;
  private final JfFiles files;
  private final JfAiClient client;
  private final JfAiKnowledge knowledge;
  private final TransactionTemplate tx;
  private final ExecutorService workers = Executors.newFixedThreadPool(2);
  private final AtomicInteger busy = new AtomicInteger();

  public JfAi(JfStore store, JfAuth auth, JfSchema schema, JfFiles files, JfAiClient client,
      JfAiKnowledge knowledge, PlatformTransactionManager manager) {
    this.store = store; this.auth = auth; this.schema = schema; this.files = files;
    this.client = client; this.knowledge = knowledge; this.tx = new TransactionTemplate(manager);
  }

  @PreDestroy public void close() { workers.shutdownNow(); }

  public Object status() {
    var result = client.status();
    result.put("knowledgeCount", knowledge.count());
    return result;
  }

  public Object create(JfAuth.Actor actor, Map<String, Object> input, String key) {
    return tx.execute(transaction -> {
      var normalized = normalize(input);
      Object replay = store.idempotent(actor, "ai:create", key, normalized, () -> {
        boolean management = !str(normalized, "submissionId").isBlank();
        String region = actor.regions.stream().findFirst().orElse("all");
        if (management) {
          JfAccess.require(actor, "submissions:write");
          var submission = submission(actor, normalized, true);
          region = submission.region();
          // Only canonical current manuscript text is sent to review/summary models.
          normalized.put("text", str(submission.data(), "content"));
          normalized.put("title", str(submission.data(), "title"));
        }
        if (str(normalized, "mode").equals("ocr")) files.manuscriptMetadata(str(normalized, "fileId"), actor.id);
        return m("id", enqueue(actor, region, normalized, management));
      });
      return dto(actor, task(str(obj(replay), "id")), false);
    });
  }

  public Object index(JfAuth.Actor actor, String id, Map<String, Object> input, String key) {
    JfAccess.require(actor, "ai:write");
    require(actor.operator(), 403, "FORBIDDEN", "仅运营可建立知识索引");
    String audience = str(input, "audience");
    require(Set.of("public", "staff").contains(audience), 422, "INVALID_AUDIENCE", "请选择公开资料或内部资料");
    String language = str(input, "language").isBlank() ? "zh" : str(input, "language");
    require(Set.of("zh", "en").contains(language), 422, "INVALID_LANGUAGE", "语言无效");
    return tx.execute(transaction -> {
      // Do not automatically publicize uploaded staff documents: audience is mandatory.
      require(input.get("version") != null, 428, "VERSION_REQUIRED", "请提供资料版本");
      var request = m("mode", "index", "knowledgeId", id, "version", number(input.get("version")),
          "audience", audience, "language", language);
      Object result = store.idempotent(actor, "ai:index:" + id, key, request, () -> {
        var entity = knowledge.document(actor, id, input.get("version"), true);
        var pending = store.db().queryForList("SELECT id FROM jf_ai_task WHERE mode='index' AND status IN ('queued','running') AND JSON_UNQUOTE(JSON_EXTRACT(request,'$.knowledgeId'))=?", id);
        require(pending.isEmpty(), 409, "INDEX_IN_PROGRESS", "该资料正在建立索引，请稍后刷新");
        return m("id", enqueue(actor, entity.region(), request, true));
      });
      return dto(actor, task(str(obj(result), "id")), false);
    });
  }

  public Object withdraw(JfAuth.Actor actor, String id, Map<String, Object> input) {
    JfAccess.require(actor, "ai:write");
    return tx.execute(transaction -> {
      var entity = knowledge.document(actor, id, input.get("version"), true);
      var data = copy(entity.data());
      data.putAll(m("indexStatus", "withdrawn", "chunkCount", 0, "description", "知识资料已撤回，不再用于新的回答或历史回答展示。"));
      var saved = store.save(entity, entity.region(), "已撤回", data);
      store.db().update("DELETE FROM jf_ai_chunk WHERE document_id=?", id);
      store.db().update("UPDATE jf_ai_task SET status='failed',error_code='KNOWLEDGE_CHANGED',error_message='资料已撤回，请重新选择资料',completed_at=NOW(3) WHERE mode='index' AND status IN ('queued','running') AND JSON_UNQUOTE(JSON_EXTRACT(request,'$.knowledgeId'))=?", id);
      store.audit(actor, "ai.knowledge.withdraw", id, entity.region(), m("version", saved.version()));
      return m("status", "withdrawn", "version", saved.version());
    });
  }

  private String enqueue(JfAuth.Actor actor, String region, Map<String, Object> request, boolean management) {
    long own = store.db().queryForObject("SELECT COUNT(*) FROM jf_ai_task WHERE owner_id=? AND status IN ('queued','running')", Long.class, actor.id);
    long total = store.db().queryForObject("SELECT COUNT(*) FROM jf_ai_task WHERE status IN ('queued','running')", Long.class);
    require(own < 3 && total < 50, 429, "AI_QUEUE_FULL", "AI 任务较多，请等待现有任务完成");
    long recent = store.db().queryForObject("SELECT COUNT(*) FROM jf_ai_task WHERE owner_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)", Long.class, actor.id);
    require(recent < 60, 429, "AI_RATE_LIMIT", "本小时AI请求已达上限，请稍后再试");
    String id = id("ai_");
    store.db().update("INSERT INTO jf_ai_task(id,owner_id,region_id,mode,management,request) VALUES(?,?,?,?,?,?)",
        id, actor.id, region, request.get("mode"), management, json(request));
    store.audit(actor, "ai.queued", id, region, m("mode", request.get("mode"), "management", management));
    return id;
  }

  static Map<String, Object> normalize(Map<String, Object> input) {
    String mode = required(input, "mode", 1, 24);
    require(MODES.contains(mode), 422, "INVALID_AI_MODE", "AI应用类型无效");
    String language = str(input, "language").isBlank() ? "zh" : str(input, "language");
    require(Set.of("zh", "en").contains(language), 422, "INVALID_LANGUAGE", "语言无效");
    String prompt = required(input, "prompt", mode.equals("ocr") ? 0 : 1, 6000);
    String body = required(input, "text", 0, 15000);
    List<Object> history = new ArrayList<>();
    require(list(input.get("history")).size() <= 12, 422, "HISTORY_TOO_LONG", "请开启新一轮对话");
    int characters = 0;
    for (Object entry : list(input.get("history"))) {
      var message = obj(entry);
      String role = str(message, "role");
      require(Set.of("user", "assistant").contains(role), 422, "INVALID_HISTORY_ROLE", "对话历史角色无效");
      String content = required(message, "content", 1, 6000);
      characters += content.length();
      history.add(m("role", role, "content", content));
    }
    require(characters <= 16000, 422, "HISTORY_TOO_LONG", "对话过长，请开启新一轮对话");
    var result = m("mode", mode, "prompt", prompt, "text", body, "language", language, "history", history);
    String submission = str(input, "submissionId");
    if (!submission.isBlank()) {
      require(Set.of("review", "summary").contains(mode), 422, "INVALID_AI_SOURCE", "仅审核与摘要支持稿件来源");
      require(submission.length() <= 64 && input.get("version") != null, 428, "VERSION_REQUIRED", "请提供稿件版本");
      result.putAll(m("submissionId", submission, "version", number(input.get("version"))));
    }
    if (mode.equals("ocr")) result.put("fileId", required(input, "fileId", 1, 64));
    if (Set.of("polish", "review", "summary").contains(mode) && submission.isBlank())
      require(!body.isBlank() || !prompt.isBlank(), 422, "EMPTY_TEXT", "请输入需要处理的内容");
    return result;
  }

  JfStore.Entity submission(JfAuth.Actor actor, Map<String, Object> request, boolean lock) {
    JfAccess.require(actor, "submissions:read");
    var entity = store.find("submission", str(request, "submissionId"), lock);
    auth.operate(actor, entity.region());
    store.checkVersion(entity, request.get("version"));
    return entity;
  }

  public Object get(JfAuth.Actor actor, String id) { return dto(actor, task(id), false); }

  Map<String, Object> archive(JfAuth.Actor actor, Map<String, Object> data) {
    var clean = m("mode", required(data, "mode", 1, 24), "prompt", required(data, "prompt", 0, 6000),
        "result", required(data, "result", 1, 40000));
    if (str(data, "source").equals("model") || !str(data, "taskId").isBlank()) {
      var record = task(required(data, "taskId", 1, 64));
      require(number(record.get("owner_id")) == actor.id && !isManagement(record), 404, "NOT_FOUND", "AI任务不存在或不可见");
      var current = dto(actor, record, false);
      require(str(current, "status").equals("succeeded"), 409, "AI_RESULT_UNAVAILABLE", "AI结果未完成或依据已变化，请重新生成");
      String expected = switch (str(record, "mode")) {
        case "family" -> "rules"; case "support" -> "help"; case "review" -> "compliance";
        default -> str(record, "mode");
      };
      require(str(clean, "mode").equals(expected), 422, "AI_ARCHIVE_MODE", "存档类型与任务不一致");
      clean.putAll(m("source", "model", "taskId", record.get("id"), "model", str(current, "model"),
          "prompt", str(current, "prompt"), "citations", current.getOrDefault("citations", List.of()),
          "userEdited", !str(clean, "result").equals(str(current, "result")), "historicalSnapshot", true));
    } else clean.put("source", str(data, "source").equals("preset") ? "preset" : "rules");
    return clean;
  }

  void archiveView(JfAuth.Actor actor, Map<String, Object> archive) {
    if (!str(archive, "source").equals("model") || str(archive, "taskId").isBlank()) return;
    try {
      var row = task(str(archive, "taskId"));
      require(number(row.get("owner_id")) == actor.id && !isManagement(row), 404, "NOT_FOUND", "AI任务不可见");
      var current = dto(actor, row, false);
      require(str(current, "status").equals("succeeded"), 409, "AI_RESULT_UNAVAILABLE", "AI依据已变化");
      archive.put("historicalSnapshot", true);
    } catch (ApiException error) {
      archive.putAll(m("sourceExpired", true, "historicalSnapshot", true, "citations", List.of(),
          "result", "此存档的引用资料已更新、撤回或不再可见，原结果已停止展示。请重新提问。"));
    }
  }

  public Object listTasks(JfAuth.Actor actor, boolean administration) {
    if (administration) {
      JfAccess.require(actor, "ai:read");
      require(actor.operator(), 403, "FORBIDDEN", "仅运营可查看AI调用汇总");
    }
    List<Map<String, Object>> rows;
    if (!administration) rows = store.db().queryForList("SELECT * FROM jf_ai_task WHERE owner_id=? ORDER BY created_at DESC LIMIT 100", actor.id);
    else if (actor.national()) rows = store.db().queryForList("SELECT * FROM jf_ai_task ORDER BY created_at DESC LIMIT 200");
    else {
      if (actor.regions.isEmpty()) return m("items", List.of());
      String marks = String.join(",", Collections.nCopies(actor.regions.size(), "?"));
      rows = store.db().queryForList("SELECT * FROM jf_ai_task WHERE region_id IN (" + marks + ") ORDER BY created_at DESC LIMIT 200", actor.regions.toArray());
    }
    return m("items", rows.stream().filter(row -> administration || readable(actor, row))
        .map(row -> dto(actor, row, administration)).toList());
  }

  Map<String, Object> task(String id) {
    var rows = store.db().queryForList("SELECT * FROM jf_ai_task WHERE id=?", id);
    require(!rows.isEmpty(), 404, "NOT_FOUND", "任务不存在或不可见");
    return rows.getFirst();
  }

  static boolean isManagement(Map<String, Object> row) {
    return bool(row.get("management")) || "1".equals(text(row.get("management")));
  }

  static boolean readable(JfAuth.Actor actor, Map<String, Object> row) {
    return isManagement(row) ? actor.operator() && actor.region(str(row, "region_id"))
        && JfAccess.can(actor, str(row, "mode").equals("index") ? "ai:read" : "submissions:read")
        : actor.id == number(row.get("owner_id"));
  }

  Map<String, Object> dto(JfAuth.Actor actor, Map<String, Object> row, boolean summary) {
    boolean permitted = readable(actor, row);
    require(permitted || (summary && actor.operator() && JfAccess.can(actor, "ai:read") && actor.region(str(row, "region_id"))), 404, "NOT_FOUND", "任务不存在或不可见");
    var result = m("id", row.get("id"), "mode", row.get("mode"), "status", row.get("status"),
        "createdAt", timestamp(row.get("created_at")), "regionId", row.get("region_id"));
    if (row.get("completed_at") != null) result.put("completedAt", timestamp(row.get("completed_at")));
    if (!permitted || (summary && !isManagement(row))) {
      // Regional operators receive operational metadata, never private input, title, file IDs or output.
      result.put("redacted", true);
      return result;
    }
    var request = parse(text(row.get("request")));
    if (actor.id == number(row.get("owner_id")) && !summary && !isManagement(row)) {
      for (String key : List.of("prompt", "text", "fileId", "language"))
        if (request.containsKey(key)) result.put(key, request.get(key));
    }
    if (!str(request, "submissionId").isBlank()) {
      try { submission(actor, request, false); }
      catch (ApiException error) { return stale(result, "SOURCE_CHANGED", "稿件版本或访问权限已变化，请重新运行AI辅助"); }
      result.putAll(m("submissionId", request.get("submissionId"), "sourceVersion", request.get("version")));
    }
    if (row.get("sources") != null && !knowledge.valid(actor, jsonList(row.get("sources"))))
      return stale(result, "KNOWLEDGE_CHANGED", "引用资料已更新或撤回，请重新提问");
    if (row.get("response") != null) {
      var response = parse(text(row.get("response")));
      for (String field : List.of("result", "model", "citations", "issues", "similarities", "warnings", "usage", "promptVersion"))
        if (response.containsKey(field)) result.put(field, response.get(field));
    }
    if (str(row, "status").equals("failed")) result.put("error", m("code", row.get("error_code"), "message", row.get("error_message")));
    return result;
  }

  private static Map<String, Object> stale(Map<String, Object> result, String code, String message) {
    result.put("status", "failed"); result.put("error", m("code", code, "message", message)); return result;
  }

  private static List<Object> jsonList(Object value) {
    return list(org.dromara.common.json.utils.JsonUtils.parseObject(text(value), List.class));
  }

  @Scheduled(initialDelay = 12000, fixedDelay = 1000)
  public void dispatch() {
    if (!schema.ready()) return;
    // Failed leases are visible and require explicit retry; never silently double-charge a model call.
    store.db().update("UPDATE jf_ai_task SET status='failed',error_code='AI_INTERRUPTED',error_message='任务超时或服务曾重启，请重新提交',completed_at=NOW(3) WHERE status='running' AND started_at<DATE_SUB(NOW(),INTERVAL 4 MINUTE)");
    store.db().update("UPDATE jf_ai_task SET status='failed',error_code='AI_QUEUE_TIMEOUT',error_message='等待处理超时，请重新提交',completed_at=NOW(3) WHERE status='queued' AND created_at<DATE_SUB(NOW(),INTERVAL 20 MINUTE)");
    while (busy.get() < 2) {
      String id = tx.execute(transaction -> {
        var rows = store.db().queryForList("SELECT id FROM jf_ai_task WHERE status='queued' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED");
        if (rows.isEmpty()) return null;
        String claimed = str(rows.getFirst(), "id");
        store.db().update("UPDATE jf_ai_task SET status='running',started_at=NOW(3) WHERE id=? AND status='queued'", claimed);
        return claimed;
      });
      if (id == null) return;
      busy.incrementAndGet();
      workers.submit(() -> { try { execute(id); } finally { busy.decrementAndGet(); } });
    }
  }

  void execute(String id) {
    try {
      var row = task(id);
      var actor = auth.byId(number(row.get("owner_id")));
      var request = parse(text(row.get("request")));
      if (str(row, "mode").equals("index")) { executeIndex(actor, row, request); return; }
      if (!str(request, "submissionId").isBlank()) {
        JfAccess.require(actor, "submissions:write");
        submission(actor, request, false);
      }
      var terms = terms(actor);
      String original = str(request, "prompt") + "\n" + str(request, "text");
      boolean review = str(request, "mode").equals("review");
      require(review || !blocked(original, terms), 422, "AI_CONTENT_BLOCKED", "输入触发平台拦截词，请调整后重试");
      List<JfAiKnowledge.Context> contexts = new ArrayList<>();
      if (Set.of("knowledge", "support").contains(str(request, "mode")))
        contexts.addAll(knowledge.retrieve(actor, str(request, "prompt"), str(request, "language"), str(request, "mode").equals("support")));
      List<Map<String, Object>> similarities = List.of();
      if (str(request, "mode").equals("review")) similarities = similarities(actor, request, contexts);
      var payload = copy(request);
      payload.remove("submissionId"); payload.remove("version"); payload.remove("fileId");
      payload.put("contexts", contexts.stream().map(JfAiKnowledge.Context::wire).toList());
      payload.put("terms", terms);
      if (str(request, "mode").equals("ocr")) payload.put("file", files.aiFile(str(request, "fileId"), actor.id, false));
      var response = client.call("generate", payload);
      String result = required(response, "result", 1, 100000);
      require(review || !blocked(result, terms), 422, "AI_OUTPUT_BLOCKED", "生成内容触发平台拦截，结果未展示，请调整后重试");
      List<Object> sources = new ArrayList<>(contexts.stream().map(JfAiKnowledge.Context::source).toList());
      var issues = new ArrayList<>(safeIssues(response.get("issues")));
      if (review) for (var term : terms) {
        if (!str(term, "term").isBlank() && original.toLowerCase(Locale.ROOT).contains(str(term, "term").toLowerCase(Locale.ROOT)))
          issues.add(m("severity", "medium", "quote", str(term, "term"), "reason", "命中平台词库（" + str(term, "action") + "），请结合上下文人工核对。"));
      }
      var warnings = new ArrayList<>(safeWarnings(response.get("warnings")));
      if (review) warnings.add("相似度为授权语料中的文字片段重合提示，不构成抄袭或获奖判定；最终审核由人工决定。");
      var output = m("result", result, "model", str(response, "model"), "issues", issues,
          "similarities", similarities, "citations", contexts.stream().map(c -> m("id", c.id(), "title", c.title(), "excerpt", JfAiKnowledge.cut(c.text(), 240), "url", c.url())).toList(),
          "warnings", warnings, "usage", safeUsage(response.get("usage")),
          "promptVersion", JfAiKnowledge.cut(str(response, "promptVersion"), 100));
      complete(actor, row, request, output, sources);
    } catch (ApiException error) { fail(id, error.code, error.getMessage()); }
    catch (Exception error) { fail(id, "AI_PROCESSING_FAILED", "AI任务处理失败，请稍后重试"); }
  }

  private void executeIndex(JfAuth.Actor actor, Map<String, Object> row, Map<String, Object> request) {
    var entity = knowledge.document(actor, str(request, "knowledgeId"), request.get("version"), false);
    var fileInfo = files.info(str(entity.data(), "fileId"));
    // The document authorization above permits staff to index its explicitly attached source.
    var file = files.aiFile(str(entity.data(), "fileId"), number(fileInfo.get("owner_id")), true);
    var response = client.call("extract", m("file", file));
    String body = required(response, "text", 1, 500000);
    tx.executeWithoutResult(transaction -> {
      var active = task(str(row, "id"));
      if (!str(active, "status").equals("running")) return;
      var currentActor = auth.byId(actor.id);
      var current = knowledge.document(currentActor, entity.id(), request.get("version"), true);
      knowledge.indexed(current, body, str(request, "audience"), str(request, "language"));
      var output = m("result", "资料已解析并建立检索分块；" + (str(request, "audience").equals("public") ? "公开用户可以检索引用。" : "仅授权运营可检索引用。"),
          "model", str(response, "model"), "warnings", safeWarnings(response.get("warnings")),
          "usage", safeUsage(response.get("usage")), "promptVersion", JfAiKnowledge.cut(str(response, "promptVersion"), 100));
      store.db().update("UPDATE jf_ai_task SET status='succeeded',response=?,completed_at=NOW(3) WHERE id=? AND status='running'", json(output), row.get("id"));
      log(currentActor, row, output, "succeeded");
    });
  }

  private void complete(JfAuth.Actor actor, Map<String, Object> row, Map<String, Object> request,
      Map<String, Object> response, List<Object> sources) {
    tx.executeWithoutResult(transaction -> {
      var current = auth.byId(actor.id);
      if (!str(request, "submissionId").isBlank()) {
        JfAccess.require(current, "submissions:write");
        submission(current, request, true);
      }
      require(knowledge.valid(current, sources), 409, "KNOWLEDGE_CHANGED", "引用资料已更新或撤回，请重新提问");
      int changed = store.db().update("UPDATE jf_ai_task SET status='succeeded',response=?,sources=?,completed_at=NOW(3) WHERE id=? AND status='running'",
          json(response), json(sources), row.get("id"));
      if (changed == 1) log(current, row, response, "succeeded");
    });
  }

  private void fail(String id, String code, String message) {
    tx.executeWithoutResult(transaction -> {
      var row = task(id);
      int changed = store.db().update("UPDATE jf_ai_task SET status='failed',error_code=?,error_message=?,completed_at=NOW(3) WHERE id=? AND status='running'", code, JfAiKnowledge.cut(message, 255), id);
      if (changed == 1) {
        try { log(auth.byId(number(row.get("owner_id"))), row, m("result", message), "failed"); }
        catch (ApiException ignored) { /* Disabled account still retains its durable failure record. */ }
      }
    });
  }

  private void log(JfAuth.Actor actor, Map<String, Object> row, Map<String, Object> output, String status) {
    // Existing admin workspace consumes metadata-only logs. Full admin results use authorized tasks.
    store.create("aiLog", actor.id, str(row, "region_id"), status,
        m("user", isManagement(row) ? "运营任务" : "私人调用", "region", regionName(str(row, "region_id")),
            "mode", row.get("mode"), "time", now(), "status", status.equals("succeeded") ? "成功" : "失败",
            "input", "输入内容按本人或稿件权限保留", "output", "请从授权任务查看结果", "source", "真实AI服务调用",
            "model", str(output, "model"), "usage", output.getOrDefault("usage", m()),
            "promptVersion", str(output, "promptVersion"), "taskId", row.get("id")));
    store.audit(actor, "ai." + status, str(row, "id"), str(row, "region_id"), m("mode", row.get("mode")));
  }

  private List<Map<String, Object>> terms(JfAuth.Actor actor) {
    return store.all("dictionary").stream().filter(e -> bool(e.data().get("enabled")))
        .filter(e -> e.region().equals("all") || actor.region(e.region()))
        .limit(200).map(e -> m("term", str(e.data(), "word"), "action", str(e.data(), "action"))).toList();
  }

  static boolean blocked(String text, List<Map<String, Object>> terms) {
    String value = text.toLowerCase(Locale.ROOT);
    return terms.stream().anyMatch(term -> Set.of("拦截", "拦截提示", "阻止", "禁止", "自动拦截", "block").contains(str(term, "action"))
        && !str(term, "term").isBlank() && value.contains(str(term, "term").toLowerCase(Locale.ROOT)));
  }

  static List<Map<String, Object>> safeIssues(Object raw) {
    return list(raw).stream().limit(30).map(Jf::obj).map(i -> m("severity",
        Set.of("low", "medium", "high").contains(str(i, "severity")) ? str(i, "severity") : "medium",
        "quote", JfAiKnowledge.cut(str(i, "quote"), 1000), "reason", JfAiKnowledge.cut(str(i, "reason"), 2000))).toList();
  }

  static List<String> safeWarnings(Object raw) {
    return list(raw).stream().limit(10).map(Jf::text).map(w -> JfAiKnowledge.cut(w, 500)).toList();
  }

  static Map<String, Object> safeUsage(Object raw) {
    var result = m();
    for (String field : List.of("prompt_tokens", "completion_tokens", "total_tokens", "input_tokens", "output_tokens")) {
      Object value = obj(raw).get(field);
      if (value instanceof Number n && n.longValue() >= 0 && n.longValue() <= Integer.MAX_VALUE)
        result.put(field, n.longValue());
    }
    return result;
  }

  private List<Map<String, Object>> similarities(JfAuth.Actor actor, Map<String, Object> request,
      List<JfAiKnowledge.Context> contexts) {
    String body = str(request, "text").isBlank() ? str(request, "prompt") : str(request, "text");
    List<Map.Entry<JfStore.Entity, Double>> ranked = new ArrayList<>();
    for (var entity : store.all("submission")) {
      if (entity.id().equals(str(request, "submissionId"))) continue;
      if (!JfSubmissions.isPublic(entity) && !(actor.operator() && JfAccess.can(actor, "submissions:read") && actor.region(entity.region()))) continue;
      double score = similarity(body, str(entity.data(), "content"));
      if (score >= 0.2) ranked.add(Map.entry(entity, score));
    }
    ranked.sort(Map.Entry.<JfStore.Entity, Double>comparingByValue().reversed());
    List<Map<String, Object>> results = new ArrayList<>();
    for (var hit : ranked.stream().limit(5).toList()) {
      var entity = hit.getKey();
      String excerpt = JfAiKnowledge.cut(str(entity.data(), "content"), 500);
      results.add(m("id", entity.id(), "title", str(entity.data(), "title"), "excerpt", excerpt,
          "score", Math.round(hit.getValue() * 1000.0) / 1000.0));
      contexts.add(new JfAiKnowledge.Context(entity.id(), str(entity.data(), "title"), excerpt,
          "submission", entity.id(), entity.version(), "", JfSubmissions.isPublic(entity) ? "public" : "staff", entity.region()));
    }
    return results;
  }

  static double similarity(String first, String second) {
    var a = grams(first); var b = grams(second);
    if (a.isEmpty() || b.isEmpty()) return 0;
    long overlap = a.stream().filter(b::contains).count();
    return 2.0 * overlap / (a.size() + b.size());
  }

  private static Set<String> grams(String text) {
    String clean = text.toLowerCase(Locale.ROOT).replaceAll("[\\p{P}\\p{Z}\\s]", "");
    Set<String> grams = new HashSet<>();
    for (int i = 0; i + 3 <= clean.length(); i++) grams.add(clean.substring(i, i + 3));
    return grams;
  }
}
