package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.BCrypt;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.dromara.system.domain.bo.SysUserBo;
import org.dromara.system.service.ISysUserService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Account administration composes RuoYi users/roles with the family's region and review policy. */
@Service
public class JfAccounts {
  private final JfStore store;
  private final JfAuth auth;
  private final ISysUserService users;

  public JfAccounts(JfStore store, JfAuth auth, ISysUserService users) {
    this.store = store; this.auth = auth; this.users = users;
  }

  public Object list(JfAuth.Actor actor, String query, String role, String region, String status, int page, int size) {
    JfAccess.require(actor, "users:read");
    require(page >= 1 && page <= 100000 && size >= 1 && size <= 100, 422, "INVALID_PAGE", "分页参数无效");
    require(query.length() <= 80, 422, "INVALID_FILTER", "搜索内容过长");
    require(role.isBlank() || JfAccess.ROLE_KEYS.contains(role), 422, "INVALID_ROLE", "岗位筛选无效");
    require(region.isBlank() || region.equals("all") || REGION_IDS.contains(region), 422, "INVALID_REGION", "地区筛选无效");
    require(Set.of("", "enabled", "disabled", "pending", "approved", "rejected", "returned").contains(status),
        422, "INVALID_STATUS", "状态筛选无效");
    StringBuilder where = new StringBuilder(" WHERE u.del_flag='0'");
    List<Object> args = new ArrayList<>();
    if (!actor.national()) {
      where.append(" AND JSON_CONTAINS(?,a.region_ids) AND NOT EXISTS (SELECT 1 FROM sys_user_role x JOIN sys_role r "
          + "ON r.role_id=x.role_id WHERE x.user_id=a.user_id AND r.role_key='jf_national_admin')");
      args.add(json(actor.regions));
    }
    if (!query.isBlank()) {
      where.append(" AND (u.user_name LIKE ? OR u.nick_name LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(a.profile,'$.organization')) LIKE ?)");
      String needle = "%" + query.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      args.add(needle); args.add(needle); args.add(needle);
    }
    if (!role.isBlank()) {
      where.append(" AND EXISTS (SELECT 1 FROM sys_user_role ur JOIN sys_role r ON r.role_id=ur.role_id "
          + "WHERE ur.user_id=a.user_id AND r.role_key=? AND r.status='0' AND r.del_flag='0')");
      args.add("jf_" + role);
    }
    if (!region.isBlank()) { where.append(" AND JSON_CONTAINS(a.region_ids,JSON_QUOTE(?))"); args.add(region); }
    if (status.equals("enabled")) where.append(" AND a.enabled=1 AND u.status='0'");
    else if (status.equals("disabled")) where.append(" AND (a.enabled=0 OR u.status<>'0')");
    else if (!status.isBlank()) {
      where.append(" AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.profile,'$.accountReviewStatus')),'pending')=?");
      args.add(status);
    }
    String from = " FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id";
    Long total = store.db().queryForObject("SELECT COUNT(*)" + from + where, Long.class, args.toArray());
    args.add(size); args.add((page - 1) * size);
    var rows = store.db().queryForList("SELECT a.*,u.user_name,u.nick_name,u.status AS user_status" + from + where
        + " ORDER BY a.created_at DESC,a.user_id DESC LIMIT ? OFFSET ?", args.toArray());
    return m("items", rows.stream().map(this::dto).toList(), "total", total, "page", page, "pageSize", size,
        "roles", roleOptions(), "permissions", actor.permissions());
  }

  public static List<Map<String, Object>> roleOptions() {
    return JfAccess.ROLE_KEYS.stream().map(key -> m("key", key, "label", JfAccess.roleLabel(key))).toList();
  }

