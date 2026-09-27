package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;

/** Owner-only records: never reused as public catalog or operational content. */
@Service
public class JfPersonalRecords {
  private final JfStore store;
  private final JfFiles files;

  public JfPersonalRecords(JfStore store, JfFiles files) {
    this.store = store;
    this.files = files;
  }

  public Object command(JfAuth.Actor actor, String command, String id, Object version,
      Map<String, Object> data) {
    require(actor.realm.equals("member"), 403, "FORBIDDEN", "请使用会员账号保存个人记录");
    String region = actor.regions.stream().filter(r -> !r.equals("all")).findFirst().orElse("all");
    if (command.equals("recitation.create")) {
      require(bool(data.get("consent")), 422, "CONSENT_REQUIRED", "请确认有权上传此录音");
      String title = required(data, "title", 2, 100);
      var file = files.recitationMetadata(required(data, "fileId", 1, 64), actor.id);
      var record = store.create("recitation", actor.id, region, "active",
          m("title", title, "category", "reading", "fileId", file.get("fileId"),
              "fileName", file.get("name"), "size", file.get("size"),
              "duration", file.get("duration"), "consentVersion", "recitation-private-v1"));
      return dto(record);
    }
    if (command.equals("familyPromise.save")) {
      String personId = required(data, "personId", 1, 64);
      String text = required(data, "text", 4, 180);
      String key = promiseId(actor.id, personId);
      require(id.isEmpty() || id.equals(key), 404, "NOT_FOUND", "约定不存在");
      var rows = store.db().queryForList("SELECT id FROM jf_entity WHERE id=? FOR UPDATE", key);
      if (rows.isEmpty()) {
        require(version != null, 428, "VERSION_REQUIRED", "缺少记录版本，请刷新后重试");
        require(number(version) == 0, 412, "VERSION_CONFLICT", "约定已变化，请重新读取");
        var person = store.find("hallPerson", personId, false);
        require(person.status().equals("已发布"), 404, "NOT_FOUND", "人物不存在或未发布");
        var payload = m("personId", personId, "personName", str(person.data(), "title"),
            "personLanguage", str(person.data(), "language"), "text", text);
        int inserted = store.db().update("INSERT IGNORE INTO jf_entity"
                + "(id,kind,owner_id,region_id,status,payload) VALUES(?,'familyPromise',?,?,'active',?)",
            key, actor.id, region, json(payload));
        require(inserted == 1, 412, "VERSION_CONFLICT", "约定已被其他设备保存，请重新读取");
        return dto(store.find("familyPromise", key, false));
      }
      var old = owned(actor, "familyPromise", key);
      if (old.status().equals("deleted")) {
        require(version != null && number(version) == 0, 412, "VERSION_CONFLICT", "约定已删除，请重新读取");
      } else store.checkVersion(old, version);
      var payload = new LinkedHashMap<>(old.data());
      payload.put("text", text);
      return dto(store.save(old, old.region(), "active", payload));
    }
    String kind = command.equals("recitation.remove") ? "recitation" : "familyPromise";
    require(Set.of("recitation.remove", "familyPromise.remove").contains(command),
        422, "INVALID_COMMAND", "不支持的个人记录操作");
    var old = owned(actor, kind, id);
    store.checkVersion(old, version);
    store.save(old, old.region(), "deleted", old.data());
    // Referenced media submissions retain the same source file. Storage reclamation is separate.
    return m("ok", true);
  }

  private JfStore.Entity owned(JfAuth.Actor actor, String kind, String id) {
    var record = store.find(kind, id, true);
    require(Objects.equals(record.owner(), actor.id), 404, "NOT_FOUND", "记录不存在");
    return record;
  }

  static String promiseId(long owner, String person) {
    return "promise_" + hash(owner + ":" + person).substring(0, 40);
  }

  private Map<String, Object> dto(JfStore.Entity e) {
    var d = new LinkedHashMap<>(e.data());
    d.remove("consentVersion");
    d.putAll(m("id", e.id(), "lockVersion", e.version(), "createdAt", e.createdAt(),
        "updatedAt", e.updatedAt()));
    if (e.kind().equals("familyPromise")) {
      boolean available = store.db().queryForObject(
          "SELECT COUNT(*) FROM jf_entity WHERE id=? AND kind='hallPerson' AND status='已发布'",
          Long.class, str(e.data(), "personId")) > 0;
      d.put("targetAvailable", available);
    }
    return d;
  }

  public void addMember(Map<String, Object> out, JfAuth.Actor actor) {
    for (String kind : List.of("recitation", "familyPromise")) {
      var rows = actor == null ? List.of() : store.all(kind).stream()
          .filter(e -> Objects.equals(e.owner(), actor.id) && e.status().equals("active"))
          .map(this::dto).toList();
      out.put(kind.equals("recitation") ? "recitations" : "familyPromises", rows);
    }
  }

  public void addAdmin(Map<String, Object> out, JfAuth.Actor actor) {
    Map<String, Map<String, Object>> byRegion = new LinkedHashMap<>();
    long recitations = 0, promises = 0;
    if (actor.operator()) {
      for (var row : store.db().queryForList("SELECT region_id,kind,COUNT(*) record_count"
          + " FROM jf_entity WHERE kind IN ('recitation','familyPromise')"
          + " AND status='active' GROUP BY region_id,kind")) {
        String region = str(row, "region_id");
        if (!actor.region(region)) continue;
        String kind = str(row, "kind");
        long count = number(row.get("record_count"));
        var group = byRegion.computeIfAbsent(region,
            r -> m("regionId", r, "recitations", 0L, "familyPromises", 0L));
        if (kind.equals("recitation")) { recitations += count; group.put("recitations", count); }
        else { promises += count; group.put("familyPromises", count); }
      }
    }
    out.put("privateRecordStats", m("recitations", recitations, "familyPromises", promises,
        "byRegion", new ArrayList<>(byRegion.values())));
  }
}
