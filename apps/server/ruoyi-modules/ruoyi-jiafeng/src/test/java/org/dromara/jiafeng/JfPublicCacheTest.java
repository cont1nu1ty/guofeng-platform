package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.*;
import org.redisson.api.*;
import org.redisson.api.options.PlainOptions;
import org.redisson.misc.CompletableFutureWrapper;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

class JfPublicCacheTest {
  private final JdbcTemplate db = mock(JdbcTemplate.class);
  private final AtomicLong generation = new AtomicLong(1);
  private final AtomicReference<String> epoch = new AtomicReference<>("installation-one");
  private final AtomicInteger builds = new AtomicInteger();
  private final MutableClock clock = new MutableClock();
  private final MemoryTransport redis = new MemoryTransport();

  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  @BeforeEach void database() {
    when(db.queryForMap("SELECT epoch,catalog_generation,stats_generation FROM jf_public_cache_state WHERE id=1"))
        .thenAnswer(i -> m("epoch", epoch.get(), "catalog_generation", generation.get(), "stats_generation", generation.get()));
  }
  @AfterEach void transaction() { TransactionSynchronizationManager.setActualTransactionActive(false); }

  private JfPublicCache cache() {
    return new JfPublicCache(db, mock(PlatformTransactionManager.class), redis, true, "test", clock);
  }
  private JfPublicCache.Snapshot build() {
    builds.incrementAndGet();
    return new JfPublicCache.Snapshot(m("items", new ArrayList<>(List.of(m("title", "public")))));
  }
  static final class MutableClock extends Clock {
    Instant current = Instant.parse("2026-09-30T00:00:00Z");
    public ZoneId getZone() { return ZoneOffset.UTC; }
    public Clock withZone(ZoneId zone) { return this; }
    public Instant instant() { return current; }
  }
  static class MemoryTransport implements JfPublicCache.Transport {
    final Map<String, String> values = new ConcurrentHashMap<>();
    final AtomicInteger reads = new AtomicInteger(), writes = new AtomicInteger();
    Duration lastTtl;
    boolean broken;
    public String get(String key) throws Exception {
      reads.incrementAndGet();
      if (broken) throw new TimeoutException();
      return values.get(key);
    }
    public void put(String key, String value, Duration ttl) {
      writes.incrementAndGet(); lastTtl = ttl; values.put(key, value);
    }
  }

  @Test void hitsAreDeepCopiedBeforePrivateOverlays() {
    var cache = cache();
    var first = cache.get("catalog", this::build);
    obj(list(first.get("items")).getFirst()).put("privateNote", "owner-only");
    var second = cache.get("catalog", this::build);
    assertFalse(obj(list(second.get("items")).getFirst()).containsKey("privateNote"));
    assertEquals(1, builds.get());
    assertEquals(1L, cache.metrics().get("catalog_hit"));
  }

  @Test void committedWithdrawalAndRestoredEpochCannotReuseOldContent() {
    var cache = cache();
    cache.get("catalog", this::build);
    generation.incrementAndGet();
    var removed = cache.get("catalog", () -> new JfPublicCache.Snapshot(m("items", List.of())));
    assertTrue(list(removed.get("items")).isEmpty());
    epoch.set("installation-after-restore"); generation.set(1);
    var restored = cache.get("catalog", () -> new JfPublicCache.Snapshot(m("items", List.of())));
    assertTrue(list(restored.get("items")).isEmpty());
  }

  @Test void concurrentGenerationChangeDiscardsInFlightBuild() {
    var cache = cache();
    AtomicInteger round = new AtomicInteger();
    var result = cache.get("catalog", () -> {
      if (round.getAndIncrement() == 0) {
        generation.incrementAndGet();
        return new JfPublicCache.Snapshot(m("items", List.of("withdrawn")));
      }
      return new JfPublicCache.Snapshot(m("items", List.of()));
    });
    assertTrue(list(result.get("items")).isEmpty());
    assertEquals(1, redis.writes.get());
    assertEquals(1L, cache.metrics().get("version_or_time_retry"));
  }

  @Test void continuouslyChangingPublicStateNeverReturnsKnownStaleData() {
    var cache = cache();
    var failure = assertThrows(ApiException.class, () -> cache.get("catalog", () -> {
      generation.incrementAndGet(); return build();
    }));
    assertEquals("PUBLIC_CONTENT_UPDATING", failure.code);
    assertEquals(0, redis.writes.get());
  }

  @Test void commandTransactionBypassesReadsAndWritesEvenWhenRollbackFollows() {
    var cache = cache();
    TransactionSynchronizationManager.setActualTransactionActive(true);
    cache.get("catalog", this::build);
    assertEquals(0, redis.reads.get()); assertEquals(0, redis.writes.get());
    verifyNoInteractions(db);
    TransactionSynchronizationManager.setActualTransactionActive(false);
    assertTrue(redis.values.isEmpty());
  }

  @Test void timeBoundariesAndStatisticsTtlAreIndependent() {
    var cache = cache();
    Instant scheduledStart = clock.instant().plusSeconds(3);
    cache.get("catalog", () -> new JfPublicCache.Snapshot(m("banner", "before"), scheduledStart));
    assertEquals(Duration.ofSeconds(3), redis.lastTtl);
    clock.current = scheduledStart;
    assertEquals("after", cache.get("catalog", () -> new JfPublicCache.Snapshot(m("banner", "after"))).get("banner"));
    assertEquals(Duration.ofSeconds(300), redis.lastTtl);
    cache.get("stats", this::build);
    assertEquals(Duration.ofSeconds(30), redis.lastTtl);
    assertEquals(2, redis.values.size()); // catalog key overwritten; stats uses a separate key
  }

