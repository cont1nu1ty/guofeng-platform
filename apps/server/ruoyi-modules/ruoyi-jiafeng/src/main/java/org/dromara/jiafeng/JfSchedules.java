package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Opt-in summaries and reports. Queue and delivery keys survive process restarts. */
@Service
public class JfSchedules {
  private static final Logger LOG=LoggerFactory.getLogger(JfSchedules.class);
  private static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
  static Set<String> strings(Object value){
    if(value instanceof String s)return new LinkedHashSet<>(org.dromara.common.json.utils.JsonUtils.parseArray(s,String.class));
    return new LinkedHashSet<>(list(value).stream().map(Jf::text).toList());
  }
  private final JfStore store; private final JfAuth auth; private final JfJobs jobs; private final JfSchema schema; private final TransactionTemplate tx;
  public JfSchedules(JfStore store,JfAuth auth,JfJobs jobs,JfSchema schema,PlatformTransactionManager manager){this.store=store;this.auth=auth;this.jobs=jobs;this.schema=schema;tx=new TransactionTemplate(manager);}
  public Map<String,Object> preferences(JfAuth.Actor actor){
    var rows=store.db().queryForList("SELECT * FROM jf_delivery_preference WHERE owner_id=?",actor.id);
    if(rows.isEmpty())return m("digest","off","draftNotice",true,"reports",List.of());
    var r=rows.getFirst();return m("digest",r.get("digest"),"draftNotice",bool(r.get("draft_notice")),"reports",strings(r.get("reports")));
  }
  @Transactional public Object save(JfAuth.Actor actor,Map<String,Object> input){
    String digest=str(input,"digest"); require(Set.of("off","daily","weekly").contains(digest),422,"INVALID_PREFERENCE","摘要频率无效");
    var periods=list(input.get("reports")).stream().map(Jf::text).distinct().toList();
    require(Set.of("month","quarter","year").containsAll(periods),422,"INVALID_PREFERENCE","报告周期无效");
    if(!periods.isEmpty())JfAccess.require(actor,"analytics:export");
    store.db().update("INSERT INTO jf_delivery_preference(owner_id,digest,draft_notice,reports) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE digest=VALUES(digest),draft_notice=VALUES(draft_notice),reports=VALUES(reports),updated_at=CURRENT_TIMESTAMP(3)",actor.id,digest,bool(input.get("draftNotice")),json(periods));
    store.audit(actor,"delivery.preferences",Long.toString(actor.id),actor.regions.stream().findFirst().orElse("all"),m("digest",digest,"reports",periods));return preferences(actor);
  }
  record Period(LocalDate from,LocalDate to,String key){}
  static Period previous(String frequency,LocalDate today){
    LocalDate to=switch(frequency){case "daily"->today;case "weekly"->today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));case "month"->today.withDayOfMonth(1);case "quarter"->LocalDate.of(today.getYear(),((today.getMonthValue()-1)/3)*3+1,1);case "year"->LocalDate.of(today.getYear(),1,1);default->throw error(422,"INVALID_PERIOD","周期无效");};
    LocalDate from=switch(frequency){case "daily"->to.minusDays(1);case "weekly"->to.minusWeeks(1);case "month"->to.minusMonths(1);case "quarter"->to.minusMonths(3);default->to.minusYears(1);};
    return new Period(from,to,frequency+":"+from);
  }
  @Scheduled(initialDelay=45000,fixedDelay=60000) public void tick(){
    if(!schema.ready())return;
    try { scan(); deliver(); }catch(RuntimeException e){LOG.warn("Scheduled delivery will retry: {}",e.getClass().getSimpleName());}
  }
  private void scan(){
    LocalDate today=LocalDate.now(ZONE);
    // Keyset traversal is bounded per query; only opted-in owners participate in summaries/reports.
    long after=0;
    while(true){
      var rows=store.db().queryForList("SELECT * FROM jf_delivery_preference WHERE owner_id>? ORDER BY owner_id LIMIT 100",after);
      if(rows.isEmpty())break;
      for(var row:rows){after=number(row.get("owner_id"));try{
        var actor=auth.byId(after);String digest=str(row,"digest");
        if(!digest.equals("off")){
          var period=previous(digest,today);
          // Do not send a historical digest for a period before the user enabled this feature.
          if(!period.to().atStartOfDay(ZONE).toInstant().isBefore(Instant.parse(timestamp(row.get("enabled_at"))))) {
            Long count=store.db().queryForObject("SELECT COUNT(*) FROM jf_entity WHERE kind='notification' AND owner_id=? AND created_at>=? AND created_at<? AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.sourceType')),'')<>'digest'",Long.class,actor.id,java.sql.Timestamp.from(period.from().atStartOfDay(ZONE).toInstant()),java.sql.Timestamp.from(period.to().atStartOfDay(ZONE).toInstant()));
            if(count!=null&&count>0)enqueue(actor,"digest",period.key(),m("title",digest.equals("daily")?"每日消息摘要":"每周消息摘要","content",period.from()+" 至 "+period.to()+"（不含结束日），共收到 "+count+" 条业务消息。请到站内消息查看原始记录。","sourceType","digest","frequency",digest,"read",false));
          }
        }
        if(JfAccess.can(actor,"analytics:export"))for(String frequency:strings(row.get("reports"))){
          var period=previous(frequency,today);
          if(period.to().atStartOfDay(ZONE).toInstant().isBefore(Instant.parse(timestamp(row.get("enabled_at")))))continue;
          tx.executeWithoutResult(status->{
            // Owner preference lock serializes scheduler instances and unique period ledger prevents duplicates.
            store.db().queryForList("SELECT owner_id FROM jf_delivery_preference WHERE owner_id=? FOR UPDATE",actor.id);
            if(!strings(store.db().queryForObject("SELECT reports FROM jf_delivery_preference WHERE owner_id=?",String.class,actor.id)).contains(frequency))return;
            if(store.db().queryForObject("SELECT COUNT(*) FROM jf_report_period WHERE owner_id=? AND period_key=?",Long.class,actor.id,period.key())>0)return;
            var result=obj(jobs.create(actor,m("kind","report","region","","from",period.from().toString(),"to",period.to().toString(),"period",period.key()),"schedule-"+hash(actor.id+":"+period.key())));
            store.db().update("INSERT INTO jf_report_period(owner_id,period_key,job_id) VALUES(?,?,?)",actor.id,period.key(),str(result,"id"));
          });
        }
      }catch(ApiException unavailable){/* Disabled accounts and revoked permissions receive no new job. */}}
    }
    var config=store.find("setting","platformConfig",false);
    if(!bool(config.data().get("draftNotice")))return;
    long cursor=0;
    while(true){
      var drafts=store.db().queryForList("SELECT d.user_id,d.version FROM jf_draft d LEFT JOIN jf_delivery_preference p ON p.owner_id=d.user_id WHERE d.user_id>? AND d.payload IS NOT NULL AND d.updated_at<TIMESTAMPADD(DAY,-3,CURRENT_TIMESTAMP(3)) AND COALESCE(p.draft_notice,TRUE)=TRUE ORDER BY d.user_id LIMIT 100",cursor);
      if(drafts.isEmpty())break;
      for(var draft:drafts){cursor=number(draft.get("user_id"));try{var actor=auth.byId(cursor);enqueue(actor,"draft",Long.toString(number(draft.get("version"))),m("title","云草稿待继续","content","你的云草稿已超过三天未更新，可以继续编辑或删除。","sourceType","draft-reminder","draftVersion",draft.get("version"),"read",false));}catch(ApiException ignored){}}
    }
  }
  private void enqueue(JfAuth.Actor actor,String kind,String period,Map<String,Object> payload){
    String key=kind+":"+actor.id+":"+period;
    store.db().update("INSERT IGNORE INTO jf_scheduled_delivery(delivery_key,owner_id,region_id,kind,payload) VALUES(?,?,?,?,?)",key,actor.id,actor.regions.stream().findFirst().orElse("all"),kind,json(payload));
  }
  private void deliver(){
    for(int i=0;i<50;i++){
      Boolean processed=tx.execute(status->{
        var rows=store.db().queryForList("SELECT * FROM jf_scheduled_delivery WHERE status='queued' AND available_at<=CURRENT_TIMESTAMP(3) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
        if(rows.isEmpty())return false;
        var row=rows.getFirst();String key=str(row,"delivery_key");
        try{
          var actor=auth.byId(number(row.get("owner_id")));var pref=preferences(actor);var payload=parse(text(row.get("payload")));
          boolean allowed=str(row,"kind").equals("digest")?str(pref,"digest").equals(str(payload,"frequency")):bool(pref.get("draftNotice"))&&bool(store.find("setting","platformConfig",false).data().get("draftNotice"));
          if(str(row,"kind").equals("draft"))allowed=allowed&&store.db().queryForObject("SELECT COUNT(*) FROM jf_draft WHERE user_id=? AND version=? AND payload IS NOT NULL",Long.class,actor.id,number(payload.get("draftVersion")))>0;
          if(allowed){String notice="scheduled_"+hash(key).substring(0,40);store.db().update("INSERT IGNORE INTO jf_entity(id,kind,owner_id,region_id,status,payload) VALUES(?,'notification',?,?,'unread',?)",notice,actor.id,str(row,"region_id"),json(payload));store.db().update("INSERT IGNORE INTO jf_notification_delivery(delivery_key,owner_id,notification_id,kind) VALUES(?,?,?,?)",key,actor.id,notice,str(row,"kind"));}
          store.db().update("UPDATE jf_scheduled_delivery SET status=?,error_code=NULL WHERE delivery_key=?",allowed?"completed":"cancelled",key);
        }catch(ApiException e){store.db().update("UPDATE jf_scheduled_delivery SET status='cancelled',error_code=? WHERE delivery_key=?",e.code,key);}
        catch(RuntimeException e){long attempts=number(row.get("attempts"))+1;store.db().update("UPDATE jf_scheduled_delivery SET status=?,attempts=?,error_code=?,available_at=TIMESTAMPADD(MINUTE,?,CURRENT_TIMESTAMP(3)) WHERE delivery_key=?",attempts>=5?"failed":"queued",attempts,e.getClass().getSimpleName(),attempts,key);}
        return true;
      });
      if(!Boolean.TRUE.equals(processed))break;
    }
  }
}
