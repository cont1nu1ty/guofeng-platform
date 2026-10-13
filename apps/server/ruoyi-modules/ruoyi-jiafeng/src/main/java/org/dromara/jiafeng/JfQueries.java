package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Bounded SQL reads shared by lists, statistics and immutable export snapshots. */
@Service
public class JfQueries {
  public record Resource(String kind, String permission) {}
  public static final Map<String, Resource> RESOURCES = Map.ofEntries(
      Map.entry("submissions", new Resource("submission", "submissions:read")),
      Map.entry("tasks", new Resource("task", "reviews:read")),
      Map.entry("experts", new Resource("expert", "experts:read")),
      Map.entry("contents", new Resource("content", "content:read")),
      Map.entry("collections", new Resource("collection", "collections:read")),
      Map.entry("activities", new Resource("activity", "activities:read")),
      Map.entry("products", new Resource("product", "welfare:read")),
      Map.entry("welfareClaims", new Resource("claim", "welfare:read")),
      Map.entry("courses", new Resource("course", "education:read")),
      Map.entry("banners", new Resource("banner", "content:read")),
      Map.entry("mediaItems", new Resource("media", "content:read")),
      Map.entry("venues", new Resource("venue", "content:read")),
      Map.entry("hallPeople", new Resource("hallPerson", "content:read")),
      Map.entry("supportTickets", new Resource("supportTicket", "consultations:read")),
      Map.entry("notificationDrafts", new Resource("notice", "notifications:read")),
      Map.entry("activityLog",new Resource("audit","audit:read")),
      Map.entry("dictionaryWords", new Resource("dictionary", "ai:read")),
      Map.entry("knowledgeBases", new Resource("knowledge", "ai:read")),
      Map.entry("aiRecords", new Resource("aiLog", "ai:read")));
  private final JfStore store;
  private final JfProjection projection;
  private final JfReviewWindows windows;
  public JfQueries(JfStore store, JfProjection projection, JfReviewWindows windows) {
    this.store = store; this.projection = projection; this.windows = windows;
  }

  public record Filter(String sql, List<Object> args) {}
  public static Filter filter(JfAuth.Actor actor, String kind, String region, String q, String status) {
    List<Object> args = new ArrayList<>();
    String sql = "1=1";
    if (!actor.national()) {
      if (actor.operator()) {
        if (actor.regions.isEmpty()) sql += " AND 1=0";
        else { sql += " AND region_id IN (" + String.join(",", Collections.nCopies(actor.regions.size(), "?")) + ")"; args.addAll(actor.regions); }
      } else if (kind.equals("task") && actor.roles.contains("expert")) {
        sql += " AND owner_id=? AND status<>'已取消'"; args.add(actor.id);
      } else sql += " AND 1=0";
    }
    if (region != null && !region.isBlank() && !region.equals("all") && !region.equals("全国")) {
      sql += " AND region_id=?"; args.add(Jf.region(region));
    }
    if (status != null && !status.isBlank()) {
      if(kind.equals("submission")) status=Map.of("待初审","pending_initial_review","评审中","in_review","退回修改","returned","已入围","shortlisted","已获奖","awarded","已入藏","collected","未入围","rejected").getOrDefault(status,status);
      sql += " AND status=?"; args.add(status);
    }
    if (q != null && !q.isBlank()) {
      require(q.length() <= 150, 422, "INVALID_QUERY", "搜索文字过长");
      // Literal search: '%' and '_' are user text, not implicit wildcard operators.
      sql += " AND (LOCATE(?,id)>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')),''))>0"
          + " OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.name')),''))>0)";
      args.add(q.trim()); args.add(q.trim()); args.add(q.trim());
    }
    return new Filter(sql, args);
  }

  public Resource resource(JfAuth.Actor actor, String collection) {
    var resource = RESOURCES.get(collection);
    require(resource != null, 404, "NOT_FOUND", "数据目录不存在");
    JfAccess.require(actor, resource.permission());
    return resource;
  }

  public Map<String, Object> page(JfAuth.Actor actor, String collection, int page, int pageSize, String q, String status, String region) {
    require(page >= 1 && page <= 100000 && pageSize >= 1 && pageSize <= 100, 422, "INVALID_PAGE", "分页参数无效");
    var resource = resource(actor, collection);
    if(collection.equals("activityLog"))return auditPage(actor,page,pageSize,q,region);
    var filter = filter(actor, resource.kind(), region, q, status);
    List<Object> args = new ArrayList<>(); args.add(resource.kind()); args.addAll(filter.args());
    Long total = store.db().queryForObject("SELECT COUNT(*) FROM jf_entity WHERE kind=? AND (" + filter.sql() + ")", Long.class, args.toArray());
    var items = store.page(resource.kind(), filter.sql(), filter.args(), (page - 1) * pageSize, pageSize)
        .stream().map(e -> dto(actor, e)).toList();
    return m("items", items, "total", total, "page", page, "pageSize", pageSize, "collection", collection, "asOf", now());
  }

