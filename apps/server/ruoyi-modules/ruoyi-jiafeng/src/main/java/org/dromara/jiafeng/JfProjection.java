package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import java.time.Instant;
import org.springframework.stereotype.Service;

/** Audience-specific projections. Expert responses never contain manuscript originals. */
@Service
public class JfProjection {
  private final JfStore store;
  private final JfSubmissions submissions;
  private final JfCatalog catalog;
  private final JfPersonalRecords personalRecords;
  private final JfPublicCache cache;
  private final JfReviewWindows reviewWindows;
  private final JfEducation education;

  public JfProjection(JfStore s, JfSubmissions w, JfCatalog catalog, JfPersonalRecords personalRecords,
      JfPublicCache cache, JfReviewWindows reviewWindows, JfEducation education) {
    store = s;
    submissions = w;
    this.catalog = catalog;
    this.personalRecords = personalRecords;
    this.cache = cache;
    this.reviewWindows = reviewWindows;
    this.education = education;
  }

  private List<JfStore.Entity> scoped(String kind, JfAuth.Actor a) {
    return store.all(kind).stream().filter(e -> a.operator() && a.region(e.region())).toList();
  }

  public Map<String, Object> admin(JfAuth.Actor a) {
    Map<String, Object> out = new LinkedHashMap<>();
    catalog.addAdmin(out, a);
    personalRecords.addAdmin(out, a);
    List<JfStore.Entity> tasks =
        store.all("task").stream()
            .filter(
                e ->
                    a.operator()
                        ? a.region(e.region())
                        : Objects.equals(a.id, e.owner()) && !e.status().equals("已取消"))
            .toList();
    List<Map<String, Object>> works = new ArrayList<>();
    if (a.operator()) {
      for (var e : scoped("submission", a)) works.add(adminWork(e));
    } else {
      for (var task : tasks) {
        Map<String, Object> d = task.data();
        works.add(
            m(
                "id",
                d.get("submissionId"),
                "title",
                d.get("title"),
                "author",
                "匿名作者",
                "region",
                regionName(task.region()),
                "regionId",
                task.region(),
                "genre",
                "",
                "theme",
                "",
                "channel",
                "",
                "source",
                "匿名材料",
                "submittedAt",
                d.get("assignedAt"),
                "status",
                "评审中",
                "content",
                d.get("content"),
                "blindContent",
                d.get("content"),
                "blindConfirmed",
                true,
                "version",
                1,
                "attachments",
                List.of(),
                "files",
                List.of(),
                "history",
                List.of(),
                "lockVersion",
                0));
      }
    }
    out.put("submissions", works);
    out.put(
        "tasks",
        tasks.stream()
            .map(
                e -> {
                  var d = store.dto(e);
                  d.putAll(reviewWindows.projection(e, a));
                  if (!a.operator()) d.remove("windowHistory");
                  return d;
                })
            .toList());
    out.put(
        "experts",
        a.operator() ? scoped("expert", a).stream().map(store::dto).toList() : List.of());
    Map<String, String> kinds =
        mapping(
            "contents",
            "content",
            "collections",
            "collection",
            "activities",
            "activity",
            "products",
            "product",
            "welfareClaims",
            "claim",
            "courses",
            "course",
            "knowledgeBases",
            "knowledge",
            "aiRecords",
            "aiLog",
            "dictionaryWords",
            "dictionary",
            "notificationDrafts",
            "notice");
    for (var entry : kinds.entrySet()) {
      List<Map<String, Object>> items = new ArrayList<>();
      for (var e : scoped(entry.getValue(), a)) {
        var d = store.dto(e);
        if (e.kind().equals("activity")) d.put("registrations", registrations(e.id()));
        if (e.kind().equals("dictionary")) d.put("enabled", bool(e.data().get("enabled")));
        if (e.kind().equals("claim")) d.put("date", e.createdAt().substring(0, 10));
        if (e.kind().equals("notice"))
          d.put("status", e.status().equals("published") ? "已发送" : "草稿");
        items.add(d);
      }
      out.put(entry.getKey(), items);
    }
    List<Map<String, Object>> users = new ArrayList<>();
    if (a.operator())
      for (var row :
          store
              .db()
              .queryForList(
                  "SELECT a.*,u.user_name,u.nick_name FROM jf_account a JOIN sys_user u ON"
                      + " a.user_id=u.user_id ORDER BY a.user_id")) {
        List<Object> regions = jsonList(row.get("region_ids"));
        if (!a.national() && !regions.stream().allMatch(x -> a.region(text(x)))) continue;
        Map<String, Object> profile = parse(text(row.get("profile")));
        users.add(
            m(
                "id",
                text(row.get("user_id")),
                "name",
                row.get("nick_name"),
                "username",
                row.get("user_name"),
                "organization",
                profile.getOrDefault("organization", ""),
                "region",
                regionName(regions.isEmpty() ? "all" : text(regions.getFirst())),
                "regionIds",
                regions,
                "roles",
                jsonList(row.get("roles")).stream()
                    .map(x -> JfOperations.roleLabel(text(x)))
                    .toList(),
                "enabled",
                bool(row.get("enabled")) || "1".equals(text(row.get("enabled"))),
                "joined",
                timestamp(row.get("created_at")).substring(0, 10),
                "avatar",
                text(row.get("nick_name")).substring(0, 1),
                "status",
                profile.getOrDefault("status", "待审核"),
                "lockVersion",
                number(row.get("version"))));
      }
    out.put("users", users);
    List<Map<String, Object>> groups = new ArrayList<>();
    var learningRecords = scoped("learning", a);
    for (var course : scoped("course", a)) {
      List<JfStore.Entity> records =
          learningRecords.stream()
              .filter(e -> str(e.data(), "courseId").equals(course.id()))
              .toList();
      groups.add(
          m(
              "id",
              course.id(),
              "name",
              str(course.data(), "title") + "学习台账",
              "region",
              regionName(course.region()),
              "members",
              records.size(),
              "courseId",
              course.id(),
              "completed",
              records.stream().filter(e -> e.status().equals("completed")).count(),
              "declarations",
              0,
              "date",
              course.updatedAt().substring(0, 10)));
    }
    out.put("learningGroups", groups);
    out.put("reviewFlow", store.dto(store.find("setting", "reviewFlow", false)));
    out.put("scoringDimensions", DIMENSIONS);
    out.put("platformConfig", store.dto(store.find("setting", "platformConfig", false)));
    out.put("roles", a.roles);
    out.put("permissions", a.permissions());
    List<Map<String, Object>> logs = new ArrayList<>();
    if (a.operator())
      for (var row :
          store
              .db()
              .queryForList(
                  "SELECT l.*,u.nick_name FROM jf_audit l LEFT JOIN sys_user u ON"
                      + " l.actor_id=u.user_id ORDER BY l.created_at DESC LIMIT 500")) {
        if (!a.region(text(row.get("region_id")))) continue;
        String action = text(row.get("action"));
        if (action.startsWith("recitation.") || action.startsWith("familyPromise.")) continue;
        logs.add(
            m(
                "id",
                row.get("id"),
                "action",
                row.get("action"),
                "target",
                row.get("target_id"),
                "time",
                timestamp(row.get("created_at")),
                "actor",
                row.get("nick_name")));
      }
    out.put("activityLog", logs);
    out.put("serverNow", now());
    education.addAdmin(out, a);
    return JfAccess.trimWorkspace(a, out);
  }

