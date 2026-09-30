package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.net.URI;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;

/** Published catalog, private media submissions and member service records. */
@Service
public class JfCatalog {
  public static final Set<String> ADMIN_COMMANDS =
      Set.of(
          "saveBanner",
          "setBannerStatus",
          "saveMedia",
          "setMediaStatus",
          "saveVenue",
          "setVenueStatus",
          "saveHallPerson",
          "setHallPersonStatus",
          "saveHomepageConfig",
          "replySupportTicket");
  public static final Set<String> MEMBER_COMMANDS =
      Set.of("media.submit", "media.resubmit", "news.preferences", "support.create");
  public static final List<String> SECTIONS =
      List.of("entries", "topics", "news", "works", "venues", "stats");
  private static final Map<String, String> KINDS =
      Map.of(
          "banners",
          "banner",
          "mediaItems",
          "media",
          "venues",
          "venue",
          "hallPeople",
          "hallPerson");
  private final JfStore store;
  private final JfAuth auth;
  private final JfFiles files;

  public JfCatalog(JfStore store, JfAuth auth, JfFiles files) {
    this.store = store;
    this.auth = auth;
    this.files = files;
  }

  public static Map<String, Object> defaultHomepage() {
    List<Object> sections = new ArrayList<>();
    for (int i = 0; i < SECTIONS.size(); i++)
      sections.add(m("id", SECTIONS.get(i), "enabled", true, "order", i));
    return m("sections", sections);
  }

  private JfStore.Entity editable(JfAuth.Actor actor, String kind, String id, Object version) {
    var e = store.find(kind, id, true);
    auth.operate(actor, e.region());
    store.checkVersion(e, version);
    return e;
  }

  public Object adminCommand(
      JfAuth.Actor actor, String command, String id, Object version, Map<String, Object> input) {
    require(actor.operator(), 403, "FORBIDDEN", "当前账号没有运营权限");
    if (command.equals("saveHomepageConfig")) {
      require(actor.national(), 403, "FORBIDDEN", "仅全国管理员可设置首页布局");
      var old = store.find("setting", "homepageConfig", true);
      store.checkVersion(old, version);
      List<Object> sections = list(input.get("sections"));
      require(sections.size() == SECTIONS.size(), 422, "INVALID_SECTIONS", "首页布局须包含全部六个栏目");
      Set<String> seen = new HashSet<>();
      List<Object> clean = new ArrayList<>();
      for (Object item : sections) {
        var s = obj(item);
        String section = str(s, "id");
        require(
            SECTIONS.contains(section) && seen.add(section), 422, "INVALID_SECTIONS", "栏目重复或不存在");
        require(s.get("enabled") instanceof Boolean, 422, "VALIDATION_FAILED", "栏目开关无效");
        long order = number(s.get("order"));
        require(order >= 0 && order <= 9999, 422, "INVALID_ORDER", "排序须为0至9999");
        clean.add(m("id", section, "enabled", s.get("enabled"), "order", order));
      }
      return store.dto(store.save(old, "all", "active", m("sections", clean)));
    }
    if (command.equals("replySupportTicket")) {
      var old = editable(actor, "supportTicket", id, version);
      String status = str(input, "status");
      require(List.of("已回复", "已关闭").contains(status), 422, "INVALID_STATUS", "咨询处理状态无效");
      String reply = required(input, "reply", 1, 5000);
      var d = copy(old.data());
      List<Object> history = new ArrayList<>(list(d.get("replies")));
      history.add(m("reply", reply, "status", status, "createdAt", now()));
      d.putAll(m("reply", reply, "repliedAt", now(), "replies", history));
      var updated = store.save(old, old.region(), status, d);
      store.notifyUser(
          old.owner(),
          old.region(),
          "咨询已有回复",
          "您的咨询“" + str(d, "subject") + "”已有回复，请到人工咨询记录查看。",
          "");
      return ticket(updated, true);
    }
    String kind =
        command.contains("Banner")
            ? "banner"
            : command.contains("Media")
                ? "media"
                : command.contains("Venue") ? "venue" : "hallPerson";
    var old = id.isBlank() ? null : editable(actor, kind, id, version);
    if (command.startsWith("set")) {
      require(old != null, 404, "NOT_FOUND", "记录不存在");
      String status = str(input, "status");
      Set<String> states =
          kind.equals("media") ? Set.of("草稿", "已发布", "已下架", "已退回") : Set.of("草稿", "已发布", "已下架");
      require(states.contains(status), 422, "INVALID_STATUS", "发布状态无效");
      var d = copy(old.data());
      if (kind.equals("media") && status.equals("已退回"))
        d.put("reviewNote", required(input, "reviewNote", 1, 2000));
      else if (kind.equals("media") && status.equals("已发布")) d.put("reviewNote", "");
      if (status.equals("已发布")) validatePublication(kind, old.region(), d);
      return privateDto(store.save(old, old.region(), status, d));
    }
    String region =
        region(
            input.getOrDefault(
                "region",
                old == null ? actor.regions.stream().findFirst().orElse("all") : old.region()));
    auth.operate(actor, region);
    Map<String, Object> clean = clean(kind, input);
    if (kind.equals("media") && old != null)
      clean.put("revisions", list(old.data().get("revisions")));
    validateBindings(actor, kind, clean, old);
    var saved =
        old == null
            ? store.create(kind, actor.id, region, "草稿", clean)
            : store.save(old, region, "草稿", clean);
    return privateDto(saved);
  }

