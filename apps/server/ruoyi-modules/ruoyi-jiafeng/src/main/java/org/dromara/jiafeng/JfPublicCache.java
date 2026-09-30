package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.LongAdder;
import java.util.concurrent.atomic.LongAccumulator;
import jakarta.annotation.PreDestroy;
import java.util.function.Supplier;
import org.redisson.api.RedissonClient;
import org.redisson.api.options.PlainOptions;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Optional, rebuildable public projections. SQL versions, not Redis, authorize a cache hit. */
@Service
public class JfPublicCache {
  private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(JfPublicCache.class);
  private static final Set<String> CATALOG_KINDS = Set.of("submission", "content", "collection",
      "activity", "course", "product", "banner", "media", "venue", "hallPerson");
  private final JdbcTemplate db;
  private final boolean enabled;
  private final String namespace;
  private final Transport transport;
  private final Clock clock;
  private final TransactionTemplate snapshot;
  private final Map<String, CompletableFuture<Snapshot>> flights = new ConcurrentHashMap<>();
  private final Map<String, LongAdder> counters = new ConcurrentHashMap<>();
  // Bound synchronous dispatch/cancellation as well as the async response, without changing session policy.
  // No queue: a stalled optional transport cannot accumulate unbounded work or consume servlet threads.
  private final ExecutorService redisCalls = new ThreadPoolExecutor(0, 8, 10, TimeUnit.SECONDS,
      new SynchronousQueue<>(), Thread.ofPlatform().daemon(true).name("jf-public-cache-", 0).factory(),
      new ThreadPoolExecutor.AbortPolicy());
  private final LongAccumulator redisMaximumMicros = new LongAccumulator(Long::max, 0);
  private volatile long circuitUntil;

  record Version(String epoch, long catalog, long stats) {
    long generation(String group) { return group.equals("catalog") ? catalog : stats; }
  }
  public record Snapshot(Map<String, Object> data, Instant validUntil) {
    public Snapshot(Map<String, Object> data) { this(data, Instant.MAX); }
  }
  interface Transport {
    String get(String key) throws Exception;
    void put(String key, String value, Duration ttl) throws Exception;
  }

  @Autowired
  public JfPublicCache(JdbcTemplate db, PlatformTransactionManager transactions, RedissonClient redis,
      @Value("${JIAFENG_PUBLIC_CACHE_ENABLED:true}") boolean enabled,
      @Value("${JIAFENG_PUBLIC_CACHE_NAMESPACE:jiafeng}") String namespace) {
    this(db, transactions, new Transport() {
      private org.redisson.api.RBucket<String> bucket(String key) {
        // This object's options do not modify Sa-Token or any other client's retry/timeout policy.
        return redis.getBucket(PlainOptions.name(key).codec(StringCodec.INSTANCE)
            .timeout(Duration.ofMillis(100)).retryAttempts(0));
      }
      public String get(String key) throws Exception {
        var future = bucket(key).getAsync().toCompletableFuture();
        try { return future.get(100, TimeUnit.MILLISECONDS); }
        catch (Exception e) { future.cancel(false); throw e; }
      }
      public void put(String key, String value, Duration ttl) throws Exception {
        var future = bucket(key).setAsync(value, ttl).toCompletableFuture();
        try { future.get(100, TimeUnit.MILLISECONDS); }
        catch (Exception e) { future.cancel(false); throw e; }
      }
    }, enabled, namespace, Clock.systemUTC());
  }