  public Map<String, Object> adminWork(JfStore.Entity e) {
    var p = e.data();
    var d = store.dto(e);
    d.putAll(
        m(
            "status",
            JfSubmissions.statusLabel(e.status()),
            "source",
            p.getOrDefault("source", "线上投稿"),
            "version",
            p.get("revisionNumber"),
            "genre",
            genre(str(p, "genre")),
            "channel",
            channel(str(p, "channel")),
            "theme",
            String.join("、", list(p.get("themes")).stream().map(Jf::text).toList()),
            "files",
            list(p.get("attachments")),
            "attachments",
            list(p.get("attachments")).stream().map(f -> str(obj(f), "name")).toList(),
            "history",
            list(p.get("history")).stream()
                .map(
                    x -> {
                      var h = obj(x);
                      return m(
                          "time",
                          h.get("time"),
                          "title",
                          h.get("action"),
                          "detail",
                          h.getOrDefault("note", ""));
                    })
                .toList(),
            "result",
            p.get("decision")));
    var revs =
        store
            .db()
            .queryForList(
                "SELECT id,revision_number,payload FROM jf_revision WHERE submission_id=? ORDER BY"
                    + " revision_number",
                e.id());
    d.put(
        "revisions",
        revs.stream()
            .map(
                r ->
                    m(
                        "id",
                        r.get("id"),
                        "revisionNumber",
                        r.get("revision_number"),
                        "content",
                        str(parse(text(r.get("payload"))), "content")))
            .toList());
    return d;
  }