  public Object detail(JfAuth.Actor actor, long id) {
    JfAccess.require(actor, "users:read");
    var target = target(actor, id, false);
    var result = dto(target);
    // Dossier notes can contain private information: separate them from the roster's read grant.
    result.put("reviews", JfAccess.can(actor, "users:review")
        ? store.db().queryForList("SELECT id,subject,action,actor_name AS actorName,summary,material_reference AS materialReference,"
            + "created_at AS createdAt FROM jf_account_review WHERE user_id=? ORDER BY created_at DESC,id DESC", id)
        : List.of());
    return result;
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object change(JfAuth.Actor actor, long id, String action, Map<String, Object> input, String key) {
    String permission = permissionFor(action);
    JfAccess.require(actor, permission);
    // Serialize privilege changes with the same actor-row lock as normal domain commands.
    return store.idempotent(actor, "account:" + action + ":" + id, key, input, () -> {
      var current = auth.byId(actor.id);
      require(current.authEpoch == actor.authEpoch, 401, "SESSION_INVALID", "账号授权已更新，请重新登录");
      JfAccess.require(current, permission);
      if (Set.of("create", "roles", "resetPassword").contains(action))
        require(current.national(), 403, "FORBIDDEN", "仅全国管理员可执行此项操作");
      if (action.equals("create")) return create(current, input);
      var row = target(current, id, true);
      require(input.containsKey("version"), 428, "VERSION_REQUIRED", "缺少账号版本，请刷新");
      require(number(input.get("version")) == number(row.get("version")), 412, "VERSION_CONFLICT", "账号已更新，请刷新后重试");
      if (Set.of("roles", "status", "resetPassword").contains(action))
        require(current.id != id, 409, "SELF_CHANGE_FORBIDDEN", "不能通过管理操作修改自己的授权、密码或状态");
      var profile = parse(text(row.get("profile")));
      switch (action) {
        case "roles" -> {
          List<String> roles = cleanRoles(input.get("roles"));
          var before = new JfAuth.Actor(JfAccess.populate(store.db(), row));
          if (roles.contains("expert") && !before.roles.contains("expert"))
            require(str(profile, "expertReviewStatus").equals("approved"), 409, "EXPERT_REVIEW_REQUIRED", "请先完成专家资料人工审核，再授予专家岗位");
          List<String> regions = cleanRegions(input.get("regionIds"), roles);
          bindRoles(id, roles);
          store.db().update("UPDATE jf_account SET roles=?,region_ids=?,realm=? WHERE user_id=?", json(roles), json(regions),
              roles.stream().allMatch(r -> r.equals("member")) ? "member" : "staff", id);
          // Keep the RuoYi login realm aligned with the account's effective staff/member identity.
          store.db().update("UPDATE sys_user SET user_type=? WHERE user_id=?", roles.stream().allMatch(r -> r.equals("member")) ? "app_user" : "sys_user", id);
          bumpEpoch(profile);
        }
        case "status" -> {
          require(input.get("enabled") instanceof Boolean, 422, "INVALID_STATUS", "账号状态无效");
          boolean enabled = bool(input.get("enabled"));
          users.updateUserStatus(id, enabled ? "0" : "1");
          store.db().update("UPDATE jf_account SET enabled=? WHERE user_id=?", enabled, id);
          bumpEpoch(profile);
        }
        case "resetPassword" -> {
          String password = password(input);
          users.resetUserPwd(id, BCrypt.hashpw(password));
          bumpEpoch(profile);
        }
        case "materials", "review" -> recordReview(current, id, action, input, profile);
        default -> throw error(422, "UNKNOWN_COMMAND", "账号操作无效");
      }
      store.db().update("UPDATE jf_account SET profile=?,version=version+1 WHERE user_id=?", json(profile), id);
      store.audit(current, "account." + action, Long.toString(id), firstRegion(row), m());
      return m("ok", true, "id", Long.toString(id), "message", "账号信息已保存");
    });
  }

  /** Compatibility entry point used by the old command endpoint. It still requires a real review note. */
  public Object legacyCommand(JfAuth.Actor actor, String command, String id, Object version, Map<String, Object> input) {
    var data = copy(input); data.put("version", version);
    String action = switch (command) {
      case "saveUserRoles" -> "roles";
      case "toggleUser" -> "status";
      case "approveUser" -> "review";
      default -> throw error(422, "UNKNOWN_COMMAND", "账号操作无效");
    };
    if (action.equals("roles")) {
      data.put("roles", Jf.list(data.get("roles")).stream().map(value -> {
        String role = text(value);
        if (role.equals("区域运营")) return "regional_admin";
        return JfAccess.ROLE_KEYS.stream().filter(k -> k.equals(role) || JfAccess.roleLabel(k).equals(role))
            .findFirst().orElse(role);
      }).toList());
      data.putIfAbsent("regionIds", new JfAuth.Actor(target(actor, number(id), false)).regions.stream().toList());
    }
    // The outer command is already idempotent; a deterministic nested key is safe and contains no secrets.
    return change(actor, number(id), action, data, "legacy-" + hash(json(m("command", command, "id", id, "data", data))));
  }

  static String permissionFor(String action) {
    return switch (action) {
      case "create" -> "users:create";
      case "roles" -> "users:roles";
      case "status" -> "users:status";
      case "resetPassword" -> "users:resetPassword";
      case "materials", "review" -> "users:review";
      default -> throw error(422, "UNKNOWN_COMMAND", "账号操作无效");
    };
  }

  private Object create(JfAuth.Actor actor, Map<String, Object> input) {
    String username = required(input, "username", 3, 30).toLowerCase(Locale.ROOT);
    require(username.matches("[a-z0-9][a-z0-9_.-]{2,29}"), 422, "INVALID_USERNAME", "账号须为3至30位字母、数字、点、横线或下划线");
    String name = required(input, "name", 1, 30), password = password(input);
    String organization = required(input, "organization", 1, 120);
    List<String> roles = cleanRoles(input.get("roles"));
    require(!roles.contains("expert"), 409, "EXPERT_REVIEW_REQUIRED", "新账号先登记资料并完成人工审核，再授予专家岗位");
    List<String> regions = cleanRegions(input.get("regionIds"), roles);
    require(store.db().queryForObject("SELECT COUNT(*) FROM sys_user WHERE user_name=?", Long.class, username) == 0,
        409, "USERNAME_EXISTS", "此账号已存在");
    long id = IdUtil.getSnowflakeNextId();
    try { store.db().update("INSERT INTO jf_account_name(user_name,user_id) VALUES(?,?)", username, id); }
    catch (DuplicateKeyException conflict) { throw error(409, "USERNAME_EXISTS", "此账号已存在"); }
    boolean member = roles.stream().allMatch(r -> r.equals("member"));
    var user = new SysUserBo();
    user.setUserId(id); user.setUserName(username); user.setNickName(name); user.setUserType(member ? "app_user" : "sys_user");
    user.setPassword(BCrypt.hashpw(password)); user.setStatus("0"); user.setCreateBy(actor.id);
    require(users.insertUser(user) == 1, 500, "ACCOUNT_CREATE_FAILED", "账号未能创建，请重试");
    var profile = m("organization", organization, "status", "待审核", "accountReviewStatus", "pending",
        "expertReviewStatus", "pending", "rbacMigrated", true, "authEpoch", 0);
    store.db().update("INSERT INTO jf_account(user_id,realm,region_ids,roles,profile) VALUES(?,?,?,?,?)", id,
        member ? "member" : "staff", json(regions), json(roles), json(profile));
    bindRoles(id, roles);
    store.audit(actor, "account.create", Long.toString(id), regions.getFirst(), m("username", username));
    return m("ok", true, "id", Long.toString(id), "message", "账号已创建；资料审核与岗位授权独立记录");
  }

  private Map<String, Object> target(JfAuth.Actor actor, long id, boolean lock) {
    var rows = store.db().queryForList("SELECT a.*,u.user_name,u.nick_name,u.status AS user_status FROM jf_account a "
        + "JOIN sys_user u ON u.user_id=a.user_id WHERE a.user_id=? AND u.del_flag='0'" + (lock ? " FOR UPDATE" : ""), id);
    require(!rows.isEmpty(), 404, "NOT_FOUND", "账号不存在或不可见");
    var target = new JfAuth.Actor(JfAccess.populate(store.db(), rows.getFirst()));
    require(actor.national() || (!target.national() && !target.regions.isEmpty() && target.regions.stream().allMatch(actor.regions::contains)),
        404, "NOT_FOUND", "账号不存在或不可见");
    return rows.getFirst();
  }

  private Map<String, Object> dto(Map<String, Object> row) {
    var actor = new JfAuth.Actor(JfAccess.populate(store.db(), row));
    var profile = parse(text(row.get("profile")));
    return m("id", Long.toString(actor.id), "username", actor.username, "name", actor.name,
        "organization", profile.getOrDefault("organization", ""), "roles", actor.roles,
        "roleLabels", actor.roles.stream().map(JfAccess::roleLabel).toList(), "regionIds", actor.regions,
        "regionLabels", actor.regions.stream().map(Jf::regionName).toList(),
        "enabled", (Boolean.TRUE.equals(row.get("enabled")) || text(row.get("enabled")).equals("1")) && str(row, "user_status").equals("0"),
        "accountReviewStatus", profile.getOrDefault("accountReviewStatus", "pending"),
        "expertReviewStatus", profile.getOrDefault("expertReviewStatus", "pending"),
        "legacyStatus", profile.getOrDefault("status", ""), "version", actor.version,
        "createdAt", timestamp(row.get("created_at")));
  }

  private void bindRoles(long userId, List<String> roles) {
    // Only replace family roles; unrelated upstream role bindings survive.
    store.db().update("DELETE ur FROM sys_user_role ur JOIN sys_role r ON r.role_id=ur.role_id "
        + "WHERE ur.user_id=? AND LEFT(r.role_key,3)='jf_'", userId);
    for (String role : roles) {
      int changed = store.db().update("INSERT INTO sys_user_role(user_id,role_id) SELECT ?,role_id FROM sys_role "
          + "WHERE role_key=? AND status='0' AND del_flag='0'", userId, "jf_" + role);
      require(changed == 1, 409, "ROLE_UNAVAILABLE", "岗位不可用，请刷新或联系管理员");
    }
    if (roles.contains("expert") && store.db().queryForObject(
        "SELECT COUNT(*) FROM jf_entity WHERE kind='expert' AND owner_id=?", Long.class, userId) == 0) {
      var row = store.db().queryForMap("SELECT a.region_ids,u.nick_name FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id WHERE a.user_id=?", userId);
      var regions = org.dromara.common.json.utils.JsonUtils.parseObject(text(row.get("region_ids")), List.class);
      store.create("expert", userId, text(regions.getFirst()), "active", m("name", row.get("nick_name"), "title", "评审专家",
          "organization", "", "group", "待分组", "availability", "暂停接单", "specialties", List.of(), "biography", ""));
    }
  }

  private void recordReview(JfAuth.Actor actor, long id, String action, Map<String, Object> input, Map<String, Object> profile) {
    require(actor.id != id, 409, "SELF_REVIEW_FORBIDDEN", "不能审核自己的资料");
    String subject = required(input, "subject", 1, 20);
    require(Set.of("account", "expert").contains(subject), 422, "INVALID_SUBJECT", "请选择账号资料或专家资料");
    String summary = required(input, "summary", 5, 2000);
    String reference = str(input, "materialReference");
    require(reference.length() <= 1000, 422, "INVALID_MATERIAL", "资料来源说明最多1000字");
    String result = "submitted", status = "pending";
    if (action.equals("materials")) require(!reference.isBlank(), 422, "MATERIAL_REQUIRED", "请填写资料来源或归档编号");
    else {
      result = str(input, "result");
      require(Set.of("approved", "rejected", "returned").contains(result), 422, "INVALID_REVIEW", "审核结论无效");
      var previous = store.db().queryForList("SELECT action,material_reference FROM jf_account_review WHERE user_id=? AND subject=? "
          + "ORDER BY created_at DESC,id DESC LIMIT 1", id, subject);
      require(!previous.isEmpty() && str(previous.getFirst(), "action").equals("submitted"), 409,
          "MATERIALS_REQUIRED", "请先登记本轮资料，再提交审核结论");
      reference = str(previous.getFirst(), "material_reference");
      status = result;
    }
    store.db().update("INSERT INTO jf_account_review(id,user_id,subject,action,actor_id,actor_name,summary,material_reference) VALUES(?,?,?,?,?,?,?,?)",
        id("account_review_"), id, subject, result, actor.id, actor.name, summary, reference);
    profile.put(subject + "ReviewStatus", status);
    if (subject.equals("account")) profile.put("status", switch (status) {
      case "approved" -> "人工通过"; case "rejected" -> "未通过"; case "returned" -> "需补充"; default -> "待审核";
    });
  }

  static List<String> cleanRoles(Object input) {
    List<String> roles = Jf.list(input).stream().map(Jf::text).distinct().toList();
    require(!roles.isEmpty() && roles.stream().allMatch(JfAccess.ROLE_KEYS::contains), 422, "INVALID_ROLE", "至少选择一个有效岗位");
    return roles;
  }

  static List<String> cleanRegions(Object input, List<String> roles) {
    List<String> regions = Jf.list(input).stream().map(Jf::text).distinct().toList();
    if (roles.contains("national_admin")) return List.of("all");
    require(!regions.isEmpty() && regions.stream().allMatch(REGION_IDS::contains), 422, "INVALID_REGION", "请选择至少一个明确的授权地区");
    return regions;
  }

  static String password(Map<String, Object> input) {
    String value = str(input, "password");
    require(value.length() >= 12 && value.getBytes(StandardCharsets.UTF_8).length <= 72
        && value.chars().anyMatch(Character::isLetter) && value.chars().anyMatch(Character::isDigit),
        422, "INVALID_PASSWORD", "密码至少12位，须含字母和数字，UTF-8编码不超过72字节");
    return value;
  }

  private static void bumpEpoch(Map<String, Object> profile) {
    profile.put("authEpoch", number(profile.getOrDefault("authEpoch", 0)) + 1);
    profile.put("rbacMigrated", true);
  }

  private static String firstRegion(Map<String, Object> row) {
    var regions = org.dromara.common.json.utils.JsonUtils.parseObject(text(row.get("region_ids")), List.class);
    return regions.isEmpty() ? "all" : text(regions.getFirst());
  }
}