  @Test void statisticsLifetimeStartsAtBuildRatherThanRedisWrite() {
    var cache = cache();
    cache.get("stats", () -> {
      clock.current = clock.current.plusSeconds(7);
      return build();
    });
    assertEquals(Duration.ofSeconds(23), redis.lastTtl);
  }

  @Test void redisFailureFallsBackWithoutRepeatedlyWaitingForAnUnavailableCache() {
    var cache = cache(); redis.broken = true;
    assertNotNull(cache.get("catalog", this::build));
    assertNotNull(cache.get("catalog", this::build));
    assertEquals(1, redis.reads.get()); assertEquals(0, redis.writes.get());
    assertEquals(1L, cache.metrics().get("redis_failures"));
    clock.current = clock.current.plusSeconds(6); redis.broken = false;
    cache.get("catalog", this::build);
    assertEquals(1, redis.writes.get());
  }

  @Test void disabledCachePreservesSqlProjectionAndNeverTouchesRedis() {
    var cache = new JfPublicCache(db, mock(PlatformTransactionManager.class), redis, false, "test", clock);
    cache.get("catalog", this::build);
    verifyNoInteractions(db);
    assertEquals(0, redis.reads.get()); assertEquals(0, redis.writes.get());
  }

  @Test void concurrentMissesShareOneBuild() throws Exception {
    var cache = cache(); var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var first = pool.submit(() -> cache.get("catalog", () -> {
        entered.countDown();
        try { assertTrue(release.await(2, TimeUnit.SECONDS)); }
        catch (InterruptedException e) { throw new RuntimeException(e); }
        return build();
      }));
      assertTrue(entered.await(2, TimeUnit.SECONDS));
      var second = pool.submit(() -> cache.get("catalog", this::build));
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
      while (cache.metrics().getOrDefault("coalesced", 0L) == 0 && System.nanoTime() < deadline) Thread.onSpinWait();
      release.countDown();
      assertEquals(first.get(2, TimeUnit.SECONDS), second.get(2, TimeUnit.SECONDS));
      assertEquals(1, builds.get());
    }
  }

  @Test void businessRedisOperationHasItsOwnHundredMillisecondDeadline() {
    var redisClient = mock(RedissonClient.class);
    @SuppressWarnings("unchecked") RBucket<String> bucket = mock(RBucket.class);
    when(redisClient.<String>getBucket(any(PlainOptions.class))).thenReturn(bucket);
    var pending = new CompletableFuture<String>();
    when(bucket.getAsync()).thenReturn(new CompletableFutureWrapper<>(pending));
    var cache = new JfPublicCache(db, mock(PlatformTransactionManager.class), redisClient, true, "deadline");
    long started = System.nanoTime();
    assertNotNull(cache.get("catalog", this::build));
    long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
    assertTrue(elapsedMillis < 1000, "An unavailable optional cache must not wait for session timeout/retries");
    try {
      var completed = new CountDownLatch(1);
      pending.whenComplete((value, error) -> completed.countDown());
      assertTrue(completed.await(1, TimeUnit.SECONDS));
    } catch (InterruptedException e) { throw new AssertionError(e); }
    assertTrue(pending.isCancelled());
    assertEquals(1L, cache.metrics().get("redis_failures"));
    cache.close();
  }

  @Test void synchronousTransportDispatchIsAlsoBoundedBeforeItReturnsAFuture() {
    var released = new CountDownLatch(1);
    var interrupted = new CountDownLatch(1);
    var transport = new JfPublicCache.Transport() {
      public String get(String key) throws Exception {
        try { released.await(5, TimeUnit.SECONDS); }
        catch (InterruptedException e) { interrupted.countDown(); throw e; }
        return null;
      }
      public void put(String key, String value, Duration ttl) { fail("failed transport must not receive writes"); }
    };
    var cache = new JfPublicCache(db, mock(PlatformTransactionManager.class), transport, true, "dispatch", clock);
    long started = System.nanoTime();
    try {
      assertNotNull(cache.get("catalog", this::build));
      assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) < 1000,
          "Deadline must cover the transport invocation, not only its returned future");
      assertEquals(1L, cache.metrics().get("redis_failures"));
      assertTrue(interrupted.await(1, TimeUnit.SECONDS));
    } catch (InterruptedException e) { throw new AssertionError(e); }
    finally { released.countDown(); cache.close(); }
  }

  @Test void invalidationIncludesSettingsAndDirectInteractionDeletesButNotPrivateRecords() {
    JfPublicCache.touch(db, "setting", "homepageConfig");
    JfPublicCache.touch(db, "mediaLike", "like-1");
    JfPublicCache.touch(db, "familyPromise", "private-1");
    verify(db).update("UPDATE jf_public_cache_state SET catalog_generation=catalog_generation+1, stats_generation=stats_generation+1 WHERE id=1");
    verify(db).update("UPDATE jf_public_cache_state SET stats_generation=stats_generation+1 WHERE id=1");
    verifyNoMoreInteractions(db);
  }
}
