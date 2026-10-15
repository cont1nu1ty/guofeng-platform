package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class JfAccessTest {
  static JfAuth.Actor actor(String role, String... permissions) {
    return new JfAuth.Actor(m("user_id", 7, "user_name", "fixture", "nick_name", "样例", "version", 1,
        "realm", "staff", "roles", List.of(role), "region_ids", List.of("zhejiang"), "permissions", List.of(permissions)));
  }

  @Test void contentOperatorKeepsItsRegionButCannotUseReviewOrExportCommands() {
    var actor = actor("content_operator", "content:read", "content:write");
    assertTrue(actor.operator()); assertTrue(actor.region("zhejiang")); assertFalse(actor.region("beijing"));
    assertDoesNotThrow(() -> JfAccess.authorizeCommand(actor, "saveContent"));
    assertEquals(403, assertThrows(ApiException.class, () -> JfAccess.authorizeCommand(actor, "assignReview")).status);
    assertFalse(JfAccess.can(actor, "collections:export"));
    assertThrows(ApiException.class, () -> JfAccess.authorizeCommand(actor, "unknownCommand"));
  }

  @Test void rolesAloneNeverGrantPermissionAndReadDoesNotGrantWrite() {
    assertFalse(JfAccess.can(actor("national_admin"), "users:roles"));
    assertFalse(JfAccess.can(actor("data_operator", "analytics:read"), "analytics:export"));
    assertThrows(ApiException.class, () -> JfAccess.authorizeCommand(actor("review_manager", "reviews:configure"), "configureReviewFlow"));
  }

  @Test void unrelatedOperationalRoleDoesNotWidenAnExpertsAssignedTaskScope() {
    var actor = new JfAuth.Actor(m("user_id", 7, "version", 1,
        "roles", List.of("expert", "content_operator"), "region_ids", List.of("zhejiang"),
        "permissions", List.of("reviews:read", "reviews:score", "content:read", "content:write")));
    assertTrue(actor.operator());
    assertFalse(JfAccess.reviewOperator(actor));
    var filter = JfQueries.filter(actor, "task", "all", "", "");
    assertTrue(filter.sql().contains("owner_id=?"));
    assertFalse(filter.sql().contains("region_id IN"));
    assertEquals(List.of(7L), filter.args());
  }

  @Test void reviewManagementPostKeepsRegionalReadWhenWritePermissionIsRevoked() {
    for (String role : List.of("national_admin", "regional_admin", "review_manager")) {
      var actor = actor(role, "reviews:read");
      assertTrue(JfAccess.reviewOperator(actor));
      assertFalse(JfAccess.can(actor, "reviews:manage"));
      var filter = JfQueries.filter(actor, "task", "all", "", "");
      assertFalse(filter.sql().contains("owner_id=?"));
      if (!actor.national()) assertTrue(filter.sql().contains("region_id IN"));
    }
    assertFalse(JfAccess.reviewOperator(actor("review_manager")));
  }

  @Test void projectionDropsUnauthorizedDataButPreservesExpertBlindTasks() {
    var result = m("users", List.of("private"), "submissions", List.of("private"), "tasks", List.of("task"),
        "contents", List.of("public"), "privateRecordStats", m("recitations", 9));
    JfAccess.trimWorkspace(actor("content_operator", "content:read"), result);
    assertEquals(List.of("public"), result.get("contents"));
    assertEquals(List.of(), result.get("users")); assertEquals(List.of(), result.get("submissions"));
    assertEquals(Map.of(), result.get("privateRecordStats"));
    var blind = m("submissions", List.of(m("title", "匿名稿件")), "tasks", List.of("my-task"));
    JfAccess.trimWorkspace(actor("expert", "reviews:read", "reviews:score"), blind);
    assertEquals(1, list(blind.get("submissions")).size());
    assertEquals(List.of("my-task"), blind.get("tasks"));
    assertEquals(List.of(), blind.get("experts"));
  }

  @Test void runtimeRoleMenuRevocationWinsOverTheLegacyRoleMirror() {
    var db = mock(JdbcTemplate.class);
    when(db.queryForList(startsWith("SELECT DISTINCT r.role_key"), eq(7L)))
        .thenReturn(List.of(m("role_key", "jf_content_operator")), List.of());
    when(db.queryForList(startsWith("SELECT DISTINCT m.perms"), eq(7L)))
        .thenReturn(List.of(m("perms", "content:read")), List.of());
    var row = m("user_id", 7, "version", 1, "roles", List.of("national_admin"), "region_ids", List.of("zhejiang"));
    var first = new JfAuth.Actor(JfAccess.populate(db, row));
    assertEquals(Set.of("content_operator"), first.roles); assertTrue(JfAccess.can(first, "content:read"));
    var revoked = new JfAuth.Actor(JfAccess.populate(db, row));
    assertTrue(revoked.roles.isEmpty()); assertFalse(revoked.operator());
    assertFalse(JfAccess.can(revoked, "content:read"));
  }

  @Test void migratedAccountNeverRecreatesRevokedBindingsOnLogin() {
    var db = mock(JdbcTemplate.class);
    JfAccess.bootstrapLegacyAccount(db, m("user_id", 7, "profile", m("rbacMigrated", true), "roles", List.of("national_admin")));
    verifyNoInteractions(db);
    JfAccess.bootstrapLegacyAccount(db, m("user_id", 8, "profile", m(), "roles", List.of("member")));
    verify(db).update(startsWith("INSERT IGNORE INTO sys_user_role"), eq(8L));
    verify(db).update(contains("WHERE user_id=? AND JSON_EXTRACT(profile,'$.rbacMigrated') IS NULL"), eq(8L));
  }
}