  private JfPublicCache.Snapshot publicBase() {
    Instant validUntil = catalog.nextBoundary();
    Map<String, Object> out = new LinkedHashMap<>();
    catalog.addPublic(out);
    out.put("scoringDimensions", DIMENSIONS);
    out.put(
        "reviewRuleVersion", store.find("setting", "reviewFlow", false).data().get("ruleVersion"));
    var works = store.select("submission", PUBLIC_WORK);
    out.put("works", works.stream().map(e -> submissions.work(e, null)).toList());
    Map<String, Object> order = new LinkedHashMap<>();
    works.forEach(e -> order.put(e.id(), Instant.parse(e.createdAt()).toEpochMilli()));
    out.put("_workOrder", order);
    out.put(
        "news",
        store.select("content", "status='已发布'").stream()
            .map(
                e -> {
                  var d = store.dto(e);
                  d.put("region", e.region());
                  return d;
                })
            .toList());
    List<Map<String, Object>> classics = new ArrayList<>();
    for (var e : store.select("collection", "status='已入藏'")) {
      List<Object> chapters = list(e.data().get("chapters"));
      String body =
          String.join(
              "\n\n",
              chapters.stream()
                  .map(x -> str(obj(x), "title") + "\n" + str(obj(x), "body"))
                  .toList());
      classics.add(
          m(
              "id",
              e.id(),
              "title",
              e.data().get("title"),
              "subtitle",
              e.data().get("subtitle"),
              "author",
              "平台编纂",
              "excerpt",
              body.substring(0, Math.min(body.length(), 100)),
              "content",
              body,
              "region",
              e.region(),
              "category",
              e.data().get("theme"),
              "coverColor",
              e.data().get("color"),
              "chapterCount",
              chapters.size(),
              "chapters",
              chapters,
              "isDemo",
              false));
    }
    out.put("classics", classics);
    List<Map<String, Object>> activities = new ArrayList<>();
    for (var e : store.select("activity", "status<>'草稿'")) {
      var p = e.data();
      activities.add(
          m(
              "id",
              e.id(),
              "title",
              p.get("title"),
              "excerpt",
              p.get("summary"),
              "content",
              p.get("summary"),
              "region",
              e.region(),
              "location",
              p.get("location"),
              "organizer",
              "家风中华行",
              "date",
              str(p, "startAt").substring(0, 10),
              "time",
              str(p, "startAt") + " — " + str(p, "endAt"),
              "category",
              p.get("type"),
              "capacity",
              p.get("capacity"),
              "status",
              e.status(),
              "version",
              e.version(),
              "isDemo",
              false));
    }
    out.put("activities", activities);
    out.put(
        "courses",
        education.publicCourses());
    out.put(
        "products",
        store.select("product", "status='已上架'").stream()
            .map(store::dto)
            .toList());
    out.put("platformConfig", copy(store.find("setting", "platformConfig", false).data()));
    return new JfPublicCache.Snapshot(out, validUntil);
  }

