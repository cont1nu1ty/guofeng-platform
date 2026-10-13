package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;

/** Public RAG is limited to published projections and explicitly public, current indexed files. */
@Service
public class JfAiKnowledge {
  static final int MAX_CONTEXTS = 12;
  private final JfStore store;
  private final JfSearch search;
  private final JfAuth auth;

  public JfAiKnowledge(JfStore store, JfSearch search, JfAuth auth) {
    this.store = store;
    this.search = search;
    this.auth = auth;
  }

  public long count() {
    return store.db().queryForObject("SELECT COUNT(DISTINCT c.document_id) FROM jf_ai_chunk c JOIN jf_entity e ON e.id=c.document_id AND e.version=c.source_version WHERE e.status='已索引' AND c.audience='public'", Long.class);
  }

  record Context(String id, String title, String text, String kind, String sourceId,
      long version, String url, String audience, String region) {
    Map<String, Object> wire() { return m("id", id, "title", title, "text", text); }
    Map<String, Object> source() { return m("id", id, "title", title, "excerpt", cut(text, 240),
        "kind", kind, "sourceId", sourceId, "version", version, "url", url,
        "audience", audience, "region", region); }
  }

  public List<Context> retrieve(JfAuth.Actor actor, String query, String language, boolean support) {
    List<Context> contexts = new ArrayList<>();
    if (support) contexts.add(new Context("platform-help-v1", "平台投稿、活动与人工咨询指引",
        "投稿：先登录，填写体裁、地区、主题和正文，可保存云草稿；确认授权后提交。退修：在个人中心我的投稿查看意见，选择修改重投，保留作品编号并新增版本。评审结果由管理员确认，AI不能保证获奖。活动：打开活动详情报名，名额由服务器控制；取消与签到按活动规则办理。人工帮助：在帮助与反馈中提交咨询，运营回复后可在咨询记录查看。账户私人稿件和家庭约定仅本人可读。AI不代表人工评审、签章或真实性认证。",
        "help", "platform-help-v1", 1, "", "public", "all"));
    for (var entity : search.retrieveForAi(query, language).stream().limit(6).toList()) {
      var doc = JfSearch.document(entity);
      if (doc == null) continue;
      contexts.add(new Context(str(doc, "id"), str(doc, "title"),
          cut(str(doc, "summary") + "\n" + str(doc, "body"), 5000), entity.kind(), entity.id(),
          entity.version(), "/#/pkg-content/pages/index?screen=" + str(doc, "screen") + "&id=" + entity.id(), "public", entity.region()));
    }
    String permissions = actor.operator() && JfAccess.can(actor, "ai:read") ? "(c.audience='public' OR c.audience='staff')" : "c.audience='public'";
    var chunks = store.db().queryForList("SELECT c.*, MATCH(c.title,c.body) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM jf_ai_chunk c JOIN jf_entity e ON e.id=c.document_id AND e.version=c.source_version WHERE e.status='已索引' AND c.language=? AND " + permissions + " AND MATCH(c.title,c.body) AGAINST (? IN NATURAL LANGUAGE MODE)>0 ORDER BY relevance DESC,c.id LIMIT 30", query, language, query);
    int added = 0;
    for (var chunk : chunks) {
      if (contexts.size() >= MAX_CONTEXTS) break;
      if (str(chunk, "audience").equals("staff")
          && !(actor.operator() && JfAccess.can(actor, "ai:read") && actor.region(str(chunk, "region_id")))) continue;
      contexts.add(new Context(str(chunk, "id"), str(chunk, "title"), str(chunk, "body"),
          "knowledge", str(chunk, "document_id"), number(chunk.get("source_version")), "",
          str(chunk, "audience"), str(chunk, "region_id")));
      if (++added == 6) break;
    }
    return contexts;
  }

  /** Rechecked both after generation and before every read; withdrawn text is not replayed. */
  boolean valid(JfAuth.Actor actor, List<Object> sources) {
    for (Object item : sources) {
      var source = obj(item);
      if (str(source, "kind").equals("help")) continue;
      try {
        var entity = store.find(str(source, "kind"), str(source, "sourceId"), false);
        if (entity.version() != number(source.get("version"))) return false;
        if (entity.kind().equals("knowledge")) {
          if (!entity.status().equals("已索引")) return false;
          if (!str(entity.data(), "audience").equals("public")
              && !(actor.operator() && JfAccess.can(actor, "ai:read") && actor.region(entity.region()))) return false;
        } else if (str(source, "audience").equals("staff")) {
          if (!(entity.kind().equals("submission") && actor.operator()
              && JfAccess.can(actor, "submissions:read") && actor.region(entity.region()))) return false;
        } else if (!JfSearch.publicEntity(entity)) return false;
      } catch (ApiException error) { return false; }
    }
    return true;
  }

  JfStore.Entity document(JfAuth.Actor actor, String id, Object version, boolean lock) {
    JfAccess.require(actor, "ai:write");
    var entity = store.find("knowledge", id, lock);
    auth.operate(actor, entity.region());
    store.checkVersion(entity, version);
    return entity;
  }

  void indexed(JfStore.Entity entity, String body, String audience, String language) {
    var chunks = split(body);
    require(!chunks.isEmpty(), 422, "EMPTY_DOCUMENT", "文件未提取到有效文本，请检查或使用清晰扫描件");
    var data = copy(entity.data());
    data.putAll(m("audience", audience, "indexStatus", "indexed", "chunkCount", chunks.size(),
        "indexedAt", now(), "language", language, "description", "资料已解析并建立可撤销的检索分块。"));
    var saved = store.save(entity, entity.region(), "已索引", data);
    store.db().update("DELETE FROM jf_ai_chunk WHERE document_id=?", entity.id());
    for (int i = 0; i < chunks.size(); i++)
      store.db().update("INSERT INTO jf_ai_chunk(id,document_id,source_version,audience,region_id,language,ordinal,title,body) VALUES(?,?,?,?,?,?,?,?,?)",
          entity.id() + "_" + i, entity.id(), saved.version(), audience, entity.region(), language,
          i, str(entity.data(), "title"), chunks.get(i));
  }

  static List<String> split(String text) {
    String body = text.replace('\u0000', ' ').trim();
    require(body.length() <= 500000, 422, "DOCUMENT_TOO_LONG", "资料文本超过50万字符，请拆分上传");
    List<String> chunks = new ArrayList<>();
    for (int start = 0; start < body.length();) {
      int end = Math.min(start + 1200, body.length());
      // Avoid splitting surrogate pairs, retain overlap for cross-boundary sentences.
      if (end < body.length() && Character.isHighSurrogate(body.charAt(end - 1))) end--;
      String chunk = body.substring(start, end).trim();
      if (!chunk.isBlank()) chunks.add(chunk);
      if (end == body.length()) break;
      start = end - 150;
      if (Character.isLowSurrogate(body.charAt(start))) start++;
    }
    return chunks;
  }

  static String cut(String text, int max) { return text.substring(0, Math.min(text.length(), max)); }
}
