package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

class JfSearchTest {
  private HttpServer http;
  private final AtomicReference<Map<String, Object>> dbState = new AtomicReference<>(row(4, 4));
  private Runnable duringSearch = () -> {};
  private String actualUuid = "uuid-current";
  private long actualGeneration = 4;
  private Map<String, Object> searchResult = results();

  @BeforeAll
  static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }

  @AfterEach
  void close() { if (http != null) http.stop(0); }

  private static Map<String, Object> row(long committed, long indexed) {
    return m("committed_generation", committed, "indexed_generation", indexed,
        "index_name", "jiafeng-public-current", "index_uuid", "uuid-current", "installation_id", "installation",
        "cursor_secret", "test-only-not-an-installed-secret", "rebuild_requested", false,
        "status", "ready", "last_error", "");
  }

  private static JfSearch.State state(long generation, String uuid) {
    return new JfSearch.State(generation, generation, "jiafeng-public-current", uuid, "installation",
        "test-only-not-an-installed-secret", false, "ready", "");
  }

  private JfSearch service() throws Exception {
    http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    http.createContext("/", exchange -> {
      boolean search = exchange.getRequestURI().getPath().endsWith("/_search");
      Map<String, Object> body;
      if (search) { duringSearch.run(); body = searchResult; }
      else body = m("jiafeng-public-current", m("settings", m("index", m("uuid", actualUuid)),
          "mappings", m("_meta", JfSearch.metadata("installation", actualGeneration))));
      byte[] bytes = json(body).getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
    http.start();
    var store = mock(JfStore.class);
    var db = mock(JdbcTemplate.class);
    var schema = mock(JfSchema.class);
    when(store.db()).thenReturn(db);
    when(schema.ready()).thenReturn(true);
    when(db.queryForMap("SELECT * FROM jf_search_state WHERE id=1")).thenAnswer(i -> dbState.get());
    return new JfSearch(store, schema, mock(PlatformTransactionManager.class),
        "http://127.0.0.1:" + http.getAddress().getPort(), "test", "test");
  }

  private static Map<String, Object> results() {
    List<Object> hits = new ArrayList<>();
    for (int i = 1; i <= 2; i++) hits.add(m("_source", m("id", "news:content-" + i,
        "kind", "news", "screen", "news", "contentId", "content-" + i, "region", "zhejiang",
        "title", "公开家风资讯" + i, "summary", "公开摘要", "body", "must not return body",
        "owner", 100, "reviewNote", "must not return review"), "sort", List.of(1.0, "news:content-" + i)));
    return m("timed_out", false, "_shards", m("failed", 0), "hits", m("total", m("value", 2), "hits", hits),
        "aggregations", m("kinds", m("buckets", List.of(m("key", "news", "doc_count", 2)))));
  }

  private static JfStore.Entity entity(String kind, String status, Map<String, Object> data) {
    return new JfStore.Entity("entity-1", kind, 11001L, "zhejiang", status, data, 1, "", "");
  }

  @Test
  void privateAndUnpublishedDocumentsAreNeverIndexed() {
    for (String kind : JfSearch.ENTITY_KINDS)
      assertNull(JfSearch.document(entity(kind, "草稿", m("title", "Private"))));
    assertNull(JfSearch.document(entity("submission", "in_review", m("published", true))));
    assertNull(JfSearch.document(entity("submission", "awarded", m("published", false))));
    assertNull(JfSearch.document(entity("recitation", "active", m("title", "Private audio"))));
    assertNull(JfSearch.document(entity("familyPromise", "active", m("title", "Private promise"))));
  }

  @Test
  void malformedPageSizeIsAStableClientErrorBeforeSearchRuns() {
    var service = mock(JfSearch.class);
    var controller = new JfSearchController(service, mock(JfAuth.class));
    for (String value : List.of("not-a-number", "1.5", "99999999999999999999999999")) {
      var error = assertThrows(ApiException.class,
          () -> controller.search("", "all", "all", "zh", "", value));
      assertEquals(422, error.status);
      assertEquals("INVALID_PAGE_SIZE", error.code);
    }
    verifyNoInteractions(service);
  }

  @Test
  void allNinePublicKindsUseExplicitWhitelist() {
    List<String> statuses = List.of("awarded", "已发布", "已入藏", "报名中", "已上架", "已发布", "已发布", "已上架", "已发布");
    for (int i = 0; i < statuses.size(); i++) {
      var doc = JfSearch.document(entity(JfSearch.ENTITY_KINDS.get(i), statuses.get(i),
          m("published", true, "title", "公开标题", "content", "公开正文", "reviewNote", "SECRET",
              "blindContent", "SECRET", "authorContact", "SECRET", "attachments", List.of("SECRET"),
              "revisions", List.of(m("content", "SECRET")), "transcript", List.of("公开字幕"))));
      assertNotNull(doc);
      assertEquals(JfSearch.KINDS.get(i), doc.get("kind"));
      assertFalse(json(doc).contains("SECRET"));
      assertEquals(Set.of("id", "kind", "screen", "contentId", "region", "language", "title", "summary", "body"), doc.keySet());
    }
  }

  @Test
  void unpublishedLanguageNeverFallsBackIntoAnotherEdition() {
    var old = JfSearch.document(entity("content", "已发布",
        m("title", m("zh", "中文标题", "en", "Unpublished English"), "body", m("zh", "正文", "en", "Private English"))));
    assertEquals("zh", old.get("language"));
    assertEquals("中文标题", old.get("title"));
    assertFalse(json(old).contains("English"));
    var en = JfSearch.document(entity("content", "已发布",
        m("language", "English", "title", m("zh", "未发布中文", "en", "English"), "body", m("zh", "秘密", "en", "Text"))));
    assertEquals("en", en.get("language"));
    assertEquals("English", en.get("title"));
    assertFalse(json(en).contains("秘密"));
  }

  @Test
  void queryKeepsRegionLanguageAndKeywordInFacetsAndKindInPostFilter() {
    var query = JfSearch.query("letters", "news", "zhejiang", "en", 12, List.of());
    String serialized = json(query);
    assertTrue(serialized.contains("title.english^4"));
    assertTrue(serialized.contains("\"region\":[\"all\",\"zhejiang\"]"));
    assertEquals(m("term", m("kind", "news")), query.get("post_filter"));
    assertEquals(List.of("id", "kind", "screen", "contentId", "region", "language", "title", "summary"), query.get("_source"));
    assertFalse(query.containsKey("query_string"));
  }

  @Test
  void cursorIsAuthenticatedAndBoundToQueryGenerationAndIndex() {
    var original = state(4, "uuid-current");
    String cursor = JfSearch.encodeCursor(original, "query-a", List.of(1.5, "news:a"));
    assertEquals(List.of(1.5, "news:a"), JfSearch.decodeCursor(cursor, original, "query-a"));
    assertEquals("INVALID_CURSOR", assertThrows(ApiException.class,
        () -> JfSearch.decodeCursor(cursor + "x", original, "query-a")).code);
    assertEquals("INVALID_CURSOR", assertThrows(ApiException.class,
        () -> JfSearch.decodeCursor(cursor, original, "query-b")).code);
    assertEquals("SEARCH_CHANGED", assertThrows(ApiException.class,
        () -> JfSearch.decodeCursor(cursor, state(5, "uuid-current"), "query-a")).code);
    assertEquals("SEARCH_CHANGED", assertThrows(ApiException.class,
        () -> JfSearch.decodeCursor(cursor, state(4, "recreated-index"), "query-a")).code);
  }

  @Test
  void searchDoesNotTrustDatabaseCheckpointWhenIndexWasRecreated() throws Exception {
    var service = service();
    actualUuid = "lost-volume-new-uuid";
    assertEquals("SEARCH_UPDATING", assertThrows(ApiException.class,
        () -> service.search("", "all", "all", "zh", "", 12)).code);
  }

  @Test
  void restoredDatabaseCannotReadAheadOfItsGeneration() throws Exception {
    var service = service();
    actualGeneration = 7;
    assertEquals("SEARCH_UPDATING", assertThrows(ApiException.class,
        () -> service.search("", "all", "all", "zh", "", 12)).code);
  }

  @Test
  void committedUnpublishBlocksHitsAndCountsUntilIndexed() throws Exception {
    var service = service();
    dbState.set(row(5, 4));
    var error = assertThrows(ApiException.class, () -> service.search("", "all", "all", "zh", "", 12));
    assertEquals(503, error.status);
    assertEquals("SEARCH_UPDATING", error.code);
    assertFalse(error.getMessage().contains("公开摘要"));
  }

  @Test
  void updateDuringSearchDiscardsAllPreviouslyCollectedResults() throws Exception {
    var service = service();
    duringSearch = () -> dbState.set(row(5, 4));
    var error = assertThrows(ApiException.class, () -> service.search("", "all", "all", "zh", "", 12));
    assertEquals("SEARCH_UPDATING", error.code);
  }

  @Test
  void partialShardFailureAndTimeoutNeverYieldPartialFacets() throws Exception {
    var service = service();
    searchResult.put("timed_out", true);
    assertEquals("SEARCH_UPDATING", assertThrows(ApiException.class,
        () -> service.search("", "all", "all", "zh", "", 12)).code);
    searchResult.put("timed_out", false);
    searchResult.put("_shards", m("failed", 1));
    assertEquals("SEARCH_UPDATING", assertThrows(ApiException.class,
        () -> service.search("", "all", "all", "zh", "", 12)).code);
  }

  @Test
  void successfulSearchReturnsOnlyPublicDtoWithCursorAndFacets() throws Exception {
    var result = service().search("家风", "news", "zhejiang", "zh", "", 1);
    assertEquals(2L, result.get("total"));
    assertEquals(2L, obj(result.get("counts")).get("all"));
    assertEquals(1, list(result.get("items")).size());
    assertFalse(str(result, "nextCursor").isBlank());
    var hit = obj(list(result.get("items")).getFirst());
    assertEquals(m("zh", "公开家风资讯1", "en", ""), hit.get("title"));
    assertFalse(json(result).contains("must not return"));
    assertFalse(hit.containsKey("owner"));
  }

  @Test
  void unavailableEngineHasStableErrorWithoutConnectionDetails() throws Exception {
    var service = service();
    http.stop(0);
    http = null;
    var error = assertThrows(ApiException.class, () -> service.search("", "all", "all", "zh", "", 12));
    assertEquals("SEARCH_UPDATING", error.code);
    assertFalse(error.getMessage().contains("127.0.0.1"));
  }
}