  private JfPublicCache.Snapshot publicStats() {
    var totals = store.db().queryForMap("SELECT COUNT(*) submissions,COUNT(DISTINCT owner_id) participants,"
        + "COUNT(DISTINCT CASE WHEN region_id<>'all' THEN region_id END) regions FROM jf_entity WHERE kind='submission'");
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("homeStats", m("submissions", number(totals.get("submissions")),
        "participants", number(totals.get("participants")), "regions", number(totals.get("regions")), "asOf", now()));
    Map<String, Object> media = new LinkedHashMap<>();
    for (var row : store.db().queryForList("SELECT interaction.kind,JSON_UNQUOTE(JSON_EXTRACT(interaction.payload,'$.contentId')) content_id,"
        + "COUNT(*) total FROM jf_entity interaction JOIN jf_entity media ON media.kind='media' AND media.status='已发布'"
        + " AND media.id=JSON_UNQUOTE(JSON_EXTRACT(interaction.payload,'$.contentId'))"
        + " WHERE interaction.kind IN ('mediaLike','mediaFavorite') GROUP BY interaction.kind,content_id")) {
      String id = str(row, "content_id");
      var counts = obj(media.computeIfAbsent(id, key -> m("likes", 0L, "favorites", 0L)));
      counts.put(str(row, "kind").equals("mediaLike") ? "likes" : "favorites", number(row.get("total")));
    }
    out.put("media", media);
    Map<String, Object> registrations = new LinkedHashMap<>();
    for (var row : store.db().queryForList("SELECT r.activity_id,COUNT(*) total FROM jf_registration r"
        + " JOIN sys_user u ON u.user_id=r.user_id JOIN jf_entity activity ON activity.id=r.activity_id"
        + " AND activity.kind='activity' AND activity.status<>'草稿' WHERE r.status='registered' GROUP BY r.activity_id"))
      registrations.put(str(row, "activity_id"), number(row.get("total")));
    out.put("registrations", registrations);
    return new JfPublicCache.Snapshot(out);
  }

  static final String PUBLIC_WORK = "status IN ('shortlisted','awarded','collected')"
      + " AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.published'))='true'";

  public Map<String, Object> member(JfAuth.Actor a) {
    Map<String, Object> out = cache.get("catalog", this::publicBase);
    Map<String, Object> stats = cache.get("stats", this::publicStats);
    out.put("homeStats", stats.get("homeStats"));
    for (Object item : list(out.get("mediaItems"))) {
      var media = obj(item);
      var counts = obj(obj(stats.get("media")).get(str(media, "id")));
      media.put("likes", number(counts.getOrDefault("likes", 0L)));
      media.put("favorites", number(counts.getOrDefault("favorites", 0L)));
    }
    for (Object item : list(out.get("activities"))) {
      var activity = obj(item);
      activity.put("registeredCount", number(obj(stats.get("registrations")).getOrDefault(str(activity, "id"), 0L)));
    }
    var order = obj(out.remove("_workOrder"));
    if (a != null) {
      var works = new LinkedHashMap<String, Object>();
      for (Object item : list(out.get("works"))) works.put(str(obj(item), "id"), item);
      // Operator-specific fields also remain an uncached, current-authority projection.
      var own = a.operator()
          ? store.select("submission", "(" + PUBLIC_WORK + ") OR owner_id=?", a.id)
          : store.select("submission", "owner_id=?", a.id);
      for (var e : own) {
        works.put(e.id(), submissions.work(e, a));
        order.put(e.id(), Instant.parse(e.createdAt()).toEpochMilli());
      }
      out.put("works", works.values().stream().sorted(Comparator
          .comparingLong((Object item) -> number(order.get(str(obj(item), "id")))).reversed()
          .thenComparing(item -> str(obj(item), "id"))).toList());
    }
    catalog.addMember(out, a);
    personalRecords.addMember(out, a);
    out.put("serverNow", now());
    for (String k :
        List.of(
            "registrations",
            "favorites",
            "notifications",
            "certificates",
            "reviewTasks",
            "commerceRequests",
            "excerpts",
            "aiArchives",
            "mediaFavorites",
            "mediaLikes")) out.put(k, new ArrayList<>());
    Map<String, Object> learning =
        m("courses", new LinkedHashMap<>(), "checkIns", new LinkedHashMap<>());
    out.put("learning", learning);
    if (a == null) return out;
    List<Map<String, Object>> regs = new ArrayList<>();
    for (var row :
        store
            .db()
            .queryForList(
                "SELECT * FROM jf_registration WHERE user_id=? AND status='registered'", a.id)) {
      regs.add(
          m(
              "activityId",
              row.get("activity_id"),
              "registeredAt",
              timestamp(row.get("created_at")),
              "isDemo",
              false));
      if (bool(row.get("checked_in")) || "1".equals(text(row.get("checked_in"))))
        obj(learning.get("checkIns"))
            .put(
                text(row.get("activity_id")),
                store.checkInTime(text(row.get("activity_id")), a.id));
    }
    out.put("registrations", regs);
    Map<String, String> extras =
        mapping(
            "favorites",
            "favorite",
            "notifications",
            "notification",
            "commerceRequests",
            "claim",
            "excerpts",
            "excerpt",
            "aiArchives",
            "archive",
            "mediaFavorites",
            "mediaFavorite",
            "mediaLikes",
            "mediaLike");
    for (var extra : extras.entrySet()) {
      List<Object> result = new ArrayList<>();
      for (var e : store.select(extra.getValue(), "owner_id=?", a.id)) {
        if (Set.of("favorite", "mediaFavorite", "mediaLike").contains(e.kind()))
          result.add(str(e.data(), "contentId"));
        else if (e.kind().equals("claim")) result.add(claim(e));
        else {
          var d = copy(e.data());
          d.putAll(
              m("id", e.id(), "createdAt", e.createdAt(), "isDemo", false, "version", e.version()));
          if (e.kind().equals("notification")) d.put("read", e.status().equals("read"));
          result.add(d);
        }
      }
      out.put(extra.getKey(), result);
    }
    for (var e : store.select("learning", "owner_id=?", a.id))
      obj(learning.get("courses")).put(str(e.data(), "courseId"), e.data());
    education.addMember(out, a);
    out.put(
        "reviewTasks",
        store.select("task", "owner_id=? AND status<>'已取消'", a.id).stream()
            .filter(
                e ->
                    a.roles.contains("expert")
                        && Objects.equals(a.id, e.owner())
                        && !e.status().equals("已取消"))
            .map(
                e -> {
                  var d = copy(e.data());
                  d.putAll(
                      m(
                          "id",
                          e.id(),
                          "version",
                          e.version(),
                          "status",
                          e.status().equals("待评分") ? "pending" : "submitted"));
                  d.remove("managerId");
                  d.putAll(reviewWindows.projection(e, a));
                  if (!a.operator()) d.remove("windowHistory");
                  return d;
                })
            .toList());
    return out;
  }

