package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Indexed ownership/status columns plus versioned domain documents, not browser snapshots. */
@Repository
public class JfStore {
  private final JdbcTemplate db;

  public JdbcTemplate db() {
    return db;
  }

  public JfStore(JdbcTemplate db) {
    this.db = db;
  }

  public record Entity(
      String id,
      String kind,
      Long owner,
      String region,
      String status,
      Map<String, Object> data,
      long version,
      String createdAt,
      String updatedAt) {}

  private Entity row(ResultSet r, int ignored) throws SQLException {
    return new Entity(
        r.getString("id"),
        r.getString("kind"),
        (Long) r.getObject("owner_id"),
        r.getString("region_id"),
        r.getString("status"),
        parse(r.getString("payload")),
        r.getLong("version"),
        r.getTimestamp("created_at").toInstant().toString(),
        r.getTimestamp("updated_at").toInstant().toString());
  }

  public List<Entity> all(String kind) {
    return db.query(
        "SELECT * FROM jf_entity WHERE kind=? ORDER BY created_at DESC,id", this::row, kind);
  }

  /** Predicates are server-owned SQL, never request fragments. */
  public List<Entity> select(String kind, String predicate, Object... args) {
    Object[] parameters = new Object[args.length + 1];
    parameters[0] = kind;
    System.arraycopy(args, 0, parameters, 1, args.length);
    return db.query(
        "SELECT * FROM jf_entity WHERE kind=? AND (" + predicate + ") ORDER BY created_at DESC,id",
        this::row, parameters);
  }

  public Entity find(String kind, String id, boolean lock) {
    List<Entity> rows =
        db.query(
            "SELECT * FROM jf_entity WHERE kind=? AND id=?" + (lock ? " FOR UPDATE" : ""),
            this::row,
            kind,
            id);
    if (rows.isEmpty()) throw error(404, "NOT_FOUND", "记录不存在或不可见");
    return rows.getFirst();
  }

  @Transactional
  public Entity create(
      String kind, Long owner, String region, String status, Map<String, Object> data) {
    String id = id(kind + "_");
    db.update(
        "INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload) VALUES(?,?,?,?,?,?)",
        id,
        kind,
        owner,
        region,
        status,
        json(data));
    var entity = find(kind, id, false);
    enqueueSearch(entity);
    JfReviewWindows.sync(db, entity);
    JfPublicCache.touch(db, entity.kind(), entity.id());
    return entity;
  }

  @Transactional
  public Entity save(Entity e, String region, String status, Map<String, Object> data) {
    int n =
        db.update(
            "UPDATE jf_entity SET"
                + " region_id=?,status=?,payload=?,version=version+1,updated_at=CURRENT_TIMESTAMP(3)"
                + " WHERE id=? AND version=?",
            region,
            status,
            json(data),
            e.id,
            e.version);
    require(n == 1, 412, "VERSION_CONFLICT", "记录已更新，请刷新后重试");
    var entity = find(e.kind, e.id, false);
    enqueueSearch(entity);
    JfReviewWindows.sync(db, entity);
    JfPublicCache.touch(db, entity.kind(), entity.id());
    return entity;
  }

  /** No network I/O: the projection and committed generation commit with the business write. */
  private void enqueueSearch(Entity entity) {
    if (!JfSearch.ENTITY_KINDS.contains(entity.kind())) return;
    db.update("UPDATE jf_search_state SET committed_generation=committed_generation+1 WHERE id=1");
    Long generation =
        db.queryForObject("SELECT committed_generation FROM jf_search_state WHERE id=1", Long.class);
    var document = JfSearch.document(entity);
    db.update(
        "INSERT INTO jf_search_outbox(generation,entity_id,entity_kind,document) VALUES(?,?,?,?)",
        generation, entity.id(), entity.kind(), document == null ? null : json(document));
  }

  public void checkVersion(Entity e, Object version) {
    require(version != null, 428, "VERSION_REQUIRED", "缺少记录版本，请刷新后重试");
    require(number(version) == e.version, 412, "VERSION_CONFLICT", "记录已更新，请刷新后重试");
  }

