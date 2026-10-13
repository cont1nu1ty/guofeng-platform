package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.dromara.common.core.utils.SpringUtils;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class JfAiQueriesTest {
  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }

  @Test void pagedKnowledgeRetainsIndexingFieldsAndRequiresAiReadPermission() {
    var store = mock(JfStore.class);
    var queries = new JfQueries(store, mock(JfProjection.class), mock(JfReviewWindows.class));
    var actor = new JfAuth.Actor(m("user_id", 1, "version", 1, "roles", List.of("regional_admin"),
        "region_ids", List.of("zhejiang"), "permissions", List.of("ai:read")));
    var document = new JfStore.Entity("k1", "knowledge", 1L, "zhejiang", "已索引",
        m("title", "资料", "fileId", "f1", "audience", "staff", "indexStatus", "indexed", "language", "zh"),
        7, "2026-10-13T00:00:00Z", "2026-10-13T00:00:00Z");
    when(store.dto(document)).thenCallRealMethod();
    when(store.db()).thenReturn(mock(JdbcTemplate.class));
    when(store.page(eq("knowledge"), anyString(), anyList(), eq(0), eq(20))).thenReturn(List.of(document));
    var page = queries.page(actor, "knowledgeBases", 1, 20, "", "", "");
    var item = obj(list(page.get("items")).getFirst());
    assertEquals(7L, item.get("lockVersion")); assertEquals("staff", item.get("audience"));
    assertEquals("indexed", item.get("indexStatus")); assertEquals("zh", item.get("language"));
    assertEquals("f1", item.get("fileId"));
    assertEquals("aiLog", queries.resource(actor, "aiRecords").kind());
    var unauthorized = new JfAuth.Actor(m("user_id", 2, "version", 1, "roles", List.of("content_operator"),
        "region_ids", List.of("zhejiang"), "permissions", List.of("content:read")));
    for (String collection : List.of("knowledgeBases", "aiRecords"))
      assertEquals(403, assertThrows(ApiException.class, () -> queries.resource(unauthorized, collection)).status);
  }
}
