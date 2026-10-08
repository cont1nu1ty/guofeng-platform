package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Explicit, attributable checkbox confirmation. It is not a signature or external copyright attestation. */
@Service
public class JfRights {
  public static final String AGREEMENT_VERSION = "jiafeng-confirmation-1";
  public static final String AGREEMENT_TEXT = "我已核对本次提交的作品正文及附件，确认具有提交和授权展示所需的权利；"
      + "如涉及他人作品、肖像或个人信息，已取得相应许可。平台可以在约定的征集、评审和公开展示范围内处理本作品。"
      + "本次操作仅记录本人对本版本投稿须知的确认，不构成电子签章、公证或版权登记；正式出版和超出本次范围的使用需另行取得授权。";
  private final JfStore store;
  public JfRights(JfStore store) { this.store = store; }

  public static Map<String,Object> agreement() {
    return m("version", AGREEMENT_VERSION, "text", AGREEMENT_TEXT, "hash", hash(AGREEMENT_TEXT), "signature", false);
  }

  public Object mine(JfAuth.Actor actor) {
    var confirmations = store.db().queryForList("SELECT id,submission_id AS submissionId,revision_id AS revisionId,agreement_version AS agreementVersion,"
        + "agreement_text AS agreementText,agreement_hash AS agreementHash,accepted_at AS acceptedAt FROM jf_copyright_confirmation "
        + "WHERE owner_id=? ORDER BY accepted_at DESC,id DESC LIMIT 200", actor.id);
    return m("items", confirmations, "agreement", agreement());
  }

  @Transactional
  public Object submit(JfAuth.Actor actor, String submission, Map<String,Object> input, String key) {
    require(Boolean.TRUE.equals(input.get("accepted")), 422, "AGREEMENT_REQUIRED", "请阅读并确认投稿须知");
    require(input.containsKey("version"), 428, "VERSION_REQUIRED", "缺少作品版本，请刷新");
    return store.idempotent(actor, "copyright.confirm:" + submission, key, input, () -> {
      var work = store.find("submission", submission, true);
      require(Objects.equals(work.owner(), actor.id), 404, "NOT_FOUND", "作品不存在或不属于本人");
      store.checkVersion(work, input.get("version"));
      return confirm(actor, submission, required(input, "revisionId", 1, 64), required(input, "agreementVersion", 1, 60));
    });
  }

  @Transactional
  public Object confirm(JfAuth.Actor actor, String submission, String revision, String agreementVersion) {
    var work = store.find("submission", submission, true);
    require(Objects.equals(work.owner(), actor.id), 404, "NOT_FOUND", "作品不存在或不属于本人");
    require(str(work.data(), "revisionId").equals(revision), 412, "REVISION_CHANGED", "作品版本已变更，请重新核对正文");
    require(AGREEMENT_VERSION.equals(agreementVersion), 412, "AGREEMENT_CHANGED", "投稿须知已更新，请重新阅读");
    var previous = store.db().queryForList("SELECT id,accepted_at FROM jf_copyright_confirmation WHERE submission_id=? AND revision_id=? AND agreement_version=?",
        submission, revision, agreementVersion);
    String id = previous.isEmpty() ? id("confirm_") : str(previous.getFirst(), "id");
    if (previous.isEmpty()) store.db().update("INSERT INTO jf_copyright_confirmation(id,owner_id,submission_id,revision_id,agreement_version,agreement_text,agreement_hash) VALUES(?,?,?,?,?,?,?)",
        id, actor.id, submission, revision, agreementVersion, AGREEMENT_TEXT, hash(AGREEMENT_TEXT));
    var data = copy(work.data());
    data.putAll(m("copyrightAccepted", true, "requiresAuthorConfirmation", false, "agreementVersion", agreementVersion,
        "agreementAcceptedAt", previous.isEmpty() ? now() : timestamp(previous.getFirst().get("accepted_at")), "confirmationId", id));
    var updated = store.save(work, work.region(), work.status(), data);
    store.audit(actor, "copyright.confirm", submission, work.region(), m("confirmationId", id, "revisionId", revision, "agreementVersion", agreementVersion));
    return m("ok", true, "id", id, "version", updated.version(), "signature", false);
  }
}