  public Map<String, Object> detail(JfAuth.Actor actor, String collection, String id) {
    var r = resource(actor, collection);
    var f = filter(actor, r.kind(), "", "", "");
    var args = new ArrayList<>(f.args()); args.add(id);
    var rows = store.page(r.kind(), f.sql() + " AND id=?", args, 0, 1);
    require(!rows.isEmpty(), 404, "NOT_FOUND", "记录不存在或不可见");
    return dto(actor, rows.getFirst());
  }

  public Map<String, Object> dto(JfAuth.Actor actor, JfStore.Entity e) {
    var d = e.kind().equals("submission") ? projection.adminWork(e) : store.dto(e);
    if (e.kind().equals("task")) {
      d.putAll(windows.projection(e, actor));
      if (!actor.operator()) { d.remove("windowHistory"); d.remove("managerId"); d.remove("expertName"); }
    }
    if (e.kind().equals("activity")) {
      d.put("registrations",List.of());
      var counts=store.db().queryForMap("SELECT COUNT(*) registrationCount,COALESCE(SUM(checked_in),0) checkedInCount FROM jf_registration WHERE activity_id=? AND status='registered'",e.id());
      counts.replaceAll((key,value)->number(value));
      d.putAll(counts);
    }
    if (e.kind().equals("claim")) d.put("date", e.createdAt().substring(0, 10));
    if (e.kind().equals("notice")) d.put("status", e.status().equals("published") ? "已发送" : "草稿");
    return d;
  }

  public Map<String, Object> bootstrap(JfAuth.Actor actor) {
    Map<String, Object> out = m("permissions", actor.permissions(), "roles", actor.roles, "serverNow", now());
    if (JfAccess.can(actor, "reviews:read")) {
      out.put("reviewFlow", store.dto(store.find("setting", "reviewFlow", false)));
      out.put("scoringDimensions", DIMENSIONS);
    }
    if (JfAccess.can(actor, "settings:read")) out.put("platformConfig", store.dto(store.find("setting", "platformConfig", false)));
    if (JfAccess.can(actor, "content:read")) out.put("homepageConfig", store.dto(store.find("setting", "homepageConfig", false)));
    return out;
  }
  public Object collectionCandidates(JfAuth.Actor actor,String q,String region){
    JfAccess.require(actor,"collections:write");
    var f=filter(actor,"submission",region,q,"");
    return m("items",store.page("submission",f.sql()+" AND status IN ('shortlisted','awarded','collected') AND JSON_EXTRACT(payload,'$.published')=TRUE",f.args(),0,100).stream().map(e->m("id",e.id(),"title",str(e.data(),"title"),"region",regionName(e.region()))).toList(),"limit",100);
  }
  public Object registrations(JfAuth.Actor actor,String id,int page,int size,String q,String status){
    JfAccess.require(actor,"activities:read");detail(actor,"activities",id);
    require(page>=1&&page<=100000&&size>=1&&size<=100&&q.length()<=100,422,"INVALID_PAGE","分页或搜索参数无效");
    require(Set.of("","checked","pending").contains(status),422,"INVALID_STATUS","签到筛选无效");
    String where=" WHERE r.activity_id=? AND r.status='registered'";var args=new ArrayList<Object>();args.add(id);
    if(!q.isBlank()){where+=" AND (LOCATE(?,u.nick_name)>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.profile,'$.organization')),''))>0)";args.add(q);args.add(q);}
    if(!status.isBlank()){where+=" AND r.checked_in=?";args.add(status.equals("checked"));}
    String from=" FROM jf_registration r JOIN sys_user u ON u.user_id=r.user_id JOIN jf_account a ON a.user_id=r.user_id";
    Long total=store.db().queryForObject("SELECT COUNT(*)"+from+where,Long.class,args.toArray());args.add(size);args.add((page-1)*size);
    var rows=store.db().queryForList("SELECT r.id,CAST(r.user_id AS CHAR) userId,u.nick_name name,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.profile,'$.organization')),'') institution,r.checked_in checkedIn,r.version lockVersion"+from+where+" ORDER BY r.created_at,r.id LIMIT ? OFFSET ?",args.toArray());
    return m("items",rows,"total",total,"page",page,"pageSize",size);
  }
  public Map<String,Object> auditPage(JfAuth.Actor actor,int page,int size,String q,String region){
    JfAccess.require(actor,"audit:read");require(q.length()<=100,422,"INVALID_QUERY","搜索文字过长");
    var filter=filter(actor,"audit",region,"","");String where=" WHERE ("+filter.sql()+") AND action NOT LIKE 'recitation.%' AND action NOT LIKE 'familyPromise.%'";var args=new ArrayList<>(filter.args());
    if(!q.isBlank()){where+=" AND (LOCATE(?,action)>0 OR LOCATE(?,target_id)>0)";args.add(q);args.add(q);}
    Long total=store.db().queryForObject("SELECT COUNT(*) FROM jf_audit"+where,Long.class,args.toArray());args.add(size);args.add((page-1)*size);
    var rows=store.db().queryForList("SELECT id,action,target_id target,created_at time,(SELECT nick_name FROM sys_user WHERE user_id=jf_audit.actor_id) actor FROM jf_audit"+where+" ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",args.toArray());
    rows.forEach(r->r.put("time",timestamp(r.get("time"))));return m("items",rows,"total",total,"page",page,"pageSize",size,"collection","activityLog");
  }

