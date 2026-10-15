package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** Adapts the existing RuoYi role/menu tables; region and ownership remain domain policy. */
public final class JfAccess {
  private JfAccess() {}

  public static final Map<String, String> ROLE_LABELS = Collections.unmodifiableMap(new LinkedHashMap<>(Map.of(
      "national_admin", "全国管理员", "regional_admin", "区域综合运营", "content_operator", "内容运营",
      "review_manager", "评审管理", "data_operator", "数据运营", "expert", "专家", "member", "投稿用户")));
  public static final List<String> ROLE_KEYS = List.of("national_admin", "regional_admin", "content_operator",
      "review_manager", "data_operator", "expert", "member");

  public static String roleLabel(String role) { return ROLE_LABELS.getOrDefault(role, role); }

  /** Called after development seeding too. A marker prevents revoked roles being restored on restart. */
  public static void bootstrapLegacyRoles(JdbcTemplate db) {
    db.update("INSERT IGNORE INTO jf_account_name(user_name,user_id) "
        + "SELECT u.user_name,a.user_id FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id");
    db.update("INSERT IGNORE INTO sys_user_role(user_id,role_id) "
        + "SELECT a.user_id,r.role_id FROM jf_account a "
        + "JOIN (SELECT 0 idx UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) n ON n.idx<JSON_LENGTH(a.roles) "
        + "JOIN sys_role r ON r.role_key=CONCAT('jf_',JSON_UNQUOTE(JSON_EXTRACT(a.roles,CONCAT('$[',n.idx,']')))) "
        + "WHERE JSON_EXTRACT(a.profile,'$.rbacMigrated') IS NULL");
    db.update("UPDATE jf_account SET profile=JSON_SET(profile,'$.rbacMigrated',true) "
        + "WHERE JSON_EXTRACT(profile,'$.rbacMigrated') IS NULL");
  }

  /** Seed scripts may add accounts after startup. Only the un-migrated row is adopted once. */
  static void bootstrapLegacyAccount(JdbcTemplate db, Map<String, Object> row) {
    Object raw = row.get("profile");
    var profile = raw instanceof String ? parse((String) raw) : obj(raw);
    if (profile.containsKey("rbacMigrated")) return;
    long user = number(row.get("user_id"));
    db.update("INSERT IGNORE INTO jf_account_name(user_name,user_id) SELECT u.user_name,a.user_id FROM jf_account a "
        + "JOIN sys_user u ON u.user_id=a.user_id WHERE a.user_id=?", user);
    db.update("INSERT IGNORE INTO sys_user_role(user_id,role_id) SELECT a.user_id,r.role_id FROM jf_account a "
        + "JOIN (SELECT 0 idx UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) n ON n.idx<JSON_LENGTH(a.roles) "
        + "JOIN sys_role r ON r.role_key=CONCAT('jf_',JSON_UNQUOTE(JSON_EXTRACT(a.roles,CONCAT('$[',n.idx,']')))) "
        + "WHERE a.user_id=? AND JSON_EXTRACT(a.profile,'$.rbacMigrated') IS NULL", user);
    db.update("UPDATE jf_account SET profile=JSON_SET(profile,'$.rbacMigrated',true) "
        + "WHERE user_id=? AND JSON_EXTRACT(profile,'$.rbacMigrated') IS NULL", user);
  }

  /** Read afresh on every authenticated request, so a role/menu revocation never relies on token claims. */
  static Map<String, Object> populate(JdbcTemplate db, Map<String, Object> row) {
    var result = new LinkedHashMap<>(row);
    long user = number(row.get("user_id"));
    var roles = db.queryForList("SELECT DISTINCT r.role_key FROM sys_role r JOIN sys_user_role ur ON ur.role_id=r.role_id "
        + "WHERE ur.user_id=? AND r.status='0' AND r.del_flag='0' AND LEFT(r.role_key,3)='jf_'", user);
    var keys = roles.stream().map(r -> text(r.get("role_key")).substring(3)).filter(ROLE_KEYS::contains).toList();
    var permissions = db.queryForList("SELECT DISTINCT m.perms FROM sys_menu m JOIN sys_role_menu rm ON rm.menu_id=m.menu_id "
        + "JOIN sys_role r ON r.role_id=rm.role_id JOIN sys_user_role ur ON ur.role_id=r.role_id "
        + "WHERE ur.user_id=? AND r.status='0' AND r.del_flag='0' AND m.status='0' "
        + "AND LEFT(r.role_key,3)='jf_' AND m.perms IS NOT NULL", user);
    result.put("roles", keys);
    result.put("permissions", permissions.stream().map(r -> text(r.get("perms"))).filter(p -> !p.isBlank()).toList());
    return result;
  }

  public static boolean can(JfAuth.Actor actor, String permission) {
    return actor != null && actor.permissions().stream()
        .anyMatch(p -> p.equals("*") || p.equals("*:*:*") || p.equals(permission));
  }