  JfPublicCache(JdbcTemplate db, PlatformTransactionManager transactions, Transport transport,
      boolean enabled, String namespace, Clock clock) {
    this.db = db;
    this.transport = transport;
    this.enabled = enabled;
    if (namespace == null || !namespace.matches("[A-Za-z0-9_-]{1,64}"))
      throw new IllegalArgumentException("Public cache namespace must contain 1-64 ASCII letters, digits, - or _");
    this.namespace = namespace;
    this.clock = clock;
    snapshot = new TransactionTemplate(transactions);
    snapshot.setReadOnly(true);
    snapshot.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    snapshot.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  /** Must run in the same database transaction as the corresponding business mutation. */
  public static void touch(JdbcTemplate db, String kind, String id) {
    boolean catalog = CATALOG_KINDS.contains(kind) || (kind.equals("setting")
        && Set.of("homepageConfig", "platformConfig", "reviewFlow").contains(id));
    if (catalog) db.update("UPDATE jf_public_cache_state SET catalog_generation=catalog_generation+1,"
        + " stats_generation=stats_generation+1 WHERE id=1");
    else if (Set.of("mediaLike", "mediaFavorite").contains(kind))
      db.update("UPDATE jf_public_cache_state SET stats_generation=stats_generation+1 WHERE id=1");
  }

  Version version() {
    var row = db.queryForMap("SELECT epoch,catalog_generation,stats_generation FROM jf_public_cache_state WHERE id=1");
    return new Version(str(row, "epoch"), number(row.get("catalog_generation")), number(row.get("stats_generation")));
  }

  public Map<String, Object> get(String group, Supplier<Snapshot> builder) {
    if (!Set.of("catalog", "stats").contains(group)) throw new IllegalArgumentException("Unknown projection group");
    // Commands read their own uncommitted changes; those bytes must never enter a shared cache.
    if (TransactionSynchronizationManager.isActualTransactionActive()) {
      count("transaction_bypass");
      return copy(builder.get().data());
    }
    if (!enabled) { count("disabled_bypass"); return copy(build(builder).data()); }
    Supplier<Snapshot> boundedBuilder = () -> {
      Instant expires = clock.instant().plusSeconds(group.equals("catalog") ? 300 : 30);
      Snapshot value = builder.get();
      return new Snapshot(value.data(), value.validUntil().isBefore(expires) ? value.validUntil() : expires);
    };
    for (int attempt = 0; attempt < 3; attempt++) {
      Version before = version();
      String key = namespace + ":public:v1:" + before.epoch() + ":" + group + ":" + before.generation(group);
      Snapshot candidate = read(key);
      boolean hit = candidate != null;
      if (hit) count(group + "_hit");
      else {
        count(group + "_miss");
        candidate = singleFlight(key, boundedBuilder);
      }
      Version after = version();
      if (!before.epoch().equals(after.epoch()) || before.generation(group) != after.generation(group)
          || !candidate.validUntil().isAfter(clock.instant())) {
        count("version_or_time_retry");
        continue;
      }
      if (!hit) write(key, candidate, group.equals("catalog") ? 300 : 30);
      // Deep copies prevent a caller's own/private overlay from contaminating another request.
      return copy(candidate.data());
    }
    count("fresh_fallback");
    // A final consistent DB snapshot is never published. A current-state check detects concurrent withdrawal.
    Version before = version();
    Snapshot fresh = build(boundedBuilder);
    Version after = version();
    require(before.epoch().equals(after.epoch()) && before.generation(group) == after.generation(group)
        && fresh.validUntil().isAfter(clock.instant()), 503, "PUBLIC_CONTENT_UPDATING", "公开内容正在更新，请稍后刷新");
    return copy(fresh.data());
  }

  private Snapshot build(Supplier<Snapshot> builder) {
    long started = System.nanoTime();
    try { return snapshot.execute(status -> builder.get()); }
    finally { count("builds"); add("build_micros", (System.nanoTime() - started) / 1000); }
  }

  private Snapshot singleFlight(String key, Supplier<Snapshot> builder) {
    var future = new CompletableFuture<Snapshot>();
    var running = flights.putIfAbsent(key, future);
    if (running != null) {
      count("coalesced");
      try { return running.get(500, TimeUnit.MILLISECONDS); }
      catch (InterruptedException e) { Thread.currentThread().interrupt(); }
      catch (ExecutionException | TimeoutException ignored) { }
      return build(builder);
    }
    try {
      Snapshot value = build(builder);
      future.complete(value);
      return value;
    } catch (RuntimeException e) { future.completeExceptionally(e); throw e; }
    finally { flights.remove(key, future); }
  }

  private Snapshot read(String key) {
    if (clock.millis() < circuitUntil) { count("circuit_bypass"); return null; }
    try {
      String encoded = redisCall(() -> transport.get(key));
      if (encoded == null) return null;
      var envelope = parse(encoded);
      Instant until = Instant.parse(str(envelope, "validUntil"));
      if (!until.isAfter(clock.instant()) || !(envelope.get("data") instanceof Map)) return null;
      return new Snapshot(obj(envelope.get("data")), until);
    } catch (Exception e) { failed(e); return null; }
  }

  private void write(String key, Snapshot value, int maximumSeconds) {
    if (clock.millis() < circuitUntil) return;
    Instant until = clock.instant().plusSeconds(maximumSeconds);
    if (value.validUntil().isBefore(until)) until = value.validUntil();
    Duration ttl = Duration.between(clock.instant(), until);
    if (ttl.toMillis() < 1) return;
    String encoded = json(m("validUntil", until.toString(), "data", value.data()));
    try { redisCall(() -> { transport.put(key, encoded, ttl); return null; }); }
    catch (Exception e) { failed(e); }
  }

  private <T> T redisCall(Callable<T> action) throws Exception {
    long started = System.nanoTime();
    Future<T> task = null;
    try {
      task = redisCalls.submit(action);
      return task.get(100, TimeUnit.MILLISECONDS);
    } catch (Exception error) {
      if (task != null) task.cancel(true);
      throw error;
    } finally {
      long elapsed = (System.nanoTime() - started) / 1000;
      add("redis_calls", 1); add("redis_micros", elapsed); redisMaximumMicros.accumulate(elapsed);
    }
  }

  @PreDestroy
  public void close() { redisCalls.shutdownNow(); }

  private void failed(Exception error) {
    if (error instanceof InterruptedException) Thread.currentThread().interrupt();
    circuitUntil = clock.millis() + 5000;
    count("redis_failures");
  }
  private void count(String key) { add(key, 1); }
  private void add(String key, long value) { counters.computeIfAbsent(key, k -> new LongAdder()).add(value); }
  public Map<String, Long> metrics() {
    Map<String, Long> result = new TreeMap<>();
    counters.forEach((key, value) -> result.put(key, value.sum()));
    result.put("redis_max_micros", redisMaximumMicros.get());
    return result;
  }
  @Scheduled(fixedDelay = 60000)
  void report() { if (enabled && !counters.isEmpty()) LOG.info("Public projection cache counters: {}", metrics()); }
}