  public Map<String, Object> dto(Entity e) {
    Map<String, Object> d = copy(e.data);
    d.putAll(
        m(
            "id",
            e.id,
            "regionId",
            e.region,
            "region",
            regionName(e.region),
            "status",
            e.status,
            "lockVersion",
            e.version,
            "createdAt",
            e.createdAt,
            "updatedAt",
            e.updatedAt));
    return d;
  }

  public void audit(
      JfAuth.Actor actor, String action, String target, String region, Map<String, Object> detail) {
    db.update(
        "INSERT INTO jf_audit(id,actor_id,region_id,action,target_id,detail) VALUES(?,?,?,?,?,?)",
        id("log_"),
        actor.id,
        region,
        action,
        target,
        json(detail));
  }

  public void notifyUser(long owner, String region, String title, String content, String workId) {
    create(
        "notification",
        owner,
        region,
        "unread",
        m("title", title, "content", content, "workId", workId, "read", false));
  }

  public void recordCheckIn(String activity, long owner, String region, boolean checked) {
    String key = "checkin_" + hash(activity + ":" + owner).substring(0, 32);
    if (checked)
      db.update(
          "INSERT IGNORE INTO jf_entity(id,kind,owner_id,region_id,status,payload)"
              + " VALUES(?,'checkin',?,?,'active',?)",
          key,
          owner,
          region,
          json(m("activityId", activity, "checkedAt", now())));
    else db.update("DELETE FROM jf_entity WHERE id=? AND kind='checkin'", key);
  }

  public String checkInTime(String activity, long owner) {
    var rows =
        db.queryForList(
            "SELECT payload FROM jf_entity WHERE id=? AND kind='checkin'",
            "checkin_" + hash(activity + ":" + owner).substring(0, 32));
    if (!rows.isEmpty()) return str(parse(text(rows.getFirst().get("payload"))), "checkedAt");
    // Earlier development records can be traced to a real self check-in audit event.
    var history =
        db.queryForList(
            "SELECT created_at FROM jf_audit WHERE target_id=? AND actor_id=? AND"
                + " action='activity.checkIn' ORDER BY created_at DESC LIMIT 1",
            activity,
            owner);
    return history.isEmpty() ? "" : timestamp(history.getFirst().get("created_at"));
  }

  public Object idempotent(
      JfAuth.Actor actor,
      String operation,
      String key,
      Object payload,
      java.util.function.Supplier<Object> work) {
    require(
        key != null && key.length() >= 8 && key.length() <= 128,
        428,
        "IDEMPOTENCY_REQUIRED",
        "请提供 Idempotency-Key");
    // Account row serializes the check and write inside the caller's transaction.
    db.queryForObject(
        "SELECT user_id FROM jf_account WHERE user_id=? FOR UPDATE", Long.class, actor.id);
    List<Map<String, Object>> cached =
        db.queryForList(
            "SELECT request_hash,response FROM jf_idempotency WHERE account_id=? AND operation=?"
                + " AND idem_key=? FOR UPDATE",
            actor.id,
            operation,
            key);
    String digest = hash(json(payload));
    if (!cached.isEmpty()) {
      require(
          digest.equals(cached.getFirst().get("request_hash")),
          409,
          "IDEMPOTENCY_CONFLICT",
          "同一重试标识不能用于不同内容");
      return JsonUtilsBridge.read(text(cached.getFirst().get("response")));
    }
    Object response = work.get();
    db.update(
        "INSERT INTO jf_idempotency(account_id,operation,idem_key,request_hash,response)"
            + " VALUES(?,?,?,?,?)",
        actor.id,
        operation,
        key,
        digest,
        json(response));
    return response;
  }

  private static class JsonUtilsBridge {
    static Object read(String s) {
      return org.dromara.common.json.utils.JsonUtils.parseObject(s, Object.class);
    }
  }
}