  public Object memberCommand(
      JfAuth.Actor actor, String command, String id, Object version, Map<String, Object> input) {
    if (command.equals("news.preferences")) {
      require(input.get("categories") instanceof List, 422, "INVALID_CATEGORY", "订阅分类须为数组");
      List<Object> requested = list(input.get("categories"));
      Set<String> categories = new LinkedHashSet<>();
      for (Object c : requested) {
        require(
            List.of("notice", "policy", "industry", "activity", "role-model").contains(text(c)),
            422,
            "INVALID_CATEGORY",
            "订阅分类无效");
        categories.add(text(c));
      }
      require(
          input.get("updates") instanceof Boolean && input.get("quietHours") instanceof Boolean,
          422,
          "VALIDATION_FAILED",
          "订阅开关无效");
      String digest = str(input, "digest");
      require(
          List.of("instant", "daily", "weekly").contains(digest), 422, "INVALID_DIGEST", "订阅频率无效");
      var data =
          m(
              "categories",
              categories,
              "updates",
              input.get("updates"),
              "digest",
              digest,
              "quietHours",
              input.get("quietHours"));
      String key = "newsPrefs_" + actor.id;
      store
          .db()
          .update(
              "INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload)"
                  + " VALUES(?,'profile',?,?,'active',?) ON DUPLICATE KEY UPDATE"
                  + " payload=VALUES(payload),version=version+1,updated_at=CURRENT_TIMESTAMP(3)",
              key,
              actor.id,
              actor.regions.stream().findFirst().orElse("all"),
              json(data));
      return data;
    }
    if (command.equals("support.create")) {
      String category = str(input, "category");
      require(
          List.of("submission", "review", "activity", "other").contains(category),
          422,
          "INVALID_CATEGORY",
          "咨询类型无效");
      var e =
          store.create(
              "supportTicket",
              actor.id,
              actor.regions.stream().findFirst().orElse("all"),
              "待处理",
              m(
                  "subject",
                  required(input, "subject", 2, 100),
                  "body",
                  required(input, "body", 5, 5000),
                  "category",
                  category,
                  "authorName",
                  actor.name,
                  "reply",
                  "",
                  "replies",
                  List.of()));
      return ticket(e, false);
    }
    require(actor.realm.equals("member"), 403, "FORBIDDEN", "请使用会员账号投稿媒体作品");
    JfStore.Entity old = null;
    if (command.equals("media.resubmit")) {
      old = store.find("media", id, true);
      require(Objects.equals(old.owner(), actor.id), 404, "NOT_FOUND", "媒体投稿不存在");
      store.checkVersion(old, version);
      require(old.status().equals("已退回"), 409, "INVALID_STATE", "只有已退回媒体可修改重投");
    }
    String region = region(input.get("region"));
    require(actor.region(region) && !region.equals("all"), 403, "FORBIDDEN", "只能向本人所属地区投稿");
    Map<String, Object> data = clean("media", input);
    data.put("reviewNote", "");
    validateBindings(actor, "media", data, old);
    require(!str(data, "sourceFileId").isEmpty(), 422, "FILE_REQUIRED", "请上传媒体源文件");
    validateMediaSource(data);
    List<Object> revisions =
        old == null ? new ArrayList<>() : new ArrayList<>(list(old.data().get("revisions")));
    if (old != null) {
      var prior = copy(old.data());
      prior.remove("revisions");
      revisions.add(m("submittedAt", old.updatedAt(), "content", prior));
    }
    data.put("revisions", revisions);
    return privateDto(
        old == null
            ? store.create("media", actor.id, region, "待审核", data)
            : store.save(old, region, "待审核", data));
  }

