package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.stp.parameter.SaLoginParameter;
import cn.hutool.crypto.digest.BCrypt;
import java.util.*;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.api.model.LoginUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JfAuth {
  private final JfStore store;
  private final boolean devLogin;
  private final boolean passwordLogin;

  public JfAuth(JfStore store, @Value("${jiafeng.dev-login:false}") boolean devLogin,
      @Value("${jiafeng.password-login-enabled:false}") boolean passwordLogin) {
    this.store = store;
    this.devLogin = devLogin;
    this.passwordLogin = passwordLogin;
  }

  public static class Actor {
    public final long id;
    public final String username, name, realm;
    public final Set<String> roles, regions;
    public final long version;
    public final long authEpoch;
    private final List<String> permissions;

    Actor(Map<String, Object> row) {
      id = number(row.get("user_id"));
      username = text(row.get("user_name"));
      name = text(row.get("nick_name"));
      realm = text(row.get("realm"));
      version = number(row.get("version"));
      roles = strings(row.get("roles"));
      regions = strings(row.get("region_ids"));
      permissions = List.copyOf(strings(row.get("permissions")));
      var rawProfile = row.get("profile");
      var profile = rawProfile instanceof String ? parse((String) rawProfile) : obj(rawProfile);
      authEpoch = number(profile.getOrDefault("authEpoch", 0));
    }

    private static Set<String> strings(Object o) {
      Object a =
          o instanceof String
              ? org.dromara.common.json.utils.JsonUtils.parseObject((String) o, List.class)
              : o;
      Set<String> s = new LinkedHashSet<>();
      list(a).forEach(x -> s.add(text(x)));
      return s;
    }

    public boolean national() {
      return roles.contains("national_admin");
    }

    public boolean operator() {
      return national() || roles.stream().anyMatch(Set.of("regional_admin", "content_operator", "review_manager", "data_operator")::contains);
    }

    public boolean region(String r) {
      return national() || regions.contains(r);
    }

    public Map<String, Object> dto() {
      return m(
          "id",
          Long.toString(id),
          "username",
          username,
          "name",
          name,
          "roles",
          roles,
          "regionIds",
          regions,
          "permissions",
          permissions(),
          "version",
          version);
    }

    public List<String> permissions() {
      return permissions;
    }
  }

  public Actor byId(long id) {
    List<Map<String, Object>> r =
        store
            .db()
            .queryForList(
                "SELECT a.*,u.user_name,u.nick_name FROM jf_account a JOIN sys_user u ON"
                    + " u.user_id=a.user_id WHERE a.user_id=? AND a.enabled=1 AND u.status='0' AND"
                    + " u.del_flag='0'",
                id);
    Jf.require(!r.isEmpty(), 401, "SESSION_INVALID", "会话已失效，请重新登录");
    JfAccess.bootstrapLegacyAccount(store.db(), r.getFirst());
    return new Actor(JfAccess.populate(store.db(), r.getFirst()));
  }

  public Actor adminTarget(long id) {
    var r =
        store
            .db()
            .queryForList(
                "SELECT a.*,u.user_name,u.nick_name FROM jf_account a JOIN sys_user u ON"
                    + " u.user_id=a.user_id WHERE a.user_id=? AND u.del_flag='0' FOR UPDATE",
                id);
    Jf.require(!r.isEmpty(), 404, "NOT_FOUND", "用户不存在");
    JfAccess.bootstrapLegacyAccount(store.db(), r.getFirst());
    return new Actor(JfAccess.populate(store.db(), r.getFirst()));
  }

  public Actor optional() {
    if (!StpUtil.isLogin()) {
      String authorization =
          org.dromara.common.core.utils.ServletUtils.getRequest().getHeader("Authorization");
      if (authorization != null && !authorization.isBlank())
        throw error(401, "SESSION_INVALID", "登录已失效，请重新登录");
      return null;
    }
    LoginUser user = LoginHelper.getLoginUser();
    if (user == null || !bool(StpUtil.getTokenSession().get("jiafeng")))
      throw error(401, "SESSION_INVALID", "请从家风平台登录");
    var actor = byId(user.getUserId());
    Object epoch = StpUtil.getTokenSession().get("jiafengAuthEpoch");
    Jf.require(actor.authEpoch == number(epoch == null ? 0 : epoch), 401,
        "SESSION_INVALID", "账号授权已更新，请重新登录");
    return actor;
  }

  public Actor require() {
    Actor a = optional();
    if (a == null) throw error(401, "UNAUTHENTICATED", "请先登录");
    return a;
  }

  public Actor admin() {
    Actor a = require();
    Jf.require(a.operator() || a.roles.contains("expert"), 403, "FORBIDDEN", "没有后台访问权限");
    return a;
  }

  public void operate(Actor a, String region) {
    Jf.require(a.operator() && a.region(region), 404, "NOT_FOUND", "记录不存在或不可见");
  }

  public void ownOrOperate(Actor a, JfStore.Entity e) {
    Jf.require(
        Objects.equals(a.id, e.owner()) || (a.operator() && a.region(e.region())),
        404,
        "NOT_FOUND",
        "记录不存在或不可见");
  }

  public Map<String, Object> login(Map<String, Object> input, String remote) {
    Jf.require(devLogin || passwordLogin, 503, "LOGIN_NOT_CONFIGURED", "账号密码登录未启用；微信登录尚未配置");
    String username = required(input, "username", 1, 64),
        password = required(input, "password", 1, 128),
        client = str(input, "client");
    Jf.require(List.of("member", "admin").contains(client), 422, "INVALID_CLIENT", "登录入口无效");
    String key = hash(remote + ":" + username);
    List<Map<String, Object>> attempts =
        store
            .db()
            .queryForList(
                "SELECT failures FROM jf_login_attempt WHERE identity_hash=? AND"
                    + " last_failure>DATE_SUB(NOW(),INTERVAL 15 MINUTE)",
                key);
    Jf.require(
        attempts.isEmpty() || number(attempts.getFirst().get("failures")) < 10,
        429,
        "LOGIN_RATE_LIMIT",
        "尝试次数过多，请十五分钟后重试");
    List<Map<String, Object>> rows =
        store
            .db()
            .queryForList(
                "SELECT u.user_id,u.password FROM sys_user u JOIN jf_account a ON"
                    + " a.user_id=u.user_id WHERE u.user_name=? AND u.del_flag='0' AND u.status='0'"
                    + " AND a.enabled=1",
                username);
    if (rows.isEmpty() || !BCrypt.checkpw(password, text(rows.getFirst().get("password")))) {
      store
          .db()
          .update(
              "INSERT INTO jf_login_attempt(identity_hash,failures) VALUES(?,1) ON DUPLICATE KEY"
                  + " UPDATE failures=IF(last_failure<DATE_SUB(NOW(),INTERVAL 15"
                  + " MINUTE),1,failures+1),last_failure=NOW()",
              key);
      throw error(401, "INVALID_CREDENTIALS", "账号或密码错误");
    }
    Actor a = byId(number(rows.getFirst().get("user_id")));
    Jf.require(
        !client.equals("admin") || a.operator() || a.roles.contains("expert"),
        403,
        "FORBIDDEN",
        "该账号没有后台权限");
    LoginUser user = new LoginUser();
    user.setUserId(a.id);
    user.setUsername(a.username);
    user.setNickname(a.name);
    user.setUserType(a.realm.equals("member") ? "app_user" : "sys_user");
    user.setDeptId(100L);
    user.setDeptName("家风试点");
    user.setLoginLocation(devLogin ? "本机开发环境" : "家风网页账号");
    user.setMenuPermission(new HashSet<>(a.permissions()));
    user.setRolePermission(a.roles);
    user.setRoles(List.of());
    user.setDataScopeRoleMap(Map.of());
    LoginHelper.login(
        user,
        new SaLoginParameter()
            .setDeviceType(client)
            .setTimeout(28800)
            .setExtra("clientid", "jiafeng")
            .setExtra("clientAccessPath", "/api/v1/**"));
    StpUtil.getTokenSession().set("jiafeng", true);
    StpUtil.getTokenSession().set("jiafengAuthEpoch", a.authEpoch);
    store.db().update("DELETE FROM jf_login_attempt WHERE identity_hash=?", key);
    store.audit(
        a, "login", username, a.regions.stream().findFirst().orElse("all"), m("client", client));
    return m("token", StpUtil.getTokenValue(), "user", a.dto());
  }
}
