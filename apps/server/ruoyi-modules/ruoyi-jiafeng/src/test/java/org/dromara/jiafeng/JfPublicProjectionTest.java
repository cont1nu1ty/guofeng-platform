package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.*;
import java.util.*;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

class JfPublicProjectionTest {
  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  private static JfAuth.Actor member(long id) {
    return new JfAuth.Actor(m("user_id", id, "roles", List.of("member"),
        "region_ids", List.of("zhejiang"), "realm", "member", "version", 1));
  }
  private static JfStore.Entity entity(String id, long owner, String createdAt) {
    return new JfStore.Entity(id, "submission", owner, "zhejiang", "awarded",
        m("title", id, "published", true), 1, createdAt, createdAt);
  }

  @Test void sharedPublicCacheNeverReceivesOwnerWorksOrPrivateRecordsAndPreservesOrder() {
    var store = mock(JfStore.class); var db = mock(JdbcTemplate.class);
    when(store.db()).thenReturn(db);
    when(db.queryForMap("SELECT epoch,catalog_generation,stats_generation FROM jf_public_cache_state WHERE id=1"))
        .thenReturn(m("epoch", "test", "catalog_generation", 1, "stats_generation", 1));
    when(db.queryForMap(startsWith("SELECT COUNT(*) submissions")))
        .thenReturn(m("submissions", 3, "participants", 2, "regions", 1));
    when(store.find(eq("setting"), anyString(), eq(false)))
        .thenAnswer(i -> new JfStore.Entity(i.getArgument(1), "setting", null, "all", "active",
            m("ruleVersion", 1), 1, "", ""));
    var publicWork = entity("public", 1, "2026-09-29T00:00:00Z");
    var ownPrivateWork = entity("private-owner-one", 1, "2026-09-30T00:00:00Z");
    when(store.select("submission", JfProjection.PUBLIC_WORK)).thenReturn(List.of(publicWork));
    when(store.select("submission", "owner_id=?", 1L)).thenReturn(List.of(ownPrivateWork, publicWork));
    var submissions = mock(JfSubmissions.class);
    when(submissions.work(any(), nullable(JfAuth.Actor.class))).thenAnswer(i -> {
      JfStore.Entity work = i.getArgument(0); JfAuth.Actor actor = i.getArgument(1);
      var value = m("id", work.id(), "isMine", actor != null && work.owner() == actor.id);
      if (actor != null && work.owner() == actor.id) value.put("history", List.of("private-history"));
      return value;
    });
    var catalog = new JfCatalog(store, mock(JfAuth.class), mock(JfFiles.class));
    var privateRecords = mock(JfPersonalRecords.class);
    doAnswer(i -> {
      Map<String, Object> out = i.getArgument(0); JfAuth.Actor actor = i.getArgument(1);
      out.put("recitations", actor == null ? List.of() : List.of("private-record-" + actor.id));
      return null;
    }).when(privateRecords).addMember(anyMap(), nullable(JfAuth.Actor.class));
    var redis = new JfPublicCacheTest.MemoryTransport();
    var cache = new JfPublicCache(db, mock(PlatformTransactionManager.class), redis, true, "test", Clock.systemUTC());
    var projection = new JfProjection(store, submissions, catalog, privateRecords, cache, mock(JfReviewWindows.class), mock(JfEducation.class));

    var first = projection.member(member(1));
    assertEquals(List.of("private-owner-one", "public"), list(first.get("works")).stream().map(x -> str(obj(x), "id")).toList());
    assertTrue(bool(obj(list(first.get("works")).getLast()).get("isMine")));
    assertTrue(obj(list(first.get("works")).getLast()).containsKey("history"));
    var second = projection.member(member(2));
    assertEquals(List.of("public"), list(second.get("works")).stream().map(x -> str(obj(x), "id")).toList());
    assertFalse(bool(obj(list(second.get("works")).getFirst()).get("isMine")));
    assertFalse(obj(list(second.get("works")).getFirst()).containsKey("history"));
    assertEquals(List.of("private-record-2"), second.get("recitations"));
    var anonymous = projection.member(null);
    assertTrue(list(anonymous.get("recitations")).isEmpty());
    assertFalse(anonymous.containsKey("_workOrder"));
    assertEquals(3L, number(obj(anonymous.get("homeStats")).get("submissions")));
    for (String encoded : redis.values.values()) {
      assertFalse(encoded.contains("private-owner-one"));
      assertFalse(encoded.contains("private-history"));
      assertFalse(encoded.contains("private-record-"));
    }
    verify(store, never()).all(anyString());
    verify(store, times(1)).select("submission", JfProjection.PUBLIC_WORK);
    verify(db, times(1)).queryForMap(startsWith("SELECT COUNT(*) submissions"));
  }

  @Test void publishedMediaAndActivityWithoutInteractionsExposeZeroCounts() {
    var cache = mock(JfPublicCache.class);
    when(cache.get(eq("catalog"), any())).thenReturn(m(
        "works", List.of(), "_workOrder", m(),
        "mediaItems", new ArrayList<>(List.of(m("id", "new-media"))),
        "activities", new ArrayList<>(List.of(m("id", "new-activity")))));
    when(cache.get(eq("stats"), any())).thenReturn(m(
        "homeStats", m("submissions", 0, "participants", 0, "regions", 0, "asOf", now()),
        "media", m(), "registrations", m()));
    var projection = new JfProjection(mock(JfStore.class), mock(JfSubmissions.class), mock(JfCatalog.class),
        mock(JfPersonalRecords.class), cache, mock(JfReviewWindows.class), mock(JfEducation.class));
    var result = projection.member(null);
    var media = obj(list(result.get("mediaItems")).getFirst());
    assertEquals(0L, media.get("likes"));
    assertEquals(0L, media.get("favorites"));
    assertEquals(0L, obj(list(result.get("activities")).getFirst()).get("registeredCount"));
  }

  @Test void futureBannerStartBoundsCacheEvenBeforeBannerIsVisible() {
    var store = mock(JfStore.class);
    Instant start = Instant.now().plusSeconds(120), end = start.plusSeconds(120);
    var banner = new JfStore.Entity("scheduled", "banner", 1L, "all", "已发布",
        m("startsAt", start.toString(), "endsAt", end.toString(), "targetId", ""), 1, "", "");
    when(store.select("banner", "status='已发布'")).thenReturn(List.of(banner));
    var catalog = new JfCatalog(store, mock(JfAuth.class), mock(JfFiles.class));
    assertFalse(catalog.visible(banner));
    assertEquals(start, catalog.nextBoundary());
  }
}
