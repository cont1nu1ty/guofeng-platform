package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Rebuildable public projection. MySQL is authoritative; lagging or unverified indexes never
 * produce hits, totals or facets. Private fields cannot enter ES through this whitelist.
 */
@Service
@EnableScheduling
public class JfSearch {
  private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(JfSearch.class);
  static final String ALIAS = "jiafeng-public";
  static final String FORMAT = "jiafeng-public-v1";
  public static final List<String> ENTITY_KINDS =
      List.of("submission", "content", "collection", "activity", "course", "media", "hallPerson", "product", "venue");
  static final List<String> KINDS =
      List.of("work", "news", "classic", "activity", "course", "video", "hall", "product", "venue");
  private static final List<String> SCREENS =
      List.of("library", "news", "library", "learning", "classroom", "media", "hall", "shop", "venues");
  private final JfStore store;
  private final JfSchema schema;
  private final TransactionTemplate snapshotTransaction;
  private final RestClient client;
  private final boolean configured;
  private final AtomicBoolean running = new AtomicBoolean();
  private String lastFailure = "";

  public JfSearch(
      JfStore store,
      JfSchema schema,
      PlatformTransactionManager transactions,
      @Value("${JIAFENG_SEARCH_ENDPOINT:}") String endpoint,
      @Value("${JIAFENG_SEARCH_USERNAME:elastic}") String username,
      @Value("${JIAFENG_SEARCH_PASSWORD:}") String password) {
    this.store = store;
    this.schema = schema;
    this.snapshotTransaction = new TransactionTemplate(transactions);
    snapshotTransaction.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    snapshotTransaction.setReadOnly(true);
    configured = !endpoint.isBlank() && !password.isBlank();
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(3));
    factory.setReadTimeout(Duration.ofSeconds(15));
    client = RestClient.builder().baseUrl(endpoint.isBlank() ? "http://search:9200" : endpoint)
        .requestFactory(factory).defaultHeaders(h -> h.setBasicAuth(username, password)).build();
  }

  record State(long committed, long indexed, String name, String uuid, String installation,
      String secret, boolean rebuild, String status, String lastError) {}

  private State state() {
    var row = store.db().queryForMap("SELECT * FROM jf_search_state WHERE id=1");
    Object rebuild = row.get("rebuild_requested");
    return new State(number(row.get("committed_generation")), number(row.get("indexed_generation")),
        text(row.get("index_name")), text(row.get("index_uuid")), text(row.get("installation_id")),
        text(row.get("cursor_secret")), bool(rebuild) || "1".equals(text(rebuild)),
        text(row.get("status")), text(row.get("last_error")));
  }

  /** No inherited ownership, notes, attachment IDs, revision snapshots or author contacts. */
  static Map<String, Object> document(JfStore.Entity e) {
    int index = ENTITY_KINDS.indexOf(e.kind());
    if (index < 0 || !publicEntity(e)) return null;
    Map<String, Object> p = e.data();
    String lang = language(str(p, "language"));
    String title = localized(p.get("title"), lang);
    if (title.isBlank() && e.kind().equals("hallPerson")) title = localized(p.get("name"), lang);
    String summary = switch (e.kind()) {
      case "submission" -> localized(p.get("content"), lang);
      case "collection" -> localized(p.get("subtitle"), lang);
      case "content", "activity", "product" -> localized(p.get("summary"), lang);
      case "course", "venue" -> localized(p.get("description"), lang);
      case "hallPerson" -> localized(p.get("introduction"), lang);
      default -> localized(p.get("excerpt"), lang);
    };
    if (summary.isBlank()) summary = localized(p.get("excerpt"), lang);
    List<String> parts = new ArrayList<>();
    List<String> fields = switch (e.kind()) {
      case "submission" -> List.of("content", "genre", "themes", "tags");
      case "content" -> List.of("body", "paragraphs", "category");
      case "collection" -> List.of("subtitle", "theme");
      case "activity" -> List.of("summary", "location", "type");
      case "course" -> List.of("description", "theme", "audience");
      case "media" -> List.of("excerpt", "transcript", "category", "collection");
      case "hallPerson" -> List.of("introduction", "era", "theme", "book", "quote", "notes", "sourceTitle");
      case "product" -> List.of("description", "summary", "name", "category");
      case "venue" -> List.of("description", "city", "address", "hours", "highlights", "stops", "visitorNotice");
      default -> List.of();
    };
    for (String field : fields) parts.add(localized(p.get(field), lang));
    String children = e.kind().equals("collection") ? "chapters" : e.kind().equals("course") ? "lessons" : "";
    if (!children.isEmpty())
      for (Object child : list(p.get(children))) {
        var c = obj(child);
        parts.add(localized(c.get("title"), lang));
        parts.add(localized(c.get("body"), lang));
      }
    return m("id", KINDS.get(index) + ":" + e.id(), "kind", KINDS.get(index),
        "screen", SCREENS.get(index), "contentId", e.id(), "region", e.region(), "language", lang,
        "title", truncate(title, 1000), "summary", truncate(summary, 240),
        "body", truncate(String.join("\n", parts), 200000));
  }

  static boolean publicEntity(JfStore.Entity e) {
    return switch (e.kind()) {
      case "submission" -> JfSubmissions.isPublic(e);
      case "collection" -> e.status().equals("已入藏");
      case "activity" -> Set.of("报名中", "进行中", "已结束").contains(e.status());
      case "course", "product" -> e.status().equals("已上架");
      case "content", "media", "hallPerson", "venue" -> e.status().equals("已发布");
      default -> false;
    };
  }

  static String language(String value) {
    return Set.of("en", "English", "英文").contains(value) ? "en" : "zh";
  }

  private static String localized(Object value, String language) {
    if (value instanceof Map) return localized(obj(value).get(language), language);
    if (value instanceof List)
      return String.join("\n", list(value).stream().map(v -> localized(v, language)).toList());
    return value instanceof String || value instanceof Number ? text(value) : "";
  }

  private static String truncate(String value, int maximum) {
    return value.substring(0, Math.min(value.length(), maximum));
  }

  public Map<String, Object> search(String rawQuery, String kind, String region, String language,
      String cursor, int pageSize) {
    String query = rawQuery.trim();
    require(query.codePointCount(0, query.length()) <= 200, 422, "INVALID_QUERY", "搜索词不能超过200字");
    require(kind.equals("all") || KINDS.contains(kind), 422, "INVALID_KIND", "搜索分类无效");
    require(region.equals("all") || REGION_IDS.contains(region), 422, "INVALID_REGION", "搜索地区无效");
    require(Set.of("zh", "en").contains(language), 422, "INVALID_LANGUAGE", "搜索语言无效");
    require(pageSize >= 1 && pageSize <= 50, 422, "INVALID_PAGE_SIZE", "每页数量须为1至50");
    require(configured && schema.ready(), 503, "SEARCH_UPDATING", "搜索索引暂不可用，请稍后重试");
    State before = state();
    String fingerprint = hash(json(List.of(query, kind, region, language, pageSize)));
    List<Object> after = decodeCursor(cursor, before, fingerprint);
    requireReady(before);
    Map<String, Object> found;
    Identity identity;
    try {
      identity = identity();
      requireIdentity(before, identity);
      var body = query(query, kind, region, language, pageSize, after);
      found = es("POST", "/" + before.name + "/_search?allow_partial_search_results=false&request_cache=false", body);
      require(!bool(found.get("timed_out")) && number(obj(found.get("_shards")).getOrDefault("failed", 0)) == 0,
          503, "SEARCH_UPDATING", "搜索暂不可用，请稍后重试");
      // Check both durable generations and actual ES identity again before returning any data.
      var endIdentity = identity();
      State end = state();
      requireReady(end);
      requireIdentity(end, endIdentity);
      require(before.committed == end.committed && before.name.equals(end.name) && identity.equals(endIdentity),
          503, "SEARCH_UPDATING", "公开内容已更新，请重试搜索");
    } catch (ApiException e) {
      throw e;
    } catch (RuntimeException e) {
      throw error(503, "SEARCH_UPDATING", "搜索服务暂不可用，请稍后重试");
    }
    List<Object> hits = list(obj(found.get("hits")).get("hits"));
    boolean more = hits.size() > pageSize;
    List<Object> selected = hits.subList(0, Math.min(pageSize, hits.size()));
    List<Map<String, Object>> items = new ArrayList<>();
    for (Object hit : selected) {
      var doc = obj(obj(hit).get("_source"));
      // Explicit API whitelist even though ES _source has already been restricted.
      items.add(m("id", doc.get("id"), "kind", doc.get("kind"), "screen", doc.get("screen"),
          "contentId", doc.get("contentId"), "region", doc.get("region"), "language", language,
          "title", m("zh", language.equals("zh") ? str(doc, "title") : "", "en", language.equals("en") ? str(doc, "title") : ""),
          "summary", m("zh", language.equals("zh") ? str(doc, "summary") : "", "en", language.equals("en") ? str(doc, "summary") : "")));
    }
    Map<String, Object> counts = new LinkedHashMap<>();
    KINDS.forEach(k -> counts.put(k, 0L));
    long all = 0;
    for (Object bucket : list(obj(obj(found.get("aggregations")).get("kinds")).get("buckets"))) {
      var b = obj(bucket);
      if (KINDS.contains(str(b, "key"))) {
        long count = number(b.get("doc_count"));
        counts.put(str(b, "key"), count);
        all += count;
      }
    }
    counts.put("all", all);
    String next = more ? encodeCursor(before, fingerprint, list(obj(selected.getLast()).get("sort"))) : null;
    return m("items", items, "total", number(obj(obj(found.get("hits")).get("total")).getOrDefault("value", 0)),
        "counts", counts, "nextCursor", next, "generation", before.committed);
  }

  static Map<String, Object> query(String query, String kind, String region, String language,
      int pageSize, List<Object> after) {
    List<Object> filters = new ArrayList<>(List.of(m("term", m("language", language))));
    if (!region.equals("all")) filters.add(m("terms", m("region", List.of("all", region))));
    String suffix = language.equals("en") ? ".english" : "";
    Object match = query.isBlank() ? m("match_all", m())
        : m("multi_match", m("query", query, "fields", List.of("title" + suffix + "^4", "summary" + suffix + "^2", "body" + suffix), "operator", "and"));
    var body = m("size", pageSize + 1, "track_total_hits", true,
        "query", m("bool", m("filter", filters, "must", List.of(match))),
        "sort", List.of(m("_score", "desc"), m("id", "asc")),
        "_source", List.of("id", "kind", "screen", "contentId", "region", "language", "title", "summary"),
        "aggs", m("kinds", m("terms", m("field", "kind", "size", KINDS.size()))));
    if (!kind.equals("all")) body.put("post_filter", m("term", m("kind", kind)));
    if (!after.isEmpty()) body.put("search_after", after);
    return body;
  }

  /** AI retrieval uses OR for natural questions and still rechecks committed publication state. */
  List<JfStore.Entity> retrieveForAi(String question, String language) {
    require(configured && schema.ready(), 503, "SEARCH_UPDATING", "知识检索暂不可用，请稍后重试");
    var before = state();
    requireReady(before);
    requireIdentity(before, identity());
    var body = query(truncate(question, 200), "all", "all", language, 6, List.of());
    var match = obj(obj(list(obj(obj(body.get("query")).get("bool")).get("must")).getFirst()).get("multi_match"));
    match.put("operator", "or");
    var found = es("POST", "/" + before.name + "/_search?allow_partial_search_results=false", body);
    require(!bool(found.get("timed_out")) && number(obj(found.get("_shards")).getOrDefault("failed", 0)) == 0,
        503, "SEARCH_UPDATING", "知识检索暂不可用");
    List<JfStore.Entity> entities = new ArrayList<>();
    for (var hit : list(obj(found.get("hits")).get("hits"))) {
      var source = obj(obj(hit).get("_source"));
      int kind = KINDS.indexOf(str(source, "kind"));
      if (kind < 0) continue;
      var entity = store.find(ENTITY_KINDS.get(kind), str(source, "contentId"), false);
      if (publicEntity(entity)) entities.add(entity);
    }
    var after = state();
    requireReady(after);
    requireIdentity(after, identity());
    require(before.committed == after.committed && before.name.equals(after.name), 409,
        "KNOWLEDGE_CHANGED", "公开资料已更新，请重新提问");
    return entities;
  }

  static void requireReady(State s) {
    require(!s.rebuild && s.committed == s.indexed && !s.name.isBlank() && !s.uuid.isBlank(),
        503, "SEARCH_UPDATING", "公开内容索引正在更新，请稍后重试");
  }

  record Identity(String name, String uuid, String installation, long generation, String format) {}

  private Identity identity() {
    Map<String, Object> aliases = es("GET", "/" + ALIAS, null);
    if (aliases.size() != 1) throw new IllegalStateException("Search alias is not unique");
    String name = aliases.keySet().iterator().next();
    var index = obj(aliases.get(name));
    var settings = obj(obj(index.get("settings")).get("index"));
    var meta = obj(obj(index.get("mappings")).get("_meta"));
    return new Identity(name, str(settings, "uuid"), str(meta, "installation"),
        number(meta.getOrDefault("generation", -1)), str(meta, "format"));
  }

  static void requireIdentity(State s, Identity actual) {
    require(s.name.equals(actual.name) && s.uuid.equals(actual.uuid)
            && s.installation.equals(actual.installation) && FORMAT.equals(actual.format)
            && s.indexed == actual.generation,
        503, "SEARCH_UPDATING", "搜索索引正在校验或恢复，请稍后重试");
  }

  static String encodeCursor(State state, String fingerprint, List<Object> sort) {
    String data = Base64.getUrlEncoder().withoutPadding().encodeToString(
        json(m("generation", state.committed, "uuid", state.uuid, "query", fingerprint, "sort", sort))
            .getBytes(StandardCharsets.UTF_8));
    return data + "." + sign(state.secret, data);
  }

  static List<Object> decodeCursor(String cursor, State state, String fingerprint) {
    if (cursor.isBlank()) return List.of();
    require(cursor.length() <= 4096, 400, "INVALID_CURSOR", "搜索分页标识无效");
    Map<String, Object> value;
    try {
      String[] parts = cursor.split("\\.", -1);
      if (parts.length != 2 || !MessageDigest.isEqual(sign(state.secret, parts[0]).getBytes(StandardCharsets.UTF_8),
          parts[1].getBytes(StandardCharsets.UTF_8))) throw new IllegalArgumentException();
      value = parse(new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8));
    } catch (RuntimeException e) {
      throw error(400, "INVALID_CURSOR", "搜索分页标识无效，请重新搜索");
    }
    require(number(value.getOrDefault("generation", -1)) == state.committed && str(value, "uuid").equals(state.uuid),
        409, "SEARCH_CHANGED", "公开内容已更新，请从第一页重新搜索");
    require(str(value, "query").equals(fingerprint), 400, "INVALID_CURSOR", "搜索条件已变化，请从第一页搜索");
    List<Object> sort = list(value.get("sort"));
    require(sort.size() == 2 && sort.getFirst() instanceof Number && sort.get(1) instanceof String,
        400, "INVALID_CURSOR", "搜索分页标识无效");
    return sort;
  }

  private static String sign(String secret, String data) {
    try {
      Mac hmac = Mac.getInstance("HmacSHA256");
      hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Cannot encode search cursor", e);
    }
  }

  public Map<String, Object> status() {
    var s = state();
    boolean verified = false;
    if (configured && !s.name.isEmpty()) {
      try { requireReady(s); requireIdentity(s, identity()); verified = true; }
      catch (RuntimeException ignored) { /* status contains no connection details or credentials */ }
    }
    return m("configured", configured, "available", verified, "ready", verified, "status", s.status,
        "committedGeneration", s.committed, "generation", s.committed, "indexedGeneration", s.indexed,
        "pending", Math.max(0, s.committed - s.indexed), "rebuildRequested", s.rebuild,
        "indexName", s.name, "lastError", s.lastError);
  }

  public Object requestRebuild(JfAuth.Actor actor) {
    require(configured, 503, "SEARCH_NOT_CONFIGURED", "搜索服务尚未配置");
    store.db().update("UPDATE jf_search_state SET rebuild_requested=1,status='queued',last_error='' WHERE id=1");
    store.audit(actor, "search.rebuild", ALIAS, "all", m("requested", true));
    return m("accepted", true, "status", "queued");
  }

  /** A dedicated MySQL named-lock connection also prevents two server instances consuming outbox. */
  @Scheduled(initialDelay = 10000, fixedDelay = 2000)
  public void synchronize() {
    if (!configured || !schema.ready() || !running.compareAndSet(false, true)) return;
    try (Connection connection = Objects.requireNonNull(store.db().getDataSource()).getConnection()) {
      String lock = "jf-search-" + hash(connection.getCatalog() == null ? "default" : connection.getCatalog()).substring(0, 24);
      boolean acquired = false;
      try (var statement = connection.prepareStatement("SELECT GET_LOCK(?,0)")) {
        statement.setString(1, lock);
        try (var result = statement.executeQuery()) { acquired = result.next() && result.getInt(1) == 1; }
      }
      if (!acquired) return;
      try {
        State state = state();
        boolean valid = false;
        if (!state.rebuild && !state.name.isBlank()) {
          try { requireIdentity(state, identity()); valid = true; }
          catch (RestClientResponseException e) { if (e.getStatusCode().value() != 404) throw e; }
          catch (ApiException ignored) { /* lost, restored or replaced index: rebuild from DB */ }
        }
        if (!valid) rebuild(state);
        else consume(state.name, state.installation, state.indexed, state.committed, true);
        lastFailure = "";
      } finally {
        try (var statement = connection.prepareStatement("SELECT RELEASE_LOCK(?)")) {
          statement.setString(1, lock);
          statement.executeQuery().close();
        }
      }
    } catch (Exception e) {
      // No failed ES request can roll back an unrelated business transaction.
      String failure = e.getClass().getSimpleName()
          + (e instanceof RestClientResponseException response ? " HTTP " + response.getStatusCode().value() : "");
      if (!failure.equals(lastFailure)) LOG.warn("Public search synchronization unavailable: {}", failure);
      lastFailure = failure;
      try { store.db().update("UPDATE jf_search_state SET status='unavailable',last_error=? WHERE id=1",
          "搜索同步暂不可用；服务恢复后会自动重试，也可重新构建索引。"); }
      catch (RuntimeException ignored) { /* migration / database may still be starting */ }
    } finally {
      running.set(false);
    }
  }

  record Snapshot(long generation, List<Map<String, Object>> documents) {}

  private void rebuild(State old) {
    store.db().update("UPDATE jf_search_state SET rebuild_requested=1,status='rebuilding',last_error='' WHERE id=1");
    Snapshot snapshot = Objects.requireNonNull(snapshotTransaction.execute(tx -> {
      long generation = state().committed;
      List<Map<String, Object>> documents = new ArrayList<>();
      for (String kind : ENTITY_KINDS)
        for (var entity : store.all(kind)) {
          var doc = document(entity);
          if (doc != null) documents.add(doc);
        }
      return new Snapshot(generation, documents);
    }));
    String index = ALIAS + "-" + UUID.randomUUID().toString().replace("-", "");
    es("PUT", "/" + index, mapping(old.installation));
    for (int offset = 0; offset < snapshot.documents.size(); offset += 300) {
      StringBuilder batch = new StringBuilder();
      for (var doc : snapshot.documents.subList(offset, Math.min(offset + 300, snapshot.documents.size())))
        appendIndex(batch, index, str(doc, "contentId"), doc);
      bulk(batch.toString());
    }
    checkpoint(index, old.installation, snapshot.generation);
    long target = state().committed;
    long caughtUp = consume(index, old.installation, snapshot.generation, target, false);
    List<Object> actions = new ArrayList<>();
    try {
      for (String previous : es("GET", "/_alias/" + ALIAS, null).keySet())
        actions.add(m("remove", m("index", previous, "alias", ALIAS)));
    } catch (RestClientResponseException e) { if (e.getStatusCode().value() != 404) throw e; }
    actions.add(m("add", m("index", index, "alias", ALIAS)));
    es("POST", "/_aliases", m("actions", actions));
    Identity actual = identity();
    if (!actual.name.equals(index) || !actual.installation.equals(old.installation) || actual.generation != caughtUp)
      throw new IllegalStateException("Rebuilt search identity was not confirmed");
    store.db().update("UPDATE jf_search_state SET indexed_generation=?,index_name=?,index_uuid=?,rebuild_requested=0,status='ready',last_error='' WHERE id=1",
        caughtUp, index, actual.uuid);
    store.db().update("DELETE FROM jf_search_outbox WHERE generation<=?", caughtUp);
  }

  private long consume(String index, String installation, long indexed, long target, boolean active) {
    long position = indexed;
    while (position < target) {
      var rows = store.db().queryForList("SELECT generation,entity_id,document FROM jf_search_outbox WHERE generation>? AND generation<=? ORDER BY generation LIMIT 300", position, target);
      if (rows.isEmpty()) throw new IllegalStateException("Search outbox contains a gap");
      StringBuilder batch = new StringBuilder();
      for (var row : rows) {
        long generation = number(row.get("generation"));
        if (generation != position + 1) throw new IllegalStateException("Search outbox generation is not contiguous");
        position = generation;
        if (row.get("document") == null) batch.append(json(m("delete", m("_index", index, "_id", row.get("entity_id"))))).append('\n');
        else appendIndex(batch, index, text(row.get("entity_id")), parse(text(row.get("document"))));
      }
      bulk(batch.toString());
      checkpoint(index, installation, position);
      if (active) {
        store.db().update("UPDATE jf_search_state SET indexed_generation=?,status='ready',last_error='' WHERE id=1 AND index_name=?", position, index);
        store.db().update("DELETE FROM jf_search_outbox WHERE generation<=?", position);
      }
    }
    if (active && indexed == target)
      store.db().update("UPDATE jf_search_state SET status='ready',last_error='' WHERE id=1 AND index_name=?", index);
    return position;
  }

  private static void appendIndex(StringBuilder batch, String index, String id, Map<String, Object> doc) {
    batch.append(json(m("index", m("_index", index, "_id", id)))).append('\n');
    batch.append(json(doc)).append('\n');
  }

  private void bulk(String body) {
    var response = esRaw("POST", "/_bulk", body, "application/x-ndjson");
    if (list(response.get("items")).isEmpty())
      throw new IllegalStateException("Search bulk response was incomplete");
    for (Object item : list(response.get("items")))
      for (var operation : obj(item).entrySet()) {
        long status = number(obj(operation.getValue()).getOrDefault("status", 500));
        if (status >= 300 && !(operation.getKey().equals("delete") && status == 404))
          throw new IllegalStateException("Search bulk operation was not acknowledged");
      }
  }

  private void checkpoint(String index, String installation, long generation) {
    var refresh = es("POST", "/" + index + "/_refresh", null);
    if (number(obj(refresh.get("_shards")).getOrDefault("failed", 1)) != 0)
      throw new IllegalStateException("Search refresh failed");
    var mapping = es("PUT", "/" + index + "/_mapping", m("_meta", metadata(installation, generation)));
    if (!bool(mapping.get("acknowledged"))) throw new IllegalStateException("Search checkpoint was not acknowledged");
  }

  static Map<String, Object> metadata(String installation, long generation) {
    return m("format", FORMAT, "installation", installation, "generation", generation);
  }

  static Map<String, Object> mapping(String installation) {
    var properties = new LinkedHashMap<String, Object>();
    for (String field : List.of("id", "kind", "screen", "contentId", "region", "language"))
      properties.put(field, m("type", "keyword"));
    for (String field : List.of("title", "summary", "body"))
      properties.put(field, m("type", "text", "analyzer", "cjk", "fields", m("english", m("type", "text", "analyzer", "english"))));
    return m("settings", m("number_of_shards", 1, "number_of_replicas", 0),
        "mappings", m("dynamic", "strict", "_meta", metadata(installation, -1), "properties", properties));
  }

  private Map<String, Object> es(String method, String path, Object body) {
    return esRaw(method, path, body == null ? null : json(body), MediaType.APPLICATION_JSON_VALUE);
  }

  private Map<String, Object> esRaw(String method, String path, String body, String contentType) {
    var request = client.method(HttpMethod.valueOf(method)).uri(path);
    if (body != null)
      request.contentType(new MediaType(MediaType.parseMediaType(contentType), StandardCharsets.UTF_8)).body(body);
    String response = request.retrieve().body(String.class);
    return response == null || response.isBlank() ? m() : parse(response);
  }
}