  private Map<String, Object> clean(String kind, Map<String, Object> input) {
    String language = str(input, "language");
    require(List.of("zh", "en").contains(language), 422, "INVALID_LANGUAGE", "请选择独立中文或英文版本");
    long order = number(input.getOrDefault("sortOrder", 0));
    require(order >= 0 && order <= 9999, 422, "INVALID_ORDER", "排序须为0至9999");
    var d =
        m(
            "title",
            required(input, "title", 2, 100),
            "language",
            language,
            "sortOrder",
            order,
            "sample",
            bool(input.get("sample")));
    switch (kind) {
      case "banner" -> {
        d.put(
            "category",
            choice(
                input,
                "category",
                "policy",
                "contribution",
                "celebration",
                "collection",
                "study",
                "integrity"));
        for (String key : List.of("subtitle", "description", "actionLabel", "footnote"))
          d.put(key, required(input, key, 0, key.equals("description") ? 3000 : 300));
        d.put(
            "targetScreen",
            choice(
                input,
                "targetScreen",
                "news",
                "submit",
                "library",
                "learning",
                "classroom",
                "media",
                "hall",
                "venues",
                "review"));
        for (String key : List.of("coverFileId", "targetId"))
          d.put(key, required(input, key, 0, 64));
        for (String key : List.of("startsAt", "endsAt")) {
          String value = required(input, key, 0, 60);
          d.put(key, value.isEmpty() ? "" : instant(value).toString());
        }
        if (!str(d, "startsAt").isEmpty() && !str(d, "endsAt").isEmpty())
          require(
              instant(str(d, "endsAt")).isAfter(instant(str(d, "startsAt"))),
              422,
              "INVALID_WINDOW",
              "结束时间须晚于开始时间");
      }
      case "media" -> {
        d.put(
            "category",
            choice(input, "category", "letter", "documentary", "lecture", "recitation"));
        d.put("type", choice(input, "type", "short", "replay", "audio"));
        for (String key :
            List.of(
                "collection",
                "excerpt",
                "duration",
                "sourceFileId",
                "posterFileId",
                "transcript")) {
          int max =
              key.equals("transcript")
                  ? 50000
                  : key.equals("excerpt") ? 2000 : key.endsWith("FileId") ? 64 : 100;
          d.put(key, required(input, key, 0, max));
        }
        d.put("reviewNote", "");
      }
      case "venue" -> {
        d.put("category", choice(input, "category", "hall", "practice", "integrity"));
        for (String key :
            List.of(
                "city",
                "address",
                "hours",
                "description",
                "highlights",
                "stops",
                "activityId",
                "contact",
                "visitorNotice"))
          d.put(key, required(input, key, 0, key.equals("activityId") ? 64 : 5000));
        boolean latitude = input.get("latitude") != null && !text(input.get("latitude")).isBlank();
        boolean longitude =
            input.get("longitude") != null && !text(input.get("longitude")).isBlank();
        require(latitude == longitude, 422, "INVALID_COORDINATES", "经纬度须成对填写");
        if (latitude) {
          d.put("latitude", coordinate(input.get("latitude"), 90));
          d.put("longitude", coordinate(input.get("longitude"), 180));
        }
      }
      case "hallPerson" -> {
        for (String key :
            List.of("era", "theme", "book", "quote", "introduction", "notes", "sourceTitle"))
          d.put(
              key,
              required(
                  input, key, 0, key.equals("introduction") || key.equals("notes") ? 20000 : 2000));
        for (String key : List.of("sourceUrl", "panoramaUrl")) {
          String url = required(input, key, 0, 2000);
          if (!url.isEmpty()) validateHttps(url);
          d.put(key, url);
        }
      }
      default -> throw error(422, "UNKNOWN_COMMAND", "目录类型无效");
    }
    return d;
  }

  private String choice(Map<String, Object> d, String key, String... allowed) {
    String value = str(d, key);
    require(Arrays.asList(allowed).contains(value), 422, "VALIDATION_FAILED", key + " 选项无效");
    return value;
  }

