package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import cn.dev33.satoken.stp.StpUtil;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** The HTTP boundary converts native framework/session data into the shared app contract. */
@RestController
@RequestMapping("/api/v1")
public class JfController {
  private final JfAuth auth;
  private final JfSchema schema;
  private final JfStore store;
  private final JfFiles files;
  private final JfSubmissions submissions;
  private final JfProjection projection;
  private final JfReview review;
  private final JfOperations operations;
  private final JfMember member;
  private final JfCatalog catalog;
  private final JfAccounts accounts;
  private final JfEducation education;
  private static final Set<String> REVIEW_COMMANDS =
      Set.of(
          "configureReviewFlow",
          "updateExpert",
          "submitReview",
          "batchApproveSubmissions",
          "approveSubmission",
          "returnSubmission",
          "prepareBlindMaterial",
          "assignReview",
          "updateReviewWindow",
          "markReviewAlertRead",
          "decideSubmission",
          "publishSubmission");

  public JfController(
      JfAuth auth,
      JfSchema schema,
      JfStore store,
      JfFiles files,
      JfSubmissions submissions,
      JfProjection projection,
      JfReview review,
      JfOperations operations,
      JfMember member,
      JfCatalog catalog, JfAccounts accounts, JfEducation education) {
    this.auth = auth;
    this.schema = schema;
    this.store = store;
    this.files = files;
    this.submissions = submissions;
    this.projection = projection;
    this.review = review;
    this.operations = operations;
    this.member = member;
    this.catalog = catalog;
    this.accounts = accounts;
    this.education = education;
  }

  @GetMapping("/health")
  public ResponseEntity<?> health() {
    if (!schema.ready()) return ResponseEntity.status(503).body(m("status", "starting"));
    store.db().queryForObject("SELECT 1", Integer.class);
    return ResponseEntity.ok(m("status", "ok", "schemaVersion", JfSchema.VERSION));
  }

  @PostMapping("/auth/login")
  public Object login(@RequestBody Map<String, Object> input, HttpServletRequest request) {
    return auth.login(input, request.getRemoteAddr());
  }

  @GetMapping("/auth/me")
  public Object me() {
    return auth.require().dto();
  }

  @PostMapping("/auth/logout")
  public Object logout() {
    auth.require();
    StpUtil.logout();
    return m("ok", true);
  }

  @PostMapping("/auth/wechat")
  public Object wechat() {
    throw error(503, "WECHAT_NOT_CONFIGURED", "微信登录适配尚未配置，请使用开发测试账号");
  }

  @GetMapping("/workspace")
  public Object workspace() {
    return projection.member(auth.optional());
  }

  @GetMapping("/admin/workspace")
  public Object adminWorkspace() {
    return projection.admin(auth.admin());
  }

  @GetMapping("/me/draft")
  public ResponseEntity<?> draft() {
    return draftResponse(submissions.getDraft());
  }

  @PutMapping("/me/draft")
  public ResponseEntity<?> saveDraft(
      @RequestBody Map<String, Object> data,
      @RequestHeader(value = "If-Match", required = false) String version) {
    return draftResponse(submissions.saveDraft(data, version));
  }

  @DeleteMapping("/me/draft")
  public ResponseEntity<?> removeDraft(
      @RequestHeader(value = "If-Match", required = false) String version) {
    return draftResponse(submissions.saveDraft(null, version));
  }

  private ResponseEntity<?> draftResponse(JfSubmissions.Draft d) {
    return ResponseEntity.ok().eTag(Long.toString(d.version())).body(m("draft", d.data()));
  }

  @PostMapping(value = "/files", consumes = "multipart/form-data")
  public Object upload(
      @RequestPart("file") MultipartFile file,
      @RequestParam(defaultValue = "manuscript") String purpose)
      throws Exception {
    return files.upload(file, purpose);
  }

  @GetMapping("/files/{id}/public")
  public ResponseEntity<Void> publicAsset(@PathVariable String id) {
    require(catalog.publicAssetAllowed(id), 404, "NOT_FOUND", "公开资源不存在或已下架");
    return ResponseEntity.status(302)
        .header("Cache-Control", "no-store")
        .location(java.net.URI.create(str(files.publicDownload(id), "url")))
        .build();
  }