  public Map<String, Object> statistics(JfAuth.Actor actor, String region) {
    return statistics(actor, region, "", "");
  }
  public Map<String, Object> statistics(JfAuth.Actor actor, String region, String from, String to) {
    JfAccess.require(actor, "analytics:read");
    var f = filter(actor, "submission", region, "", "");
    if (!from.isBlank() || !to.isBlank()) {
      try {
        var start = java.time.LocalDate.parse(from); var end = java.time.LocalDate.parse(to);
        require(start.isBefore(end) && start.plusYears(20).isAfter(end),422,"INVALID_PERIOD","统计起止日期无效");
        var bounded = new ArrayList<>(f.args());
        bounded.add(java.sql.Timestamp.from(start.atStartOfDay(java.time.ZoneId.of("Asia/Shanghai")).toInstant()));
        bounded.add(java.sql.Timestamp.from(end.atStartOfDay(java.time.ZoneId.of("Asia/Shanghai")).toInstant()));
        f = new Filter(f.sql()+" AND created_at>=? AND created_at<?", bounded);
      } catch(java.time.DateTimeException invalid) {throw error(422,"INVALID_PERIOD","统计日期使用YYYY-MM-DD");}
    }
    List<Object> args = new ArrayList<>(f.args());
    var totals = store.db().queryForMap("SELECT COUNT(*) submissions,COUNT(DISTINCT owner_id) participants,"
        + "COALESCE(SUM(status='in_review'),0) reviewing,COALESCE(SUM(status IN ('shortlisted','awarded','collected')),0) selected "
        + "FROM jf_entity WHERE kind='submission' AND (" + f.sql() + ")", args.toArray());
    totals.replaceAll((key,value)->number(value));
    var trend = store.db().queryForList("SELECT DATE_FORMAT(created_at,'%Y-%m-%d') date,COUNT(*) submitted "
        + "FROM jf_entity WHERE kind='submission' AND (" + f.sql() + ") GROUP BY date ORDER BY date DESC LIMIT 90", args.toArray());
    var regions = store.db().queryForList("SELECT region_id regionId,COUNT(*) works,COALESCE(SUM(status='in_review'),0) reviewing,"
        + "COALESCE(SUM(status IN ('shortlisted','awarded','collected')),0) selected FROM jf_entity WHERE kind='submission' AND ("
        + f.sql() + ") GROUP BY region_id ORDER BY works DESC,region_id", args.toArray());
    regions.forEach(row -> {row.put("region", regionName(str(row, "regionId")));for(String key:List.of("works","reviewing","selected"))row.put(key,number(row.get(key)));});
    var statuses = store.db().queryForList("SELECT status,COUNT(*) total FROM jf_entity WHERE kind='submission' AND (" + f.sql() + ") GROUP BY status", args.toArray());
    var engagement=store.db().queryForMap("SELECT COALESCE(SUM(action='view'),0) signedInViews,COALESCE(SUM(action='share_intent'),0) shareIntents FROM jf_engagement WHERE ("+f.sql()+")",args.toArray());
    engagement.replaceAll((key,value)->number(value));
    return m("totals", totals, "trend", trend, "regions", regions, "statuses", statuses, "engagement",engagement,"engagementDefinition","登录账号对公开内容的访问与分享意向，按账号、内容、动作、北京时间日期去重；不包含匿名访问，分享意向不等于完成转发。","asOf", now(), "from",from,"to",to,"metricVersion", "submission-first-created-v1",
        "definition", "投稿量按稿件首次入库计数，不按修订数计；入选为当前入围、获奖、典藏状态。历史报告保留生成时快照。");
  }
}
