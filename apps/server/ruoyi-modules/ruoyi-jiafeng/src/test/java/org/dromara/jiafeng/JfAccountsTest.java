package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.dromara.common.core.utils.SpringUtils;
import org.dromara.system.service.ISysUserService;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class JfAccountsTest {
  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory(); beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  @Test void regionAndRoleInputsCannotCreateASecondPrivilegeVocabulary() {
    assertThrows(ApiException.class, () -> JfAccounts.cleanRoles(List.of("superadmin")));
    assertThrows(ApiException.class, () -> JfAccounts.cleanRoles(List.of()));
    assertEquals(List.of("content_operator"), JfAccounts.cleanRoles(List.of("content_operator", "content_operator")));
    assertThrows(ApiException.class, () -> JfAccounts.cleanRegions(List.of("all"), List.of("regional_admin")));
    assertThrows(ApiException.class, () -> JfAccounts.cleanRegions(List.of("unknown"), List.of("member")));
    assertEquals(List.of("all"), JfAccounts.cleanRegions(List.of(), List.of("national_admin")));
    assertEquals(List.of("zhejiang"), JfAccounts.cleanRegions(List.of("zhejiang"), List.of("member")));
  }

  @Test void passwordsHonorBcryptByteLimitAndNeverImplicitlyTrimSecret() {
    String valid = "Strong-example-pass-2026";
    assertEquals(valid, JfAccounts.password(m("password", valid)));
    assertThrows(ApiException.class, () -> JfAccounts.password(m("password", "short1")));
    assertThrows(ApiException.class, () -> JfAccounts.password(m("password", "汉".repeat(25) + "1")));
    assertThrows(ApiException.class, () -> JfAccounts.password(m("password", "abcdefghijklmn")));
  }

  @Test void sensitiveActionsHaveIndependentPermissions() {
    assertEquals("users:create", JfAccounts.permissionFor("create"));
    assertEquals("users:roles", JfAccounts.permissionFor("roles"));
    assertEquals("users:review", JfAccounts.permissionFor("materials"));
    assertEquals("users:review", JfAccounts.permissionFor("review"));
    assertEquals("users:resetPassword", JfAccounts.permissionFor("resetPassword"));
    assertThrows(ApiException.class, () -> JfAccounts.permissionFor("delete"));
  }

  @Test void anAdministratorCannotDisableThemselvesEvenWithWritePermission() {
    var store = mock(JfStore.class); var db = mock(JdbcTemplate.class); var auth = mock(JfAuth.class);
    var upstream = mock(ISysUserService.class);
    when(store.db()).thenReturn(db);
    var actor = JfAccessTest.actor("national_admin", "users:status");
    when(auth.byId(actor.id)).thenReturn(actor);
    when(store.idempotent(eq(actor), anyString(), anyString(), any(), any()))
        .thenAnswer(call -> ((Supplier<?>) call.getArgument(4)).get());
    when(db.queryForList(startsWith("SELECT a.*,u.user_name"), eq(actor.id)))
        .thenReturn(List.of(m("user_id", actor.id, "version", 1, "profile", "{}", "region_ids", List.of("zhejiang"))));
    when(db.queryForList(startsWith("SELECT DISTINCT r.role_key"), eq(actor.id)))
        .thenReturn(List.of(m("role_key", "jf_national_admin")));
    var service = new JfAccounts(store, auth, upstream);
    var failure = assertThrows(ApiException.class, () -> service.change(actor, actor.id, "status", m("version", 1, "enabled", false), "fixture-key-001"));
    assertEquals("SELF_CHANGE_FORBIDDEN", failure.code);
    verifyNoInteractions(upstream); verify(store, never()).audit(any(), anyString(), anyString(), anyString(), anyMap());
  }

  @Test void regionalStaffCannotReachAnotherRegionsAccount() {
    var store = mock(JfStore.class); var db = mock(JdbcTemplate.class);
    when(store.db()).thenReturn(db);
    var actor = JfAccessTest.actor("regional_admin", "users:read");
    when(db.queryForList(startsWith("SELECT a.*,u.user_name"), eq(9L)))
        .thenReturn(List.of(m("user_id", 9L, "version", 1, "profile", "{}", "region_ids", List.of("beijing"))));
    when(db.queryForList(startsWith("SELECT DISTINCT r.role_key"), eq(9L))).thenReturn(List.of(m("role_key", "jf_member")));
    var service = new JfAccounts(store, mock(JfAuth.class), mock(ISysUserService.class));
    assertEquals(404, assertThrows(ApiException.class, () -> service.detail(actor, 9)).status);
  }
}