  private double coordinate(Object value, int max) {
    try {
      double n = Double.parseDouble(text(value));
      require(Double.isFinite(n) && Math.abs(n) <= max, 422, "INVALID_COORDINATES", "经纬度超出范围");
      return n;
    } catch (NumberFormatException e) {
      throw error(422, "INVALID_COORDINATES", "经纬度格式无效");
    }
  }

  private void validateHttps(String url) {
    try {
      URI uri = URI.create(url);
      require(
          "https".equalsIgnoreCase(uri.getScheme())
              && uri.getHost() != null
              && uri.getUserInfo() == null,
          422,
          "INVALID_URL",
          "链接须为有效HTTPS地址");
    } catch (IllegalArgumentException e) {
      throw error(422, "INVALID_URL", "链接格式无效");
    }
  }

  private Instant instant(String value) {
    try {
      return OffsetDateTime.parse(value).toInstant();
    } catch (Exception e) {
      throw error(422, "INVALID_DATE", "时间须包含时区");
    }
  }

  private void validateBindings(
      JfAuth.Actor actor, String kind, Map<String, Object> d, JfStore.Entity old) {
    for (String key : List.of("coverFileId", "sourceFileId", "posterFileId")) {
      String fileId = str(d, key);
      if (fileId.isEmpty()) continue;
      // Existing authorized references may be retained when an operator edits a
      // member submission. A new reference must always belong to this uploader.
      var file =
          old != null && fileId.equals(str(old.data(), key))
              ? files.info(fileId)
              : files.metadata(fileId, actor.id);
      if (!key.equals("sourceFileId"))
        require(
            text(file.get("type")).equals("image") || text(file.get("file_type")).equals("image"),
            422,
            "INVALID_FILE_TYPE",
            "封面须为PNG或JPEG图片");
    }
    if (kind.equals("media") && !str(d, "sourceFileId").isEmpty()) validateMediaSource(d);
  }

  private void validateMediaSource(Map<String, Object> d) {
    var file = files.info(required(d, "sourceFileId", 1, 64));
    String expected = str(d, "type").equals("audio") ? "audio" : "video";
    require(
        text(file.get("file_type")).equals(expected), 422, "INVALID_FILE_TYPE", "媒体文件格式与播放类型不符");
  }

  private void validatePublication(String kind, String region, Map<String, Object> d) {
    if (kind.equals("media")) validateMediaSource(d);
    if (kind.equals("banner"))
      require(targetVisible(region, d), 409, "TARGET_NOT_PUBLIC", "关联目标须已发布且属于本地区或全国范围");
    if (kind.equals("venue") && !str(d, "activityId").isEmpty())
      require(
          activityVisible(region, str(d, "activityId")),
          409,
          "TARGET_NOT_PUBLIC",
          "预约活动须已发布且属于本地区或全国范围");
  }

  private boolean compatible(String sourceRegion, String targetRegion) {
    return sourceRegion.equals("all")
        || targetRegion.equals("all")
        || sourceRegion.equals(targetRegion);
  }

  private boolean activityVisible(String region, String id) {
    return store.select("activity", "id=?", id).stream()
        .anyMatch(
            e ->
                e.id().equals(id)
                    && List.of("报名中", "进行中", "已结束").contains(e.status())
                    && compatible(region, e.region()));
  }

  private boolean targetVisible(String region, Map<String, Object> data) {
    String id = str(data, "targetId");
    if (id.isEmpty()) return true;
    String kind =
        switch (str(data, "targetScreen")) {
          case "news" -> "content";
          case "library" -> "collection";
          case "learning" -> "activity";
          case "classroom" -> "course";
          case "media" -> "media";
          case "hall" -> "hallPerson";
          case "venues" -> "venue";
          case "review" -> "submission";
          default -> "";
        };
    if (kind.isEmpty()) return false;
    return store.select(kind, "id=?", id).stream()
        .anyMatch(
            e ->
                e.id().equals(id)
                    && compatible(region, e.region())
                    && switch (kind) {
                      case "collection" -> e.status().equals("已入藏");
                      case "course" -> e.status().equals("已上架");
                      case "activity" -> List.of("报名中", "进行中", "已结束").contains(e.status());
                      case "submission" -> JfSubmissions.isPublic(e);
                      default -> e.status().equals("已发布");
                    });
  }

