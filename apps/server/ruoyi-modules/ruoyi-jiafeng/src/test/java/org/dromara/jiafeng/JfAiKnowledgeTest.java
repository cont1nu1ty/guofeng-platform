package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class JfAiKnowledgeTest {
  private final JfStore store = mock(JfStore.class);
  private final JfAiKnowledge knowledge = new JfAiKnowledge(store, mock(JfSearch.class), mock(JfAuth.class));
  private JfAuth.Actor actor(String role, String region) {
    return new JfAuth.Actor(m("user_id", 1, "version", 1, "roles", List.of(role), "region_ids", List.of(region),
        "permissions", Set.of("regional_admin", "national_admin").contains(role)
            ? List.of("ai:read", "ai:write", "submissions:read", "submissions:write") : List.of()));
  }
  private JfStore.Entity entity(String kind, String status, String audience, long version) {
    return new JfStore.Entity("source", kind, 1L, "zhejiang", status, m("audience", audience), version, "", "");
  }
  private List<Object> source(String kind, String audience) {
    return List.of(m("kind", kind, "sourceId", "source", "version", 2, "audience", audience));
  }

  @Test void highHitSupportKeepsHelpAndBoundsCombinedSourcesToTwelve() {
    var search = mock(JfSearch.class);
    var db = mock(JdbcTemplate.class);
    var retrieval = new JfAiKnowledge(store, search, mock(JfAuth.class));
    when(store.db()).thenReturn(db);
    List<JfStore.Entity> hits = new ArrayList<>();
    List<Map<String, Object>> chunks = new ArrayList<>();
    for (int i = 0; i < 7; i++) hits.add(new JfStore.Entity("news_" + i, "content", 1L,
        "all", "已发布", m("title", "家风资料" + i, "body", "公开正文"), 1, "", ""));
    for (int i = 0; i < 6; i++) chunks.add(m("id", "chunk_" + i, "document_id", "doc_" + i,
        "title", "知识资料" + i, "body", "知识正文", "source_version", 1, "audience", "public", "region_id", "all"));
    when(search.retrieveForAi("家风", "zh")).thenReturn(hits);
    when(db.queryForList(anyString(), eq("家风"), eq("zh"), eq("家风"))).thenReturn(chunks);
    var contexts = retrieval.retrieve(actor("member", "zhejiang"), "家风", "zh", true);
    assertEquals(12, contexts.size());
    assertEquals("help", contexts.getFirst().kind());
    assertEquals(6, contexts.stream().filter(c -> c.kind().equals("content")).count());
    assertEquals(5, contexts.stream().filter(c -> c.kind().equals("knowledge")).count());
  }

  @Test void privateRecordsCannotBecomePublicKnowledgeReferences() {
    when(store.find("familyPromise", "source", false)).thenReturn(entity("familyPromise", "active", "public", 2));
    assertFalse(knowledge.valid(actor("member", "zhejiang"), source("familyPromise", "public")));
  }

  @Test void explicitPublicIndexIsReadableButWithdrawnOrReplacedIsNot() {
    when(store.find("knowledge", "source", false)).thenReturn(entity("knowledge", "已索引", "public", 2));
    assertTrue(knowledge.valid(actor("member", "beijing"), source("knowledge", "public")));
    when(store.find("knowledge", "source", false)).thenReturn(entity("knowledge", "已撤回", "public", 2));
    assertFalse(knowledge.valid(actor("member", "zhejiang"), source("knowledge", "public")));
    when(store.find("knowledge", "source", false)).thenReturn(entity("knowledge", "已索引", "public", 3));
    assertFalse(knowledge.valid(actor("member", "zhejiang"), source("knowledge", "public")));
  }

  @Test void staffKnowledgeRequiresCurrentOperatorRegion() {
    when(store.find("knowledge", "source", false)).thenReturn(entity("knowledge", "已索引", "staff", 2));
    assertFalse(knowledge.valid(actor("member", "zhejiang"), source("knowledge", "staff")));
    assertFalse(knowledge.valid(actor("regional_admin", "beijing"), source("knowledge", "staff")));
    assertTrue(knowledge.valid(actor("regional_admin", "zhejiang"), source("knowledge", "staff")));
  }

  @Test void currentOperatorMustRetainKnowledgeReadPermissionAndDocumentWritesRequireAiWrite() {
    var operator = new JfAuth.Actor(m("user_id", 1, "version", 1, "roles", List.of("content_operator"),
        "region_ids", List.of("zhejiang"), "permissions", List.of("content:read")));
    when(store.find("knowledge", "source", false)).thenReturn(entity("knowledge", "已索引", "staff", 2));
    assertFalse(knowledge.valid(operator, source("knowledge", "staff")));
    assertEquals(403, assertThrows(ApiException.class, () -> knowledge.document(operator, "source", 2, true)).status);
    verify(store, never()).find("knowledge", "source", true);
  }

  @Test void unpublishedSimilarityReferencesRequireCurrentSubmissionPermission() {
    when(store.find("submission", "source", false)).thenReturn(entity("submission", "in_review", "staff", 2));
    var contentOperator = new JfAuth.Actor(m("user_id", 1, "version", 1, "roles", List.of("content_operator"),
        "region_ids", List.of("zhejiang"), "permissions", List.of("content:read", "ai:read")));
    assertFalse(knowledge.valid(contentOperator, source("submission", "staff")));
    assertTrue(knowledge.valid(actor("regional_admin", "zhejiang"), source("submission", "staff")));
  }

  @Test void publishedContentMustStillBePublishedAtReadTime() {
    when(store.find("content", "source", false)).thenReturn(entity("content", "已发布", "public", 2));
    assertTrue(knowledge.valid(actor("member", "zhejiang"), source("content", "public")));
    when(store.find("content", "source", false)).thenReturn(entity("content", "草稿", "public", 2));
    assertFalse(knowledge.valid(actor("member", "zhejiang"), source("content", "public")));
  }

  @Test void chunksAreBoundedOverlappingAndEmptyDocumentsStayEmpty() {
    assertTrue(JfAiKnowledge.split("  ").isEmpty());
    String text = "家风知识".repeat(1000);
    var chunks = JfAiKnowledge.split(text);
    assertTrue(chunks.size() > 1);
    assertTrue(chunks.stream().allMatch(c -> c.length() <= 1200));
    assertEquals(chunks.getFirst().substring(1050), chunks.get(1).substring(0, 150));
    assertThrows(ApiException.class, () -> JfAiKnowledge.split("字".repeat(500001)));
  }
}
