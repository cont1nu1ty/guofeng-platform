package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Versioned reading and single-choice assessment. Confirmation is not verified study time or a signature. */
@Service
public class JfEducation {
  public static final Set<String> ADMIN_COMMANDS = Set.of("saveCourse", "toggleCourse", "publishCourse", "unpublishCourse",
      "education.saveGroup", "education.reviewIdentity");
  private final JfStore store;
  private final JfAuth auth;

  public JfEducation(JfStore store, JfAuth auth) { this.store = store; this.auth = auth; }

  private void permission(JfAuth.Actor a, String operation) {
    require(JfAccess.can(a, "education:" + operation),
        403, "FORBIDDEN", "当前岗位没有教育" + (operation.equals("read") ? "查看" : "管理") + "权限");
  }

  private JfStore.Entity managed(JfAuth.Actor a, String id, Object version) {
    permission(a, "write");
    var e = store.find("course", id, true);
    require(a.region(e.region()), 404, "NOT_FOUND", "课程不存在或不可管理");
    store.checkVersion(e, version);
    return e;
  }

  static Map<String, Object> draft(JfStore.Entity e) {
    return obj(e.data().get("draft")).isEmpty() ? copy(e.data()) : copy(obj(e.data().get("draft")));
  }

  public Map<String, Object> adminCourse(JfStore.Entity e) {
    var d = JfEducationContent.normalize(draft(e), m());
    d.putAll(m("id", e.id(), "region", e.region(), "regionId", e.region(), "status", e.status(), "lockVersion", e.version(),
        "publishedVersion", number(e.data().getOrDefault("publishedVersion", 0)),
        "versions", store.db().queryForList("SELECT publication_version version,published_at publishedAt,legacy FROM jf_course_publication WHERE course_id=? ORDER BY publication_version DESC", e.id())));
    return d;
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object adminCommand(JfAuth.Actor a, String command, String id, Object version, Map<String, Object> input) {
    permission(a, "write");
    if (command.equals("education.saveGroup")) return saveGroup(a, id, version, input);
    if (command.equals("education.reviewIdentity")) return reviewIdentity(a, id, version, input);
    if (command.equals("saveCourse")) {
      var old = id.isEmpty() ? null : managed(a, id, version);
      String region = region(input.getOrDefault("region", old == null ? a.regions.stream().findFirst().orElse("all") : old.region()));
      require(a.region(region), 403, "FORBIDDEN", "不能保存到未授权地区");
      if (old != null && number(old.data().getOrDefault("publishedVersion", 0)) > 0)
        require(region.equals(old.region()), 409, "PUBLISHED_REGION_LOCKED", "已发布课程的归属地区不能修改");
      var normalized = JfEducationContent.normalize(input, old == null ? m() : draft(old));
      var data = old == null ? copy(normalized) : copy(old.data());
      data.put("draft", normalized);
      data.putIfAbsent("publishedVersion", 0L);
      var saved = old == null ? store.create("course", a.id, region, "草稿", data) : store.save(old, region, old.status(), data);
      return m("ok", true, "id", saved.id(), "lockVersion", saved.version());
    }
    var e = managed(a, id, version);
    boolean publish = command.equals("publishCourse") || (command.equals("toggleCourse")
        && (str(input, "status").equals("已上架") || str(input, "status").isEmpty() && !e.status().equals("已上架")));
    require(Set.of("publishCourse", "toggleCourse", "unpublishCourse").contains(command), 422, "UNKNOWN_COMMAND", "教育操作不存在");
    if (!str(input, "status").isEmpty()) require(Set.of("已上架", "已下架").contains(str(input, "status")), 422, "INVALID_STATUS", "课程状态无效");
    if (!publish) {
      var saved = store.save(e, e.region(), "已下架", e.data());
      return m("ok", true, "id", id, "lockVersion", saved.version());
    }
    var content = JfEducationContent.normalize(draft(e), m());
    Long latest = store.db().queryForObject("SELECT COALESCE(MAX(publication_version),0) FROM jf_course_publication WHERE course_id=?", Long.class, id);
    long next = (latest == null ? 0 : latest) + 1;
    store.db().update("INSERT INTO jf_course_publication(course_id,publication_version,payload,published_by) VALUES(?,?,?,?)", id, next, json(content), a.id);
    var data = copy(content);
    data.put("draft", copy(content));
    data.put("publishedVersion", next);
    var saved = store.save(e, e.region(), "已上架", data);
    return m("ok", true, "id", id, "publishedVersion", next, "lockVersion", saved.version());
  }

  private Map<String, Object> snapshot(String id, long version) {
    // Post-startup legacy imports remain readable, but have no frozen completion evidence.
    if (version == 0) return JfEducationContent.normalize(store.find("course", id, false).data(), m());
    var rows = store.db().queryForList("SELECT payload FROM jf_course_publication WHERE course_id=? AND publication_version=?", id, version);
    require(!rows.isEmpty(), 404, "NOT_FOUND", "课程发布版本不存在");
    return JfEducationContent.normalize(parse(text(rows.getFirst().get("payload"))), m());
  }

  public List<Object> publicCourses() {
    var result = new ArrayList<Object>();
    for (var e : store.select("course", "status='已上架'")) {
      long version = number(e.data().getOrDefault("publishedVersion", 0));
      var d = JfEducationContent.learner(snapshot(e.id(), version));
      d.putAll(m("id", e.id(), "region", e.region(), "regionId", e.region(), "status", "已上架", "publicationVersion", version, "publishedVersion", version, "lockVersion", e.version()));
      result.add(d);
    }
    return result;
  }

  private JfStore.Entity accessible(JfAuth.Actor a, String id, long version, boolean write) {
    var e = store.find("course", id, write);
    require(e.status().equals("已上架"), 404, "NOT_FOUND", "课程已下架或不存在");
    long current = number(e.data().getOrDefault("publishedVersion", 0));
    if (version != current) {
      require(a != null, 404, "NOT_FOUND", "课程版本不可见");
      Long own = store.db().queryForObject("SELECT COUNT(*) FROM jf_course_learning WHERE user_id=? AND course_id=? AND publication_version=?", Long.class, a.id, id, version);
      Long group = store.db().queryForObject("SELECT COUNT(*) FROM jf_education_group g JOIN jf_education_member m ON m.group_id=g.id WHERE m.user_id=? AND g.course_id=? AND g.publication_version=?", Long.class, a.id, id, version);
      require((own != null && own > 0) || (group != null && group > 0), 404, "NOT_FOUND", "课程版本不可见");
    }
    return e;
  }

  public Map<String, Object> detail(JfAuth.Actor a, String id, Long requested) {
    var entity = store.find("course", id, false);
    long version = requested == null ? number(entity.data().getOrDefault("publishedVersion", 0)) : requested;
    accessible(a, id, version, false);
    var snapshot = snapshot(id, version);
    var course = JfEducationContent.learner(snapshot);
    course.putAll(m("id", id, "region", entity.region(), "publicationVersion", version));
    return m("course", course, "progress", progressDto(a == null ? null : learning(a.id, id, version, false), snapshot));
  }

  private Map<String, Object> learning(long user, String id, long version, boolean lock) {
    var rows = store.db().queryForList("SELECT * FROM jf_course_learning WHERE user_id=? AND course_id=? AND publication_version=?" + (lock ? " FOR UPDATE" : ""), user, id, version);
    return rows.isEmpty() ? m() : rows.getFirst();
  }

  static Map<String, Object> progressDto(Map<String, Object> row, Map<String, Object> course) {
    if (row == null) row = m();
    List<Object> lessons = row.get("lessons") instanceof String ? list(org.dromara.common.json.utils.JsonUtils.parseObject(text(row.get("lessons")), List.class)) : list(row.get("lessons"));
    boolean quiz = !list(course.get("examQuestionIds")).isEmpty();
    boolean passed = bool(row.get("quiz_passed"));
    int total = list(course.get("lessons")).size() + (quiz ? 1 : 0);
    return m("lessons", lessons, "quizPassed", passed, "bestScore", row.get("best_score"), "complete", row.get("completed_at") != null,
        "completedAt", row.get("completed_at") == null ? null : timestamp(row.get("completed_at")),
        "percent", total == 0 ? 0 : Math.min(100, (lessons.size() + (quiz && passed ? 1 : 0)) * 100 / total));
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object progress(JfAuth.Actor a, String id, Map<String, Object> input) {
    // Serializes enrollment as well as updates, including legacy /commands callers.
    store.db().queryForObject("SELECT user_id FROM jf_account WHERE user_id=? FOR UPDATE", Long.class, a.id);
    var e = store.find("course", id, true);
    long version = number(input.getOrDefault("publicationVersion", e.data().getOrDefault("publishedVersion", 0)));
    accessible(a, id, version, true);
    require(version > 0, 409, "COURSE_NOT_VERSIONED", "此课程为旧版导入，请等待运营发布版本后记录学习");
    var course = snapshot(id, version);
    var before = learning(a.id, id, version, true);
    var state = progressDto(before, course);
    var lessons = new LinkedHashSet<String>();
    list(state.get("lessons")).forEach(x -> lessons.add(text(x)));
    String lesson = str(input, "lessonId");
    require(!lesson.isEmpty() || input.containsKey("answers") || input.containsKey("answer"), 422, "INVALID_PROGRESS", "请确认章节或提交答案");
    if (!lesson.isEmpty()) {
      require(list(course.get("lessons")).stream().anyMatch(x -> str(obj(x), "id").equals(lesson)), 422, "INVALID_LESSON", "该发布版本没有此章节");
      lessons.add(lesson);
    }
    Map<String, Object> graded = m();
    boolean passed = bool(state.get("quizPassed"));
    Object best = state.get("bestScore");
    if (input.containsKey("answers") || input.containsKey("answer")) {
      require(lessons.size() == list(course.get("lessons")).size(), 409, "LESSONS_REQUIRED", "请先确认已阅读全部章节");
      var answers = copy(obj(input.get("answers")));
      if (input.containsKey("answer")) {
        var exam = list(course.get("examQuestionIds"));
        require(exam.size() == 1, 409, "EXAM_CLIENT_UPDATE_REQUIRED", "请使用完整测验界面提交答案");
        var q = list(course.get("questions")).stream().map(Jf::obj).filter(x -> str(x, "id").equals(text(exam.getFirst()))).findFirst().orElseThrow();
        int choice = (int) number(input.get("answer"));
        require(choice >= 0 && choice < list(q.get("options")).size(), 422, "INVALID_ANSWER", "答案选项无效");
        answers.put(text(exam.getFirst()), str(obj(list(q.get("options")).get(choice)), "id"));
      }
      graded = JfEducationContent.grade(course, answers);
      passed |= bool(graded.get("passed"));
      best = best == null ? graded.get("score") : Math.max(number(best), number(graded.get("score")));
      store.db().update("INSERT INTO jf_course_attempt(id,user_id,course_id,publication_version,answers,score,passed) VALUES(?,?,?,?,?,?,?)",
          Jf.id("attempt_"), a.id, id, version, json(answers), graded.get("score"), graded.get("passed"));
    }
    boolean complete = lessons.size() == list(course.get("lessons")).size() && (list(course.get("examQuestionIds")).isEmpty() || passed);
    store.db().update("INSERT INTO jf_course_learning(user_id,course_id,publication_version,lessons,quiz_passed,best_score,completed_at)"
        + " VALUES(?,?,?,?,?,?,IF(?,CURRENT_TIMESTAMP(3),NULL)) ON DUPLICATE KEY UPDATE lessons=VALUES(lessons),quiz_passed=VALUES(quiz_passed),"
        + "best_score=VALUES(best_score),completed_at=COALESCE(completed_at,VALUES(completed_at)),updated_at=CURRENT_TIMESTAMP(3)",
        a.id, id, version, json(lessons), passed, best, complete);
    return m("ok", true, "progress", progressDto(learning(a.id, id, version, false), course), "result", graded, "publicationVersion", version);
  }

  public void addMember(Map<String, Object> out, JfAuth.Actor a) {
    var progress = new LinkedHashMap<String, Object>();
    if (a != null) for (var e : store.select("course", "status='已上架'")) {
      long v = number(e.data().getOrDefault("publishedVersion", 0));
      if (v < 1) continue;
      var record = learning(a.id, e.id(), v, false);
      if (!record.isEmpty()) progress.put(e.id(), progressDto(record, snapshot(e.id(), v)));
    }
    var existing = copy(obj(out.get("learning")));
    existing.put("courses", progress);
    existing.putIfAbsent("checkIns", m());
    out.put("learning", existing);
  }

  public Map<String, Object> admin(JfAuth.Actor a) { return admin(a, 1, 1, 1, ""); }

  private record Scope(String sql, List<Object> args) {}
  private Scope scope(JfAuth.Actor a, String column) {
    if (a.national()) return new Scope("1=1", List.of());
    var args = new ArrayList<Object>(a.regions);
    return new Scope(args.isEmpty() ? "1=0" : column + " IN (" + String.join(",", Collections.nCopies(args.size(), "?")) + ")", args);
  }
  private List<Map<String,Object>> page(String sql, List<Object> args, int page) {
    require(page >= 1 && page <= 100000, 422, "INVALID_PAGE", "页码无效");
    var values = new ArrayList<Object>(args); values.add(20); values.add((page - 1) * 20);
    return store.db().queryForList(sql + " LIMIT ? OFFSET ?", values.toArray());
  }
  private Long count(String sql, List<Object> args) { return store.db().queryForObject(sql, Long.class, args.toArray()); }
  public Map<String,Object> admin(JfAuth.Actor a, int coursesPage, int groupsPage, int identitiesPage, String query) {
    permission(a, "read");
    require(query.length() <= 100, 422, "INVALID_QUERY", "搜索内容过长");
    var scope = scope(a, "region_id");
    var courseArgs = new ArrayList<Object>(scope.args()); courseArgs.add("%" + query + "%");
    String courseWhere = "kind='course' AND " + scope.sql() + " AND CONCAT(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.draft.title')),JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')),''),' ',COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.teacher')),'')) LIKE ?";
    var courses = page("SELECT id FROM jf_entity WHERE " + courseWhere + " ORDER BY created_at DESC,id", courseArgs, coursesPage)
        .stream().map(row -> adminCourse(store.find("course", str(row,"id"), false))).toList();
    var groups = page("SELECT * FROM jf_education_group WHERE " + scope.sql() + " ORDER BY created_at DESC,id", scope.args(), groupsPage)
        .stream().map(row -> groupDto(row, true, a.id)).toList();
    var identityScope = scope(a, "i.region_id");
    var identities = page("SELECT i.*,u.nick_name FROM jf_education_identity i JOIN sys_user u ON u.user_id=i.user_id WHERE " + identityScope.sql() + " ORDER BY i.updated_at DESC,i.user_id", identityScope.args(), identitiesPage)
        .stream().map(this::identityDto).toList();
    return m("courses", courses, "learningGroups", groups, "identities", identities, "members", memberCandidates(a, ""),
        "pageSize",20,"courseTotal",count("SELECT COUNT(*) FROM jf_entity WHERE " + courseWhere, courseArgs),
        "groupTotal",count("SELECT COUNT(*) FROM jf_education_group WHERE " + scope.sql(),scope.args()),
        "identityTotal",count("SELECT COUNT(*) FROM jf_education_identity i WHERE " + identityScope.sql(),identityScope.args()));
  }
  public void addAdmin(Map<String,Object> out,JfAuth.Actor a) {
    if(!JfAccess.can(a,"education:read")) { out.put("courses",List.of());out.put("learningGroups",List.of());return; }
    out.putAll(admin(a));
  }
  public List<Object> memberCandidates(JfAuth.Actor a,String query) {
    permission(a,"read"); require(query.length()<=100,422,"INVALID_QUERY","搜索内容过长");
    var args=new ArrayList<Object>(); String region="1=1";
    if(!a.national()) {
      region=a.regions.isEmpty()?"1=0":"("+String.join(" OR ",Collections.nCopies(a.regions.size(),"JSON_CONTAINS(a.region_ids,JSON_QUOTE(?))"))+")";
      args.addAll(a.regions);
    }
    args.add("%"+query+"%");args.add(query);
    return store.db().queryForList("SELECT a.user_id,a.region_ids,u.nick_name FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id WHERE a.enabled=1 AND a.realm='member' AND u.status='0' AND u.del_flag='0' AND " + region
        + " AND (u.nick_name LIKE ? OR CAST(a.user_id AS CHAR)=?) ORDER BY a.user_id LIMIT 50",args.toArray()).stream()
        .map(r -> (Object)m("id",text(r.get("user_id")),"name",r.get("nick_name"),"regions",jsonRegions(r.get("region_ids")))).toList();
  }

  private List<String> jsonRegions(Object value) {
    return list(value instanceof String ? org.dromara.common.json.utils.JsonUtils.parseObject(text(value), List.class) : value).stream().map(Jf::text).toList();
  }

  private Map<String, Object> identityDto(Map<String, Object> row) {
    return m("userId", text(row.get("user_id")), "name", row.get("nick_name"), "organization", row.get("organization"),
        "requestNote", row.get("request_note"), "region", row.get("region_id"), "status", row.get("status"), "reason", row.get("review_reason"), "version", row.get("version"));
  }

  public Map<String, Object> mine(JfAuth.Actor a) {
    var groups = store.db().queryForList("SELECT g.* FROM jf_education_group g JOIN jf_education_member m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at DESC", a.id);
    var identity = store.db().queryForList("SELECT * FROM jf_education_identity WHERE user_id=?", a.id);
    var history = store.db().queryForList("SELECT course_id courseId,publication_version publicationVersion,completed_at completedAt,best_score bestScore FROM jf_course_learning WHERE user_id=? ORDER BY updated_at DESC", a.id);
    var legacy = store.select("learning", "owner_id=?", a.id).stream().map(e -> m("courseId", e.data().get("courseId"), "status", e.status(), "recordedAt", e.updatedAt(), "versionUnverified", true)).toList();
    return m("groups", groups.stream().map(g -> groupDto(g, false, a.id)).toList(), "identity", identity.isEmpty() ? null : identityDto(identity.getFirst()),
        "history", history, "legacyRecords", legacy,
        "declarations", store.db().queryForList("SELECT id,group_id groupId,group_version groupVersion,text_snapshot text,text_sha256 textHash,confirmed_at confirmedAt FROM jf_education_declaration WHERE user_id=? ORDER BY confirmed_at DESC", a.id));
  }

  private Map<String, Object> groupDto(Map<String, Object> row, boolean admin, long user) {
    String id = str(row, "id"), course = str(row, "course_id");
    long version = number(row.get("publication_version"));
    var members = store.db().queryForList("SELECT m.user_id,u.nick_name,l.completed_at,l.best_score,i.status identity_status FROM jf_education_member m JOIN sys_user u ON u.user_id=m.user_id"
        + " LEFT JOIN jf_course_learning l ON l.user_id=m.user_id AND l.course_id=? AND l.publication_version=? LEFT JOIN jf_education_identity i ON i.user_id=m.user_id WHERE m.group_id=? ORDER BY m.user_id", course, version, id);
    Long declarations = store.db().queryForObject("SELECT COUNT(*) FROM jf_education_declaration WHERE group_id=? AND group_version=?", Long.class, id, row.get("version"));
    Long own = store.db().queryForObject("SELECT COUNT(*) FROM jf_education_declaration WHERE group_id=? AND group_version=? AND user_id=?", Long.class, id, row.get("version"), user);
    var result = m("id", id, "name", row.get("name"), "region", row.get("region_id"), "courseId", course, "publicationVersion", version,
        "cadreOnly", bool(row.get("cadre_only")), "declarationText", row.get("declaration_text"), "declarationHash", hash(str(row, "declaration_text")), "version", row.get("version"),
        "members", members.size(), "completed", members.stream().filter(m -> m.get("completed_at") != null).count(), "declarations", declarations, "confirmed", own != null && own > 0);
    if (admin) {
      var history = store.db().queryForList("SELECT d.id,d.user_id userId,u.nick_name name,d.group_version groupVersion,d.text_snapshot text,d.text_sha256 textHash,d.confirmed_at confirmedAt"
          + " FROM jf_education_declaration d JOIN sys_user u ON u.user_id=d.user_id WHERE d.group_id=? ORDER BY d.confirmed_at DESC", id);
      result.put("declarationHistory", history);
      result.put("memberRecords", members.stream().map(m -> m("id", text(m.get("user_id")), "name", m.get("nick_name"),
          "completedAt", m.get("completed_at"), "bestScore", m.get("best_score"), "identityStatus", m.get("identity_status"))).toList());
    }
    return result;
  }

  private Object saveGroup(JfAuth.Actor a, String id, Object version, Map<String, Object> input) {
    var old = id.isEmpty() ? null : group(id, true);
    if (old != null) { require(a.region(str(old, "region_id")), 404, "NOT_FOUND", "班组不存在"); expected(old, version); }
    String r = region(input.getOrDefault("region", old == null ? a.regions.stream().findFirst().orElse("all") : old.get("region_id")));
    require(a.region(r), 403, "FORBIDDEN", "班组地区不在授权范围内");
    String courseId = required(input, "courseId", 1, 64);
    long publication = number(input.get("publicationVersion"));
    var course = store.find("course", courseId, false);
    require((course.region().equals("all") || a.region(course.region())) && (course.region().equals("all") || course.region().equals(r)), 403, "FORBIDDEN", "课程与班组地区不匹配");
    snapshot(courseId, publication);
    if (old != null) require(courseId.equals(str(old, "course_id")) && publication == number(old.get("publication_version"))
        && r.equals(str(old, "region_id")), 409, "ASSIGNMENT_VERSION_LOCKED", "已有班组的课程版本和地区固定；请为新版本新建班组");
    String name = required(input, "name", 2, 150), declaration = required(input, "declarationText", 0, 10000);
    boolean cadre = bool(input.get("cadreOnly"));
    var users = new LinkedHashSet<Long>();
    require(list(input.get("memberIds")).size() <= 500, 422, "GROUP_TOO_LARGE", "一个班组最多500人");
    for (var value : list(input.get("memberIds"))) {
      long uid = number(value);
      var member = auth.adminTarget(uid);
      require(member.realm.equals("member") && (r.equals("all") || member.regions.contains(r)), 422, "INVALID_MEMBER", "成员不属于班组地区");
      Long active = store.db().queryForObject("SELECT COUNT(*) FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id WHERE a.user_id=? AND a.enabled=1 AND u.status='0' AND u.del_flag='0'", Long.class, uid);
      require(active != null && active > 0, 422, "INVALID_MEMBER", "不能向停用账号分配学习");
      if (cadre) requireApproved(uid);
      require(users.add(uid), 422, "DUPLICATE_MEMBER", "班组成员重复");
    }
    if (old == null) {
      id = Jf.id("group_");
      store.db().update("INSERT INTO jf_education_group(id,name,region_id,course_id,publication_version,cadre_only,declaration_text,created_by) VALUES(?,?,?,?,?,?,?,?)",
          id, name, r, courseId, publication, cadre, declaration, a.id);
    } else store.db().update("UPDATE jf_education_group SET name=?,cadre_only=?,declaration_text=?,version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?", name, cadre, declaration, id);
    store.db().update("DELETE FROM jf_education_member WHERE group_id=?", id);
    for (long uid : users) store.db().update("INSERT INTO jf_education_member(group_id,user_id) VALUES(?,?)", id, uid);
    return m("ok", true, "id", id);
  }

  private Map<String, Object> group(String id, boolean lock) {
    var rows = store.db().queryForList("SELECT * FROM jf_education_group WHERE id=?" + (lock ? " FOR UPDATE" : ""), id);
    require(!rows.isEmpty(), 404, "NOT_FOUND", "班组不存在"); return rows.getFirst();
  }
  private void expected(Map<String, Object> row, Object version) {
    require(version != null, 428, "VERSION_REQUIRED", "请刷新后重试");
    require(number(version) == number(row.get("version")), 412, "VERSION_CONFLICT", "记录已更新，请刷新后重试");
  }
  private void requireApproved(long user) {
    Long count = store.db().queryForObject("SELECT COUNT(*) FROM jf_education_identity WHERE user_id=? AND status='approved'", Long.class, user);
    require(count != null && count > 0, 409, "IDENTITY_NOT_APPROVED", "干部身份须先经管理员人工审核");
  }
  private Object reviewIdentity(JfAuth.Actor a, String id, Object version, Map<String, Object> input) {
    long user = number(id);
    var rows = store.db().queryForList("SELECT * FROM jf_education_identity WHERE user_id=? FOR UPDATE", user);
    require(!rows.isEmpty() && a.region(str(rows.getFirst(), "region_id")), 404, "NOT_FOUND", "身份申请不存在");
    require(user != a.id, 403, "SELF_APPROVAL", "不能审核自己的干部身份");
    expected(rows.getFirst(), version);
    String status = str(input, "status"), reason = required(input, "reason", 2, 2000);
    require(Set.of("approved", "rejected").contains(status), 422, "INVALID_STATUS", "请选择通过或退回");
    store.db().update("UPDATE jf_education_identity SET status=?,review_reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP(3),version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE user_id=?", status, reason, a.id, user);
    return m("ok", true);
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public void authorizeMemberCommand(JfAuth.Actor a, String command, String id, Map<String, Object> input) {
    if (command.equals("course.progress")) {
      var course = store.find("course", id, false);
      accessible(a, id, number(input.getOrDefault("publicationVersion", course.data().getOrDefault("publishedVersion", 0))), false);
    } else if (command.equals("education.confirmDeclaration")) {
      var row = group(id, false);
      Long own = store.db().queryForObject("SELECT COUNT(*) FROM jf_education_member WHERE group_id=? AND user_id=?", Long.class, id, a.id);
      require(own != null && own > 0, 404, "NOT_FOUND", "班组不存在或当前账号未分配");
      if (bool(row.get("cadre_only"))) requireApproved(a.id);
    } else require(command.equals("education.requestIdentity"), 422, "UNKNOWN_COMMAND", "教育操作不存在");
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object memberCommand(JfAuth.Actor a, String command, String id, Object version, Map<String, Object> input) {
    if (command.equals("course.progress")) return progress(a, id, input);
    if (command.equals("education.requestIdentity")) {
      var rows = store.db().queryForList("SELECT * FROM jf_education_identity WHERE user_id=? FOR UPDATE", a.id);
      if (!rows.isEmpty()) expected(rows.getFirst(), version);
      String org = required(input, "organization", 2, 200), note = required(input, "requestNote", 5, 3000);
      String region = a.regions.stream().filter(r -> !r.equals("all")).findFirst().orElse("all");
      store.db().update("INSERT INTO jf_education_identity(user_id,region_id,organization,request_note) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE organization=VALUES(organization),request_note=VALUES(request_note),status='pending',review_reason=NULL,reviewed_by=NULL,reviewed_at=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP(3)", a.id, region, org, note);
      return m("ok", true);
    }
    require(command.equals("education.confirmDeclaration"), 422, "UNKNOWN_COMMAND", "教育操作不存在");
    var group = group(id, true);
    expected(group, version);
    Long membership = store.db().queryForObject("SELECT COUNT(*) FROM jf_education_member WHERE group_id=? AND user_id=?", Long.class, id, a.id);
    require(membership != null && membership > 0, 404, "NOT_FOUND", "班组不存在或不属于本人");
    if (bool(group.get("cadre_only"))) requireApproved(a.id);
    String declaration = str(group, "declaration_text");
    require(!declaration.isBlank() && Boolean.TRUE.equals(input.get("accepted")) && hash(declaration).equals(str(input, "textHash")),
        422, "DECLARATION_CONFIRMATION_REQUIRED", "请阅读当前版本承诺内容并主动确认");
    String recordId = "declaration_" + hash(id + ":" + version + ":" + a.id).substring(0, 32);
    store.db().update("INSERT IGNORE INTO jf_education_declaration(id,group_id,group_version,user_id,text_snapshot,text_sha256) VALUES(?,?,?,?,?,?)", recordId, id, version, a.id, declaration, hash(declaration));
    return m("ok", true, "id", recordId);
  }
}
