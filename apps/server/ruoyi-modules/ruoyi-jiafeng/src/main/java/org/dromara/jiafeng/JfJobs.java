package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.zip.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class JfJobs {
  private final JfStore store;
  private final JfAuth auth;
  private final JfQueries queries;
  private final JfFiles files;
  private final JfSchema schema;
  private final TransactionTemplate tx;
  private final java.util.concurrent.ScheduledExecutorService heartbeats=java.util.concurrent.Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"jiafeng-export-heartbeat");t.setDaemon(true);return t;});
  @jakarta.annotation.PreDestroy public void close(){heartbeats.shutdownNow();}
  public JfJobs(JfStore store, JfAuth auth, JfQueries queries, JfFiles files, JfSchema schema, PlatformTransactionManager manager) {
    this.store=store; this.auth=auth; this.queries=queries; this.files=files; this.schema=schema; this.tx=new TransactionTemplate(manager);
  }
  static String exportPermission(String kind, String collection) {
    if (kind.equals("report")) return "analytics:export";
    if (kind.equals("collection")) return "collections:export";
    return collection.equals("submissions") ? "submissions:export" : "jobs:export";
  }
  @Transactional(isolation=Isolation.REPEATABLE_READ)
  public Object create(JfAuth.Actor actor, Map<String,Object> input, String key) {
    String kind=str(input,"kind");
    require(Set.of("csv","collection","report").contains(kind),422,"INVALID_EXPORT","请选择导出类型");
    String collection=str(input,"collection"), permission=exportPermission(kind,collection);
    JfAccess.require(actor, permission);
    requireReadPermission(actor, kind, collection);
    return store.idempotent(actor,"export.create",key,input,()-> {
      Map<String,Object> snapshot=m("asOf",now(),"metricVersion","submission-first-created-v1","scope",new ArrayList<>(actor.regions));
      String region=str(input,"region");
      if (kind.equals("csv")) {
        require(!collection.equals("activityLog"),422,"UNSUPPORTED_EXPORT","审计日志暂不提供通用业务CSV导出");
        var first=queries.page(actor,collection,1,100,str(input,"q"),str(input,"status"),region);
        require(number(first.get("total"))<=5000,422,"EXPORT_LIMIT","每次最多导出5000条，请缩小筛选范围");
        List<Object> rows=new ArrayList<>(list(first.get("items")));
        for(int page=2;rows.size()<number(first.get("total"));page++)
          rows.addAll(list(queries.page(actor,collection,page,100,str(input,"q"),str(input,"status"),region).get("items")));
        // Freeze the authorized result, not just an updated_at watermark.
        snapshot.put("rows", rows.stream().map(value->{var r=obj(value);return m("id",r.get("id"),"title",r.getOrDefault("title",r.get("name")),"region",r.get("region"),"status",r.get("status"),"version",r.get("lockVersion"),"createdAt",r.get("createdAt"));}).toList());
      } else if(kind.equals("collection")) {
        var ids=list(input.get("ids"));require(!ids.isEmpty()&&ids.size()<=20,422,"EXPORT_LIMIT","请选择1至20卷");
        String format=str(input,"format"); require(Set.of("pdf","docx").contains(format),422,"INVALID_FORMAT","请选择PDF或Word格式");
        snapshot.put("volumes",ids.stream().distinct().map(v->queries.detail(actor,"collections",text(v))).toList());
      } else snapshot.put("statistics",queries.statistics(actor,region,str(input,"from"),str(input,"to")));
      String job=id("job_");
      store.db().update("INSERT INTO jf_job(id,owner_id,region_id,kind,permission_key,status,request,snapshot) VALUES(?,?,?,?,?,'queued',?,?)",
          job,actor.id,region.isBlank()?actor.regions.stream().findFirst().orElse("all"):Jf.region(region),kind,permission,json(input),json(snapshot));
      store.audit(actor,"export.create",job,actor.regions.stream().findFirst().orElse("all"),m("kind",kind,"asOf",snapshot.get("asOf")));
      return m("id",job,"status","queued");
    });
  }
  public Map<String,Object> listJobs(JfAuth.Actor actor,int page,int size) {
    require(page>=1&&size>=1&&size<=100,422,"INVALID_PAGE","分页参数无效");
    var rows=store.db().queryForList("SELECT * FROM jf_job WHERE owner_id=? ORDER BY created_at DESC,id LIMIT ? OFFSET ?",actor.id,size,(page-1)*size);
    return m("items",rows.stream().map(this::dto).toList(),"total",store.db().queryForObject("SELECT COUNT(*) FROM jf_job WHERE owner_id=?",Long.class,actor.id),"page",page,"pageSize",size);
  }
  private void requireReadPermission(JfAuth.Actor actor, String kind, String collection) {
    if (kind.equals("csv")) queries.resource(actor, collection);
    else if (kind.equals("collection")) JfAccess.require(actor, "collections:read");
    else if (kind.equals("report")) JfAccess.require(actor, "analytics:read");
  }
  private Map<String,Object> owned(JfAuth.Actor actor,String id) {
    var rows=store.db().queryForList("SELECT * FROM jf_job WHERE id=? AND owner_id=?",id,actor.id);
    require(!rows.isEmpty(),404,"NOT_FOUND","任务不存在或不可见");
    var row=rows.getFirst();JfAccess.require(actor,str(row,"permission_key"));
    var snapshot=parse(text(row.get("snapshot")));
    require(actor.national()||list(snapshot.get("scope")).stream().allMatch(x->actor.region(text(x))),403,"SCOPE_CHANGED","授权范围已变更，请重新创建导出");
    var input=parse(text(row.get("request")));
    String kind = str(row,"kind");
    requireReadPermission(actor,kind,str(input,"collection"));
    if (kind.equals("collection")) {
      // Frozen text does not grant access to a volume transferred outside current scope.
      for (Object volume : list(snapshot.get("volumes")))
        queries.detail(actor,"collections",str(obj(volume),"id"));
    }
    return row;
  }
  private Map<String,Object> dto(Map<String,Object> row) {
    return m("id",row.get("id"),"kind",row.get("kind"),"status",row.get("status"),"attempts",row.get("attempts"),"errorCode",row.get("error_code"),
        "createdAt",timestamp(row.get("created_at")),"updatedAt",timestamp(row.get("updated_at")),"request",parse(text(row.get("request"))),
        "result",row.get("result")==null?m():parse(text(row.get("result"))));
  }
  @Transactional public Object action(JfAuth.Actor actor,String id,String action) {
    store.db().queryForList("SELECT id FROM jf_job WHERE id=? AND owner_id=? FOR UPDATE",id,actor.id);
    var row=owned(actor,id);String status=str(row,"status");
    if(action.equals("cancel")) {
      require(Set.of("queued","running","failed").contains(status),409,"JOB_FINISHED","任务已结束");
      store.db().update("UPDATE jf_job SET status='cancelled',generation=generation+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",id);
    } else if(action.equals("retry")) {
      require(status.equals("failed"),409,"JOB_NOT_FAILED","只有失败任务可以重试");
      store.db().update("UPDATE jf_job SET status='queued',attempts=0,generation=generation+1,error_code=NULL,available_at=CURRENT_TIMESTAMP(3),updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",id);
    } else throw error(422,"INVALID_ACTION","不支持的任务操作");
    store.audit(actor,"export."+action,id,str(row,"region_id"),m());return m("ok",true);
  }
  public Object download(JfAuth.Actor actor,String id) {
    var row=owned(actor,id);require(str(row,"status").equals("completed"),409,"NOT_READY","文件尚未生成");
    if(!str(row,"kind").equals("report")) require(Instant.parse(timestamp(row.get("created_at"))).plus(Duration.ofDays(7)).isAfter(Instant.now()),410,"EXPORT_EXPIRED","临时导出已过期，请重新生成");
    var result=parse(text(row.get("result")));store.audit(actor,"export.download",id,str(row,"region_id"),m("fileId",result.get("fileId")));
    return files.publicDownload(str(result,"fileId"));
  }
  @Scheduled(initialDelay=20000,fixedDelay=3000)
  public void run() {
    if(!schema.ready())return;
    Map<String,Object> job;
    try {
      job=tx.execute(status->{
        var rows=store.db().queryForList("SELECT * FROM jf_job WHERE (status='queued' AND available_at<=CURRENT_TIMESTAMP(3)) OR (status='running' AND lease_until<CURRENT_TIMESTAMP(3)) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
        if(rows.isEmpty())return null;
        var row=rows.getFirst();
        if(number(row.get("attempts"))>=3){store.db().update("UPDATE jf_job SET status='failed',error_code='ATTEMPTS_EXHAUSTED',updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",row.get("id"));return null;}
        store.db().update("UPDATE jf_job SET status='running',attempts=attempts+1,generation=generation+1,lease_until=TIMESTAMPADD(MINUTE,5,CURRENT_TIMESTAMP(3)),updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",row.get("id"));
        row.put("generation",number(row.get("generation"))+1);row.put("attempts",number(row.get("attempts"))+1);return row;
      });
    }catch(RuntimeException unavailable){return;}
    if(job==null)return;
    String id=str(job,"id");long generation=number(job.get("generation"));
    var heartbeat=heartbeats.scheduleAtFixedRate(()->{try{store.db().update("UPDATE jf_job SET lease_until=TIMESTAMPADD(MINUTE,5,CURRENT_TIMESTAMP(3)) WHERE id=? AND generation=? AND status='running'",id,generation);}catch(RuntimeException ignored){}},30,30,java.util.concurrent.TimeUnit.SECONDS);
    try {
      var actor=auth.byId(number(job.get("owner_id")));owned(actor,id);
      var snapshot=parse(text(job.get("snapshot")));var input=parse(text(job.get("request")));
      String kind=str(job,"kind"),format=str(input,"format"),name,mime;byte[] bytes;
      if(kind.equals("csv")){bytes=csv(list(snapshot.get("rows"))).getBytes(StandardCharsets.UTF_8);name="业务导出.csv";mime="text/csv;charset=utf-8";}
      else if(kind.equals("report")) {bytes=JfDocuments.render("家风业务统计报告",reportParagraphs(snapshot),"pdf");name="业务统计报告.pdf";mime="application/pdf";}
      else {
        var volumes=list(snapshot.get("volumes"));
        if(volumes.size()==1){var volume=obj(volumes.getFirst());bytes=JfDocuments.render(str(volume,"title"),volumeParagraphs(volume,snapshot),format);name=safeName(str(volume,"title"))+"."+format;mime=JfDocuments.mime(format);}
        else{var out=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(out)){int i=0;for(var value:volumes){var volume=obj(value);zip.putNextEntry(new ZipEntry((++i)+"-"+safeName(str(volume,"title"))+"."+format));zip.write(JfDocuments.render(str(volume,"title"),volumeParagraphs(volume,snapshot),format));zip.closeEntry();}}bytes=out.toByteArray();name="典籍批量导出.zip";mime="application/zip";}
      }
      // Recheck before upload and before publishing, after potentially slow rendering.
      owned(auth.byId(actor.id),id);
      var file=files.generated(actor.id,str(job,"region_id"),name,mime,bytes);
      tx.executeWithoutResult(status->{
        owned(auth.byId(actor.id),id);
        store.db().update("UPDATE jf_job SET status='completed',result=?,error_code=NULL,updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND generation=? AND status='running'",json(file),id,generation);
      });
    }catch(Exception failure){
      try{store.db().update("UPDATE jf_job SET status=?,error_code=?,available_at=TIMESTAMPADD(SECOND,?,CURRENT_TIMESTAMP(3)),updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND generation=? AND status='running'",
          number(job.get("attempts"))>=3?"failed":"queued",failure instanceof ApiException e?e.code:failure.getClass().getSimpleName(),60*number(job.get("attempts")),id,generation);}catch(RuntimeException ignored){}
    }finally{heartbeat.cancel(false);}
  }
  static String safeName(String name){return name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","-").substring(0,Math.min(name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","-").length(),70));}
  static String csvCell(Object value){String s=text(value);if(s.stripLeading().matches("(?s)^[=+@-].*"))s="'"+s;return "\""+s.replace("\"","\"\"")+"\"";}
  static String csv(List<Object> rows){var b=new StringBuilder("\uFEFF编号,标题,地区,状态,版本,创建时间\r\n");for(var value:rows){var r=obj(value);b.append(String.join(",",List.of("id","title","region","status","version","createdAt").stream().map(k->csvCell(r.get(k))).toList())).append("\r\n");}return b.toString();}
  static List<String> volumeParagraphs(Map<String,Object> volume,Map<String,Object> snapshot){var p=new ArrayList<String>();p.add("来源版本："+volume.get("lockVersion")+" · 导出时间："+snapshot.get("asOf"));p.add(str(volume,"description"));p.add("目录");for(var c:list(volume.get("chapters")))p.add(str(obj(c),"title"));for(var c:list(volume.get("chapters"))){var chapter=obj(c);p.add("\n"+str(chapter,"title"));p.add(str(chapter,"author"));p.add(str(chapter,"body").isBlank()?str(chapter,"content"):str(chapter,"body"));}return p;}
  static List<String> reportParagraphs(Map<String,Object> snapshot){var s=obj(snapshot.get("statistics"));var p=new ArrayList<String>();p.add("统计截至："+JfDocuments.displayTime(text(snapshot.get("asOf"))));p.add(str(s,"from").isBlank()?"范围：全部历史入库稿件":"范围："+str(s,"from")+" 至 "+str(s,"to")+"（不含结束日）");p.add(str(s,"definition"));var engagement=obj(s.get("engagement"));p.add("登录访问记录："+engagement.getOrDefault("signedInViews",0)+"；分享意向："+engagement.getOrDefault("shareIntents",0));p.add(str(s,"engagementDefinition"));var totals=obj(s.get("totals"));p.add("投稿："+totals.get("submissions")+"；参与账号："+totals.get("participants")+"；评审中："+totals.get("reviewing")+"；入选："+totals.get("selected"));for(var row:list(s.get("regions"))){var r=obj(row);p.add(str(r,"region")+"："+r.get("works")+"篇");}return p;}
}