  public boolean visible(JfStore.Entity e) {
    if (!e.status().equals("已发布")) return false;
    if (!e.kind().equals("banner")) return true;
    String start = str(e.data(), "startsAt"), end = str(e.data(), "endsAt");
    Instant now = Instant.now();
    return (start.isEmpty() || !instant(start).isAfter(now))
        && (end.isEmpty() || instant(end).isAfter(now))
        && targetVisible(e.region(), e.data());
  }

  public boolean publicAssetAllowed(String id) {
    return store.all("banner").stream()
            .anyMatch(e -> visible(e) && id.equals(str(e.data(), "coverFileId")))
        || store.all("media").stream()
            .anyMatch(
                e ->
                    visible(e)
                        && (id.equals(str(e.data(), "sourceFileId"))
                            || id.equals(str(e.data(), "posterFileId"))));
  }

  private Map<String, Object> privateDto(JfStore.Entity e) {
    var d = store.dto(e);
    if (e.kind().equals("media"))
      d.put(
          "authorName",
          store
              .db()
              .queryForObject(
                  "SELECT nick_name FROM sys_user WHERE user_id=?", String.class, e.owner()));
    return d;
  }

  private Map<String, Object> publicDto(JfStore.Entity e) {
    var d =
        m(
            "id",
            e.id(),
            "status",
            e.status(),
            "regionId",
            e.region(),
            "region",
            e.region(),
            "createdAt",
            e.createdAt(),
            "updatedAt",
            e.updatedAt());
    List<String> fields = new ArrayList<>(List.of("title", "language", "sortOrder", "sample"));
    fields.addAll(
        switch (e.kind()) {
          case "banner" ->
              List.of(
                  "category",
                  "subtitle",
                  "description",
                  "actionLabel",
                  "footnote",
                  "coverFileId",
                  "targetScreen",
                  "targetId",
                  "startsAt",
                  "endsAt");
          case "media" ->
              List.of(
                  "category",
                  "type",
                  "collection",
                  "excerpt",
                  "duration",
                  "sourceFileId",
                  "posterFileId",
                  "transcript");
          case "venue" ->
              List.of(
                  "category",
                  "city",
                  "address",
                  "hours",
                  "description",
                  "highlights",
                  "stops",
                  "activityId",
                  "latitude",
                  "longitude",
                  "contact",
                  "visitorNotice");
          case "hallPerson" ->
              List.of(
                  "era",
                  "theme",
                  "book",
                  "quote",
                  "introduction",
                  "notes",
                  "sourceTitle",
                  "sourceUrl",
                  "panoramaUrl");
          default -> List.<String>of();
        });
    for (String key : fields) if (e.data().containsKey(key)) d.put(key, e.data().get(key));
    for (String key : List.of("sourceFileId", "posterFileId", "coverFileId")) {
      String file = str(d, key);
      if (!file.isEmpty())
        d.put(
            key.equals("sourceFileId") ? "source" : key.equals("posterFileId") ? "poster" : "cover",
            "/api/v1/files/" + file + "/public");
      d.remove(key);
    }
    for (String key : List.of("authorName", "ownerId", "reviewNote", "revisions")) d.remove(key);
    if (e.kind().equals("venue")
        && !str(d, "activityId").isEmpty()
        && !activityVisible(e.region(), str(d, "activityId"))) d.put("activityId", "");
    return d;
  }

  private Map<String, Object> ticket(JfStore.Entity e, boolean admin) {
    var d = store.dto(e);
    if (!admin) {
      d.remove("authorName");
      d.put("region", e.region());
    }
    return d;
  }

  private List<JfStore.Entity> sorted(String kind) {
    return store.all(kind).stream()
        .sorted(
            Comparator.comparingLong(
                    (JfStore.Entity e) -> number(e.data().getOrDefault("sortOrder", 0)))
                .thenComparing(JfStore.Entity::id))
        .toList();
  }

  public void addAdmin(Map<String, Object> out, JfAuth.Actor actor) {
    KINDS.forEach(
        (key, kind) ->
            out.put(
                key,
                sorted(kind).stream()
                    .filter(e -> actor.operator() && actor.region(e.region()))
                    .map(this::privateDto)
                    .toList()));
    out.put(
        "supportTickets",
        store.all("supportTicket").stream()
            .filter(e -> actor.operator() && actor.region(e.region()))
            .map(e -> ticket(e, true))
            .toList());
    out.put("homepageConfig", store.dto(store.find("setting", "homepageConfig", false)));
  }

