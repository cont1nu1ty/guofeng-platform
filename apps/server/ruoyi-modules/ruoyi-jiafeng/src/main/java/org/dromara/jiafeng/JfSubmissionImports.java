package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Text imports require explicit provenance, an existing recipient, and subsequent author consent. */
@Service
public class JfSubmissionImports {
  private final JfStore store; private final JfAuth auth; private final JfSubmissions submissions; private final JfRubrics rubrics;
  public JfSubmissionImports(JfStore store, JfAuth auth, JfSubmissions submissions, JfRubrics rubrics) {
    this.store = store; this.auth = auth; this.submissions = submissions; this.rubrics = rubrics;
  }
  public Map<String, Object> preview(JfAuth.Actor actor, Map<String, Object> input) {
    var rows = list(input.get("rows"));
    require(!rows.isEmpty() && rows.size() <= 100, 422, "INVALID_IMPORT", "每批导入1至100条文字稿件");
    var accepted = new ArrayList<Object>(); var errors = new ArrayList<Object>(); var sourceKeys = new HashSet<String>();
    for (int index = 0; index < rows.size(); index++) {
      var row = obj(rows.get(index));
      try {
        long ownerId = number(row.get("ownerId"));
        var owner = auth.byId(ownerId);
        require(owner.roles.contains("member"), 422, "INVALID_IMPORT_OWNER", "接收账号必须有投稿用户身份");
        var clean = submissions.validateOffline(row, owner);
        auth.operate(actor, str(clean, "region"));
        String sourceKey = hash(str(clean, "sourceName") + "\n" + str(clean, "sourceRef"));
        require(sourceKeys.add(sourceKey), 422, "DUPLICATE_IMPORT_SOURCE", "本批次来源名称和来源编号重复");
        require(store.db().queryForObject("SELECT COUNT(*) FROM jf_submission_import WHERE source_key=?", Long.class, sourceKey) == 0,
            409, "DUPLICATE_IMPORT_SOURCE", "该来源编号已归集");
        accepted.add(m("row", index + 1, "ownerId", ownerId, "ownerName", owner.name, "ownerVersion", owner.version,
            "sourceKey", sourceKey, "data", clean));
      } catch (ApiException failure) {
        errors.add(m("row", index + 1, "code", failure.code, "message", failure.status == 401 || failure.status == 404 ? "账号、地区或记录不可访问" : failure.getMessage()));
      }
    }
    var fingerprint = hash(json(m("actor", actor.id, "accepted", accepted, "errors", errors)));
    return m("rows", accepted, "errors", errors, "fingerprint", fingerprint,
        "notice", "导入不代替本人同意；确认后发送站内提醒，所属账号核对正文并确认声明后方可初审。");
  }
  public Object confirm(JfAuth.Actor actor, Map<String, Object> input) {
    var preview = preview(actor, input);
    require(str(preview, "fingerprint").equals(str(input, "fingerprint")), 409, "IMPORT_PREVIEW_STALE", "导入数据或账号已变化，请重新预检");
    require(list(preview.get("errors")).isEmpty(), 422, "IMPORT_HAS_ERRORS", "请修复全部预检错误后再确认");
    var config = JfRubrics.snapshot(store.find("setting", "reviewFlow", true).data());
    var imported = new ArrayList<Object>();
    for (Object value : list(preview.get("rows"))) {
      var row = obj(value); var d = copy(obj(row.get("data"))); long owner = number(row.get("ownerId"));
      String revisionId = id("rev_");
      d.putAll(m("revisionNumber", 1, "revisionId", revisionId, "progressIndex", 0, "decision", "undecided",
          "published", false, "submittedAt", now(), "flowSnapshot", config, "importedBy", actor.id,
          "reviews", List.of(), "history", List.of(m("time", now(), "action", "线下归集", "note", "等待所属账号核对及确认", "revision", 1))));
      var work = store.create("submission", owner, str(d, "region"), "pending_initial_review", d);
      store.db().update("INSERT INTO jf_revision(id,submission_id,revision_number,payload) VALUES(?,?,1,?)", revisionId, work.id(), json(d));
      store.db().update("INSERT INTO jf_submission_import(source_key,submission_id,revision_id,imported_by) VALUES(?,?,?,?)",
          row.get("sourceKey"), work.id(), revisionId, actor.id);
      rubrics.bind(revisionId, config, "offline_import");
      store.notifyUser(owner, work.region(), "请核对线下归集稿件", "《" + str(d, "title") + "》已归集至您的账号。请在进度页核对正文并确认投稿声明；确认前不会进入评审。", work.id());
      store.audit(actor, "submission.import", work.id(), work.region(), m("sourceRef", d.get("sourceRef"), "sourceName", d.get("sourceName"), "revisionId", revisionId, "ownerId", owner));
      imported.add(m("id", work.id(), "revisionId", revisionId));
    }
    return m("ok", true, "imported", imported);
  }
}
