package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class JfOperations {
  private final JfStore store;
  private final JfAuth auth;
  private final JfFiles files;
  private final JfCatalog catalog;

  public JfOperations(JfStore s, JfAuth a, JfFiles f, JfCatalog catalog) {
    store = s;
    auth = a;
    files = f;
    this.catalog = catalog;
  }

  private JfStore.Entity existing(JfAuth.Actor a, String kind, String id, Object version) {
    var e = store.find(kind, id, true);
    auth.operate(a, e.region());
    store.checkVersion(e, version);
    return e;
  }

  private String regionFor(JfAuth.Actor a, Map<String, Object> d, JfStore.Entity old) {
    String r =
        region(
            d.getOrDefault(
                "region",
                old == null ? a.regions.stream().findFirst().orElse("all") : old.region()));
    auth.operate(a, r);
    return r;
  }

  private Map<String, Object> save(
      JfAuth.Actor a,
      String kind,
      String id,
      Object version,
      Map<String, Object> d,
      String initial) {
    var old = id.isEmpty() ? null : existing(a, kind, id, version);
    String r = regionFor(a, d, old);
    var e =
        old == null ? store.create(kind, a.id, r, initial, d) : store.save(old, r, old.status(), d);
    return store.dto(e);
  }

  public Object command(
      JfAuth.Actor a, String cmd, String id, Object version, Map<String, Object> input) {
    require(a.operator(), 403, "FORBIDDEN", "当前账号没有运营权限");
    switch (cmd) {
      case "saveContent" -> {
        String language = str(input, "language");
        require(
            List.of("中文", "英文", "简体中文", "English", "zh", "en").contains(language),
            422,
            "INVALID_LANGUAGE",
            "请选择中文或英文");
        String category = str(input, "category");
        String topic = str(input, "topic");
        if (topic.isEmpty()) {
          topic =
              id.isEmpty() ? "everyday" : str(existing(a, "content", id, version).data(), "topic");
          if (topic.isEmpty()) topic = "everyday";
        }
        require(
            List.of("red", "integrity", "everyday", "classical").contains(topic),
            422,
            "INVALID_TOPIC",
            "内容专区无效");
        require(
            List.of("资讯", "公告", "Banner", "专题", "政策", "政策解读", "行业动态", "活动报道", "榜样人物")
                .contains(category),
            422,
            "INVALID_CATEGORY",
            "内容类型无效");
        return save(
            a,
            "content",
            id,
            version,
            m(
                "title",
                required(input, "title", 2, 100),
                "category",
                category,
                "topic",
                topic,
                "region",
                input.get("region"),
                "language",
                language,
                "summary",
                required(input, "summary", 1, 500),
                "body",
                required(input, "body", 1, 50000),
                "author",
                a.name,
                "views",
                0),
            "草稿");
      }
      case "setContentStatus" -> {
        var e = existing(a, "content", id, version);
        String state = str(input, "status");
        require(List.of("草稿", "已发布", "已下架").contains(state), 422, "INVALID_STATUS", "发布状态无效");
        var saved = store.save(e, e.region(), state, e.data());
        if (state.equals("已发布") && !e.status().equals("已发布")) catalog.notifyContentPublished(saved);
        return ok();
      }
      case "saveCollection" -> {
        var old = id.isEmpty() ? null : existing(a, "collection", id, version);
        var d =
            m(
                "title",
                required(input, "title", 2, 100),
                "subtitle",
                required(input, "subtitle", 0, 300),
                "region",
                input.get("region"),
                "theme",
                required(input, "theme", 1, 80),
                "chapters",
                old == null ? List.of() : old.data().get("chapters"),
                "color",
                old == null ? "#8b372f" : old.data().get("color"));
        return save(a, "collection", id, version, d, "编纂中");
      }
      case "saveChapter", "moveChapter", "importChapter", "collectVolume" -> {
        var e = existing(a, "collection", id, version);
        var d = copy(e.data());
        List<Object> chapters = new ArrayList<>(list(d.get("chapters")));
        String state = "编纂中";
        if (cmd.equals("collectVolume")) {
          require(!chapters.isEmpty(), 422, "EMPTY_COLLECTION", "请先添加章节");
          state = "已入藏";
        } else if (cmd.equals("moveChapter")) {
          int index = (int) number(input.get("index"));
          int direction = (int) number(input.get("direction"));
          require(
              Math.abs(direction) == 1
                  && index >= 0
                  && index < chapters.size()
                  && index + direction >= 0
                  && index + direction < chapters.size(),
              422,
              "INVALID_ORDER",
              "章节排序无效");
          Collections.swap(chapters, index, index + direction);
        } else if (cmd.equals("importChapter")) {
          var s = store.find("submission", required(input, "submissionId", 1, 64), false);
          auth.operate(a, s.region());
          require(
              List.of("shortlisted", "awarded", "collected").contains(s.status())
                  && bool(s.data().get("published")),
              409,
              "NOT_APPROVED",
              "仅可导入已批准公开作品");
          chapters.add(
              m(
                  "id",
                  id("chapter_"),
                  "title",
                  s.data().get("title"),
                  "author",
                  s.data().get("author"),
                  "body",
                  s.data().get("content"),
                  "submissionId",
                  s.id(),
                  "revisionId",
                  s.data().get("revisionId")));
        } else {
          String chapterId = str(input, "chapterId");
          Map<String, Object> chapter =
              m(
                  "id",
                  chapterId.isEmpty() ? id("chapter_") : chapterId,
                  "title",
                  required(input, "title", 1, 100),
                  "author",
                  required(input, "author", 0, 100),
                  "body",
                  required(input, "body", 1, 50000));
          int i = -1;
          for (int k = 0; k < chapters.size(); k++)
            if (str(obj(chapters.get(k)), "id").equals(chapterId)) i = k;
          if (chapterId.isEmpty()) chapters.add(chapter);
          else {
            require(i >= 0, 404, "NOT_FOUND", "章节不存在");
            chapters.set(i, chapter);
          }
        }
        d.put("chapters", chapters);
        store.save(e, e.region(), state, d);
        return ok();
      }
      case "saveActivity" -> {
        long capacity = number(input.get("capacity"));
        require(capacity >= 1 && capacity <= 100000, 422, "INVALID_CAPACITY", "名额须为1至100000");
        String start = required(input, "startAt", 1, 50), end = required(input, "endAt", 1, 50);
        require(date(end).isAfter(date(start)), 422, "INVALID_DATE", "结束时间须晚于开始时间");
        var old = id.isEmpty() ? null : existing(a, "activity", id, version);
        if (old != null) {
          long registered =
              store
                  .db()
                  .queryForObject(
                      "SELECT COUNT(*) FROM jf_registration WHERE activity_id=? AND"
                          + " status='registered'",
                      Long.class,
                      id);
          require(capacity >= registered, 409, "CAPACITY_CONFLICT", "名额不能少于已报名人数");
        }
        return save(
            a,
            "activity",
            id,
            version,
            m(
                "title",
                required(input, "title", 2, 100),
                "type",
                required(input, "type", 1, 80),
                "region",
                input.get("region"),
                "location",
                required(input, "location", 1, 200),
                "startAt",
                date(start).toString(),
                "endAt",
                date(end).toString(),
                "capacity",
                capacity,
                "summary",
                required(input, "summary", 1, 2000)),
            "草稿");
      }
      case "setActivityStatus" -> {
        var e = existing(a, "activity", id, version);
        String state = str(input, "status");
        require(
            (e.status().equals("草稿") && state.equals("报名中"))
                || (e.status().equals("报名中") && state.equals("进行中"))
                || (List.of("报名中", "进行中").contains(e.status()) && state.equals("已结束")),
            409,
            "INVALID_STATE",
            "活动状态不能这样变更");
        store.save(e, e.region(), state, e.data());
        return ok();
      }
      case "toggleAttendance" -> {
        var e = existing(a, "activity", id, version);
        require(List.of("报名中", "进行中").contains(e.status()), 409, "INVALID_STATE", "该活动目前不能签到");
        int n =
            store
                .db()
                .update(
                    "UPDATE jf_registration SET checked_in=?,version=version+1 WHERE id=? AND"
                        + " activity_id=? AND status='registered'",
                    bool(input.get("checkedIn")),
                    str(input, "registrationId"),
                    id);
        require(n == 1, 404, "NOT_FOUND", "报名记录不存在");
        Long attendee =
            store
                .db()
                .queryForObject(
                    "SELECT user_id FROM jf_registration WHERE id=?",
                    Long.class,
                    str(input, "registrationId"));
        store.recordCheckIn(id, attendee, e.region(), bool(input.get("checkedIn")));
        store.save(e, e.region(), e.status(), e.data());
        return ok();
      }
      case "saveCourse" -> {
        long duration = number(input.get("duration")), chapters = number(input.get("chapters"));
        require(
            duration >= 1 && duration <= 300 && chapters >= 1 && chapters <= 50,
            422,
            "INVALID_COURSE",
            "课程时长或章节数量无效");
        var old = id.isEmpty() ? null : existing(a, "course", id, version);
        List<Object> lessons =
            new ArrayList<>(
                list(
                    input.getOrDefault(
                        "lessons", old == null ? List.of() : old.data().get("lessons"))));
        String description = required(input, "description", 10, 10000);
        if (lessons.isEmpty()
            || (!input.containsKey("lessons")
                && lessons.size() == 1
                && str(obj(lessons.getFirst()), "id").equals("intro"))) {
          lessons.clear();
          lessons.add(
              m("id", "intro", "title", "课程导读", "body", description, "practice", "阅读后记录你的理解。"));
        }
        return save(
            a,
            "course",
            id,
            version,
            m(
                "title",
                required(input, "title", 4, 100),
                "category",
                required(input, "category", 1, 100),
                "region",
                input.getOrDefault(
                    "region",
                    old == null ? a.regions.stream().findFirst().orElse("all") : old.region()),
                "duration",
                duration,
                "chapters",
                lessons.size(),
                "description",
                description,
                "teacher",
                required(input, "teacher", 1, 100),
                "lessons",
                lessons),
            "草稿");
      }
      case "toggleCourse" -> {
        var e = existing(a, "course", id, version);
        String state = str(input, "status");
        if (state.isEmpty()) state = e.status().equals("已上架") ? "已下架" : "已上架";
        require(List.of("已上架", "已下架").contains(state), 422, "INVALID_STATUS", "课程状态无效");
        store.save(e, e.region(), state, e.data());
        return ok();
      }
      case "saveProduct" -> {
        long stock = number(input.get("stock")), quota = number(input.get("quota"));
        require(
            stock >= 0 && stock <= 1000000 && quota >= 1 && quota <= 10000,
            422,
            "INVALID_STOCK",
            "库存或单次额度无效");
        var old = id.isEmpty() ? null : existing(a, "product", id, version);
        var d =
            old == null
                ? m(
                    "title",
                    required(input, "title", 2, 100),
                    "subtitle",
                    str(input, "description"),
                    "description",
                    str(input, "description"),
                    "category",
                    input.getOrDefault("category", input.getOrDefault("type", "公益文创")),
                    "color",
                    "#ae3b30",
                    "glyph",
                    "礼",
                    "region",
                    input.getOrDefault("region", a.regions.stream().findFirst().orElse("all")))
                : copy(old.data());
        d.putAll(m("stock", stock, "quota", quota));
        return save(a, "product", id, version, d, "已上架");
      }
      case "toggleProduct" -> {
        var e = existing(a, "product", id, version);
        String state = str(input, "status");
        if (state.isEmpty()) state = e.status().equals("已上架") ? "已下架" : "已上架";
        require(List.of("已上架", "已下架").contains(state), 422, "INVALID_STATUS", "产品状态无效");
        store.save(e, e.region(), state, e.data());
        return ok();
      }
      case "processClaim" -> {
        var e = existing(a, "claim", id, version);
        var product = store.find("product", str(e.data(), "productId"), true);
        auth.operate(a, product.region());
        var d = copy(e.data());
        String action = str(input, "action"), state = e.status();
        if (action.equals("deliver")) {
          require(state.equals("待发放"), 409, "INVALID_STATE", "只可发放待发放记录");
          long qty = number(d.get("quantity")), stock = number(product.data().get("stock"));
          require(stock >= qty, 409, "OUT_OF_STOCK", "库存不足");
          var p = copy(product.data());
          p.put("stock", stock - qty);
          store.save(product, product.region(), product.status(), p);
          state = "已发放";
        } else {
          require(state.equals("待审核"), 409, "INVALID_STATE", "该申领已处理");
          if (action.equals("approve")) {
            require(
                number(d.get("quantity")) <= number(product.data().get("quota")),
                422,
                "QUOTA_EXCEEDED",
                "超出单次申领额度");
            state = "待发放";
          } else {
            require(action.equals("return"), 422, "INVALID_ACTION", "动作无效");
            d.put("note", required(input, "note", 5, 2000));
            state = "已退回";
          }
        }
        store.save(e, e.region(), state, d);
        store.notifyUser(e.owner(), e.region(), "公益申领进度更新", state, "");
        return ok();
      }
      case "saveDictionaryWord" -> {
        String word = required(input, "word", 1, 100);
        var d =
            m(
                "word",
                word,
                "type",
                required(input, "type", 1, 50),
                "action",
                required(input, "action", 1, 50),
                "note",
                required(input, "note", 0, 1000),
                "enabled",
                true);
        return save(a, "dictionary", id, version, d, "active");
      }
      case "toggleDictionaryWord" -> {
        var e = existing(a, "dictionary", id, version);
        var d = copy(e.data());
        d.put(
            "enabled",
            input.containsKey("enabled") ? bool(input.get("enabled")) : !bool(d.get("enabled")));
        store.save(e, e.region(), e.status(), d);
        return ok();
      }
      case "saveKnowledgeDocument" -> {
        String fid = required(input, "fileId", 1, 64);
        files.metadata(fid, a.id);
        return save(
            a,
            "knowledge",
            id,
            version,
            m(
                "title",
                required(input, "title", 1, 150),
                "category",
                required(input, "category", 1, 100),
                "fileId",
                fid,
                "documents",
                1,
                "version",
                "v1",
                "updated",
                now().substring(0, 10),
                "description",
                input.getOrDefault("description", "资料已存储，尚未建立检索索引。"),
                "region",
                input.getOrDefault("region", a.regions.stream().findFirst().orElse("all"))),
            "未索引");
      }
      case "savePlatformConfig" -> {
        require(a.national(), 403, "FORBIDDEN", "仅全国管理员可修改系统设置");
        var e = existing(a, "setting", "platformConfig", version);
        var d =
            m(
                "name",
                required(input, "name", 2, 80),
                "subtitle",
                required(input, "subtitle", 1, 200),
                "contact",
                required(input, "contact", 1, 100),
                "language",
                required(input, "language", 1, 50),
                "regionLabel",
                required(input, "regionLabel", 0, 100),
                "reviewReminder",
                bool(input.get("reviewReminder")),
                "draftNotice",
                bool(input.get("draftNotice")),
                "notice",
                required(input, "notice", 0, 1000));
        store.save(e, "all", "active", d);
        return ok();
      }
      case "saveNotificationDraft" -> {
        return save(
            a,
            "notice",
            id,
            version,
            m(
                "title",
                required(input, "title", 4, 100),
                "audience",
                required(input, "audience", 1, 100),
                "content",
                required(input, "content", 10, 5000),
                "date",
                now().substring(0, 10)),
            "draft");
      }
      case "publishNotification" -> {
        var e = existing(a, "notice", id, version);
        require(e.status().equals("draft"), 409, "ALREADY_PUBLISHED", "通知已发送");
        for (var row :
            store.db().queryForList("SELECT user_id,region_ids FROM jf_account WHERE enabled=1")) {
          var recipient = auth.byId(number(row.get("user_id")));
          if ((a.national() || recipient.regions.stream().anyMatch(a.regions::contains))
              && (str(e.data(), "audience").equals("全体用户")
                  || str(e.data(), "audience").equals("全部用户")
                  || recipient.roles.stream()
                      .anyMatch(
                          role ->
                              (role.equals("expert") && str(e.data(), "audience").equals("评审专家"))
                                  || roleLabel(role).contains(str(e.data(), "audience")))))
            store.notifyUser(
                recipient.id, e.region(), str(e.data(), "title"), str(e.data(), "content"), "");
        }
        store.save(e, e.region(), "published", e.data());
        return ok();
      }
      case "saveUserRoles", "toggleUser", "approveUser" -> {
        long uid = number(id);
        var target = auth.adminTarget(uid);
        require(
            a.national()
                || (!target.national() && target.regions.stream().allMatch(a.regions::contains)),
            404,
            "NOT_FOUND",
            "用户不可见");
        require(version != null, 428, "VERSION_REQUIRED", "缺少用户版本");
        require(number(version) == target.version, 412, "VERSION_CONFLICT", "用户已更新");
        require(a.id != uid, 409, "SELF_CHANGE_FORBIDDEN", "不能通过此操作修改自己的权限或状态");
        if (cmd.equals("saveUserRoles")) {
          require(a.national(), 403, "FORBIDDEN", "仅全国管理员可调整岗位");
          List<Object> roles = list(input.get("roles"));
          require(!roles.isEmpty(), 422, "ROLE_REQUIRED", "至少选择一个岗位");
          Set<String> mapped = new LinkedHashSet<>();
          for (Object role : roles) {
            String s = text(role);
            mapped.add(
                switch (s) {
                  case "超级管理员", "全国管理员", "national_admin" -> "national_admin";
                  case "专家", "expert" -> "expert";
                  case "投稿用户", "member" -> "member";
                  case "内容运营", "评审管理", "区域运营", "数据运营", "regional_admin" -> "regional_admin";
                  default -> throw error(422, "INVALID_ROLE", "未知岗位");
                });
          }
          store
              .db()
              .update(
                  "UPDATE jf_account SET roles=?,version=version+1 WHERE user_id=?",
                  json(mapped),
                  uid);
          if (mapped.contains("expert")
              && store.all("expert").stream().noneMatch(e -> Objects.equals(e.owner(), uid)))
            store
                .db()
                .update(
                    "INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload)"
                        + " VALUES(?,'expert',?,?,'active',?)",
                    id,
                    uid,
                    target.regions.stream().findFirst().orElse("all"),
                    json(
                        m(
                            "name",
                            target.name,
                            "title",
                            "评审专家",
                            "organization",
                            "家风平台",
                            "group",
                            "文学创作组",
                            "availability",
                            "可分配",
                            "specialties",
                            List.of(),
                            "biography",
                            "")));
        } else if (cmd.equals("toggleUser")) {
          store
              .db()
              .update(
                  "UPDATE jf_account SET enabled=?,version=version+1 WHERE user_id=?",
                  bool(input.get("enabled")),
                  uid);
        } else {
          store
              .db()
              .update(
                  "UPDATE jf_account SET"
                      + " profile=JSON_SET(profile,'$.status','已通过'),version=version+1 WHERE"
                      + " user_id=?",
                  uid);
        }
        return ok();
      }
      default -> throw error(422, "UNKNOWN_COMMAND", "不支持的运营动作");
    }
  }

  public static String roleLabel(String role) {
    return switch (role) {
      case "national_admin" -> "全国管理员";
      case "regional_admin" -> "区域运营";
      case "expert" -> "专家";
      default -> "投稿用户";
    };
  }

  public static Instant date(String value) {
    try {
      return Instant.parse(value);
    } catch (Exception e) {
      try {
        return LocalDateTime.parse(value.replace(' ', 'T'))
            .atZone(ZoneId.of("Asia/Shanghai"))
            .toInstant();
      } catch (Exception ignored) {
        throw error(422, "INVALID_DATE", "时间格式无效");
      }
    }
  }

  private Map<String, Object> ok() {
    return m("ok", true, "message", "操作已保存");
  }
}