  /** Only published, audience-independent fields enter the shared public catalog. */
  public void addPublic(Map<String, Object> out) {
    KINDS.forEach((key, kind) -> out.put(key,
        store.select(kind, "status='已发布'").stream()
            .sorted(Comparator.comparingLong((JfStore.Entity e) -> number(e.data().getOrDefault("sortOrder", 0)))
                .thenComparing(JfStore.Entity::id))
            .filter(this::visible).map(this::publicDto).toList()));
    out.put("homepageConfig", copy(store.find("setting", "homepageConfig", false).data()));
  }

  /** Includes future starts: an unpublished-yet scheduled banner must become visible on time. */
  public Instant nextBoundary() {
    Instant now = Instant.now(), next = Instant.MAX;
    for (var banner : store.select("banner", "status='已发布'"))
      for (String field : List.of("startsAt", "endsAt")) {
        String raw = str(banner.data(), field);
        if (raw.isEmpty()) continue;
        Instant boundary = instant(raw);
        if (boundary.isAfter(now) && boundary.isBefore(next)) next = boundary;
      }
    return next;
  }

  /** Private overlays are rebuilt for the current account and never returned to a cache builder. */
  public void addMember(Map<String, Object> out, JfAuth.Actor actor) {
    out.put(
        "mediaSubmissions",
        actor == null
            ? List.of()
            : store.select("media", "owner_id=?", actor.id).stream()
                .map(this::privateDto)
                .toList());
    out.put(
        "supportTickets",
        actor == null
            ? List.of()
            : store.select("supportTicket", "owner_id=?", actor.id).stream()
                .map(e -> ticket(e, false))
                .toList());
    var prefs =
        m("categories", List.of(), "updates", false, "digest", "instant", "quietHours", true);
    if (actor != null)
      store.select("profile", "id=? AND owner_id=?", "newsPrefs_" + actor.id, actor.id).stream()
          .findFirst()
          .ifPresent(e -> prefs.putAll(e.data()));
    out.put("newsPreferences", prefs);
  }

  public void notifyContentPublished(JfStore.Entity content) {
    String category =
        switch (str(content.data(), "category")) {
          case "政策", "政策解读" -> "policy";
          case "行业动态" -> "industry";
          case "资讯", "活动报道" -> "activity";
          case "专题", "榜样人物" -> "role-model";
          default -> "notice";
        };
    for (var prefs : store.all("profile")) {
      if (!prefs.id().startsWith("newsPrefs_")
          || prefs.owner() == null
          || !bool(prefs.data().get("updates"))
          || !str(prefs.data(), "digest").equals("instant")
          || !list(prefs.data().get("categories")).contains(category)) continue;
      if (!content.region().equals("all") && !content.region().equals(prefs.region())) continue;
      var enabled =
          store
              .db()
              .queryForList(
                  "SELECT user_id FROM jf_account WHERE user_id=? AND enabled=1 AND realm='member'",
                  prefs.owner());
      if (enabled.isEmpty()) continue;
      String id =
          "newsNotice_"
              + hash(content.id() + ":" + content.version() + ":" + prefs.owner()).substring(0, 40);
      store
          .db()
          .update(
              "INSERT IGNORE INTO jf_entity(id,kind,owner_id,region_id,status,payload)"
                  + " VALUES(?,'notification',?,?,'unread',?)",
              id,
              prefs.owner(),
              prefs.region(),
              json(
                  m(
                      "title",
                      "订阅资讯更新",
                      "content",
                      str(content.data(), "title"),
                      "sourceType",
                      "news",
                      "targetId",
                      content.id(),
                      "workId",
                      "",
                      "read",
                      false)));
    }
  }

  public void authorizeAdminResult(JfAuth.Actor actor, String command, Object result) {
    if (command.equals("saveHomepageConfig")) return;
    String id = str(obj(result), "id");
    if (id.isEmpty()) return;
    String kind =
        command.contains("Banner")
            ? "banner"
            : command.contains("Media")
                ? "media"
                : command.contains("Venue")
                    ? "venue"
                    : command.contains("HallPerson") ? "hallPerson" : "supportTicket";
    auth.operate(actor, store.find(kind, id, false).region());
  }
}