  @GetMapping({"/files/{id}/download", "/files/{id}/url"})
  public Object download(@PathVariable String id) {
    return files.download(id);
  }

  @PostMapping("/submissions")
  public Object submit(
      @RequestBody Map<String, Object> data,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return submissions.submit(data, null, key, null);
  }

  @PostMapping("/submissions/{id}/revisions")
  public Object resubmit(
      @PathVariable String id,
      @RequestBody Map<String, Object> data,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = "If-Match", required = false) String version) {
    return submissions.submit(data, id, key, version);
  }

  @GetMapping("/submissions/{id}/progress")
  public Object progress(@PathVariable String id) {
    return submissions.progress(id);
  }

  @PostMapping("/admin/commands")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object adminCommand(
      @RequestBody Map<String, Object> input,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = "X-Workspace-Mode", required = false) String workspaceMode) {
    var actor = auth.admin();
    String command = required(input, "command", 1, 80), entityId = str(input, "entityId");
    JfAccess.authorizeCommand(actor, command);
    require(
        command.equals("submitReview") ? actor.roles.contains("expert")
            : command.equals("markReviewAlertRead")
                ? actor.operator() || actor.roles.contains("expert") : actor.operator(),
        403,
        "FORBIDDEN",
        "当前岗位无权执行该操作");
    if (Set.of("configureReviewFlow", "savePlatformConfig", "saveUserRoles", "saveHomepageConfig")
        .contains(command)) require(actor.national(), 403, "FORBIDDEN", "仅全国管理员可执行该操作");
    Object result =
        store.idempotent(
            actor,
            "admin:" + command,
            key,
            input,
            () -> {
              var data = obj(input.get("data"));
              Object outcome =
                  Set.of("saveUserRoles", "toggleUser", "approveUser").contains(command)
                      ? accounts.legacyCommand(actor, command, entityId, input.get("version"), data)
                      : JfEducation.ADMIN_COMMANDS.contains(command)
                      ? education.adminCommand(actor, command, entityId, input.get("version"), data)
                      : JfCatalog.ADMIN_COMMANDS.contains(command)
                      ? catalog.adminCommand(actor, command, entityId, input.get("version"), data)
                      : REVIEW_COMMANDS.contains(command)
                          ? review.command(actor, command, entityId, input.get("version"), data)
                          : operations.command(
                              actor, command, entityId, input.get("version"), data);
              store.audit(
                  actor, command, entityId, actor.regions.stream().findFirst().orElse("all"), m());
              return outcome;
            });
    // Rebuild under current authorization even on a replay; do not cache workspace permissions.
    if (JfCatalog.ADMIN_COMMANDS.contains(command))
      catalog.authorizeAdminResult(actor, command, result);
    operations.authorizeResult(actor, command, entityId, result);
    return "compact".equals(workspaceMode)
        ? m("result", result, "permissions", actor.permissions(), "roles", actor.roles)
        : m("result", result, "workspace", projection.admin(actor));
  }

  @PostMapping("/commands")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object memberCommand(
      @RequestBody Map<String, Object> input,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    var actor = auth.require();
    String command = required(input, "command", 1, 80), entityId = str(input, "entityId");
    if(command.equals("course.progress"))education.authorizeMemberCommand(actor,command,entityId,obj(input.get("data")));
    Object result =
        store.idempotent(
            actor,
            "member:" + command,
            key,
            input,
            () -> {
              Object outcome =
                  command.equals("course.progress")
                      ? education.progress(actor, entityId, obj(input.get("data")))
                      : JfCatalog.MEMBER_COMMANDS.contains(command)
                      ? catalog.memberCommand(
                          actor, command, entityId, input.get("version"), obj(input.get("data")))
                      : member.command(
                          actor, command, entityId, input.get("version"), obj(input.get("data")));
              store.audit(
                  actor, command, entityId, actor.regions.stream().findFirst().orElse("all"), m());
              return outcome;
            });
    return m("result", result, "workspace", projection.member(actor));
  }
}