  public List<Map<String, Object>> registrations(String id) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (var r :
        store
            .db()
            .queryForList(
                "SELECT r.*,u.nick_name FROM jf_registration r JOIN sys_user u ON"
                    + " u.user_id=r.user_id WHERE r.activity_id=? AND r.status='registered' ORDER"
                    + " BY r.created_at",
                id))
      result.add(
          m(
              "id",
              r.get("id"),
              "name",
              r.get("nick_name"),
              "institution",
              "平台用户",
              "registeredAt",
              timestamp(r.get("created_at")),
              "checkedIn",
              bool(r.get("checked_in")) || "1".equals(text(r.get("checked_in")))));
    return result;
  }

  public Map<String, Object> claim(JfStore.Entity e) {
    var d = copy(e.data());
    d.putAll(
        m(
            "id",
            e.id(),
            "createdAt",
            e.createdAt(),
            "version",
            e.version(),
            "status",
            switch (e.status()) {
              case "待审核" -> "recorded";
              case "待发放" -> "approved";
              case "已退回" -> "returned";
              case "已发放" -> "issued";
              default -> "cancelled";
            }));
    return d;
  }

  private static List<Object> jsonList(Object value) {
    return list(org.dromara.common.json.utils.JsonUtils.parseObject(text(value), List.class));
  }

  private static Map<String, String> mapping(String... s) {
    Map<String, String> m = new LinkedHashMap<>();
    for (int i = 0; i < s.length; i += 2) m.put(s[i], s[i + 1]);
    return m;
  }

  private String genre(String s) {
    return switch (s) {
      case "letter" -> "家风家书";
      case "essay" -> "家风纪实散文";
      case "poetry" -> "家风诗词楹联";
      case "memoir" -> "红色家风回忆录";
      case "biography" -> "乡贤家族传记";
      case "family-rules" -> "家训手记";
      case "family-notes" -> "最美家庭手记";
      default -> "家风文论";
    };
  }

  private String channel(String s) {
    return switch (s) {
      case "public-service" -> "党政干部";
      case "school" -> "校园青少年";
      case "community" -> "城乡群众";
      default -> "特色群体";
    };
  }
}