  public static void require(JfAuth.Actor actor, String permission) {
    Jf.require(can(actor, permission), 403, "FORBIDDEN", "当前岗位没有此项操作权限");
  }

  /** An unrelated operational post must not widen an expert's assigned-task read grant. */
  public static boolean reviewOperator(JfAuth.Actor actor) {
    return can(actor, "reviews:read") && actor.roles.stream()
        .anyMatch(Set.of("national_admin", "regional_admin", "review_manager")::contains);
  }

  public static String commandPermission(String command) {
    return switch (command) {
      case "approveSubmission", "batchApproveSubmissions", "returnSubmission", "prepareBlindMaterial" -> "submissions:write";
      case "assignReview", "updateReviewWindow", "decideSubmission", "publishSubmission" -> "reviews:manage";
      case "submitReview" -> "reviews:score";
      case "markReviewAlertRead" -> "reviews:read";
      case "configureReviewFlow" -> "reviews:configure";
      case "updateExpert" -> "experts:write";
      case "saveContent", "setContentStatus", "saveBanner", "setBannerStatus", "saveMedia", "setMediaStatus",
          "saveVenue", "setVenueStatus", "saveHallPerson", "setHallPersonStatus" -> "content:write";
      case "saveHomepageConfig" -> "settings:write";
      case "replySupportTicket" -> "consultations:write";
      case "saveCollection", "saveChapter", "moveChapter", "importChapter", "collectVolume" -> "collections:write";
      case "saveActivity", "setActivityStatus", "toggleAttendance" -> "activities:write";
      case "saveCourse", "toggleCourse", "publishCourse", "unpublishCourse", "education.saveGroup", "education.reviewIdentity", "saveLearningGroup", "assignLearningCourse" -> "education:write";
      case "saveProduct", "toggleProduct", "processClaim" -> "welfare:write";
      case "saveDictionaryWord", "toggleDictionaryWord", "saveKnowledgeDocument" -> "ai:write";
      case "savePlatformConfig" -> "settings:write";
      case "saveNotificationDraft", "publishNotification" -> "notifications:write";
      case "saveUserRoles" -> "users:roles";
      case "toggleUser" -> "users:status";
      case "approveUser" -> "users:review";
      case "issueCertificate", "revokeCertificate", "saveCertificate" -> "certificates:write";
      case "saveResource", "publishResource" -> "resources:write";
      case "saveRegion" -> "regions:write";
      default -> "";
    };
  }

  public static void authorizeCommand(JfAuth.Actor actor, String command) {
    String permission = commandPermission(command);
    Jf.require(!permission.isEmpty(), 422, "UNKNOWN_COMMAND", "不支持的运营动作");
    require(actor, permission);
    if (Set.of("configureReviewFlow", "savePlatformConfig", "saveUserRoles", "saveHomepageConfig").contains(command))
      Jf.require(actor.national(), 403, "FORBIDDEN", "仅全国管理员可执行此项操作");
  }

  /** Keep a stable DTO shape without shipping unauthorized arrays in command responses. */
  public static Map<String, Object> trimWorkspace(JfAuth.Actor actor, Map<String, Object> out) {
    var fields = Map.ofEntries(
        Map.entry("submissions", "submissions:read"), Map.entry("tasks", "reviews:read"),
        Map.entry("experts", "experts:read"), Map.entry("contents", "content:read"),
        Map.entry("banners", "content:read"), Map.entry("mediaItems", "content:read"),
        Map.entry("venues", "content:read"), Map.entry("hallPeople", "content:read"),
        Map.entry("collections", "collections:read"), Map.entry("activities", "activities:read"),
        Map.entry("courses", "education:read"), Map.entry("learningGroups", "education:read"),
        Map.entry("users", "users:read"), Map.entry("products", "welfare:read"),
        Map.entry("welfareClaims", "welfare:read"), Map.entry("knowledgeBases", "ai:read"),
        Map.entry("aiRecords", "ai:read"), Map.entry("dictionaryWords", "ai:read"),
        Map.entry("notificationDrafts", "notifications:read"), Map.entry("supportTickets", "consultations:read"),
        Map.entry("activityLog", "audit:read"));
    fields.forEach((field, permission) -> {
      boolean blindExpertWorks = field.equals("submissions") && !actor.operator()
          && actor.roles.contains("expert") && can(actor, "reviews:read");
      if (!can(actor, permission) && !blindExpertWorks) out.put(field, List.of());
    });
    if (!can(actor, "reviews:read")) {
      out.put("reviewFlow", Map.of()); out.put("scoringDimensions", List.of());
    }
    if (!can(actor, "settings:read")) out.put("platformConfig", Map.of());
    if (!can(actor, "content:read")) out.put("homepageConfig", Map.of());
    if (!can(actor, "analytics:read")) out.put("privateRecordStats", Map.of());
    out.put("permissions", actor.permissions());
    out.put("roles", actor.roles);
    return out;
  }
}
