package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.io.IOException;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** An immutable issuance with durable business download and a minimal public verification record. */
@Service
public class JfCertificates {
  private final JfStore store; private final JfFiles files;
  public JfCertificates(JfStore store, JfFiles files) { this.store=store; this.files=files; }

  public Object eligible(JfAuth.Actor actor, String query) {
    JfAccess.require(actor, "certificates:write");
    require(query.length()<=80,422,"INVALID_FILTER","查询内容过长");
    String scope=actor.national()?"":" AND JSON_CONTAINS(?,JSON_QUOTE(e.region_id))";
    List<Object> args=new ArrayList<>(); if(!actor.national())args.add(json(actor.regions));
    String needle="%"+query.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
    args.add(needle);args.add(needle);
    var award=store.db().queryForList("SELECT e.id,e.owner_id,e.region_id,e.payload,u.nick_name FROM jf_entity e JOIN sys_user u ON u.user_id=e.owner_id "
        +"WHERE e.kind='submission' AND e.status='awarded'"+scope+" AND (u.nick_name LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.title')) LIKE ?) ORDER BY e.updated_at DESC LIMIT 100",args.toArray());
    var result=new ArrayList<Map<String,Object>>();
    for(var row:award){var data=parse(text(row.get("payload")));result.add(m("kind","award","sourceId",row.get("id"),"ownerId",text(row.get("owner_id")),
        "name",row.get("nick_name"),"title",str(data,"title"),"region",regionName(str(row,"region_id")),"courseVersion",0));}
    var learning=store.db().queryForList("SELECT l.user_id,l.course_id,l.publication_version,l.completed_at,p.payload,e.region_id,u.nick_name FROM jf_course_learning l "
        +"JOIN jf_course_publication p ON p.course_id=l.course_id AND p.publication_version=l.publication_version "
        +"JOIN jf_entity e ON e.id=l.course_id AND e.kind='course' JOIN sys_user u ON u.user_id=l.user_id "
        +"WHERE l.completed_at IS NOT NULL"+scope+" AND (u.nick_name LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(p.payload,'$.title')) LIKE ?) ORDER BY l.completed_at DESC LIMIT 100",args.toArray());
    for(var row:learning){var data=parse(text(row.get("payload")));result.add(m("kind","completion","sourceId",row.get("course_id"),"ownerId",text(row.get("user_id")),
        "name",row.get("nick_name"),"title",str(data,"title"),"region",regionName(str(row,"region_id")),"courseVersion",number(row.get("publication_version"))));}
    return m("items",result,"limitPerKind",100);
  }

  public Object certificates(JfAuth.Actor actor, boolean administration, int page, int size) {
    require(page>=1&&page<=100000&&size>=1&&size<=100,422,"INVALID_PAGE","分页参数无效");
    if(administration)JfAccess.require(actor,"certificates:read");
    String where=administration?(actor.national()?"":" WHERE JSON_CONTAINS(?,JSON_QUOTE(region_id))"):" WHERE owner_id=?";
    List<Object> args=new ArrayList<>();if(!administration)args.add(actor.id);else if(!actor.national())args.add(json(actor.regions));
    var total=store.db().queryForObject("SELECT COUNT(*) FROM jf_certificate"+where,Long.class,args.toArray());
    args.add(size);args.add((page-1)*size);
    var rows=store.db().queryForList("SELECT * FROM jf_certificate"+where+" ORDER BY issued_at DESC,id DESC LIMIT ? OFFSET ?",args.toArray());
    return m("items",rows.stream().map(this::dto).toList(),"total",total,"page",page,"pageSize",size);
  }

  @Transactional(rollbackFor=Exception.class)
  public Object issue(JfAuth.Actor actor, Map<String,Object> input, String key) {
    JfAccess.require(actor,"certificates:write");
    return store.idempotent(actor,"certificate.issue",key,input,()->{
      var source=source(actor,input);String sourceKey=str(source,"sourceKey");
      var existing=store.db().queryForList("SELECT * FROM jf_certificate WHERE active_source_key=?",sourceKey);
      require(existing.isEmpty(),409,"CERTIFICATE_EXISTS","此项资格已有有效证书，请在签发记录中查看");
      String issuer=required(input,"issuer",2,120),id=id("cert_"),token=UUID.randomUUID().toString().replace("-","");
      String no="JF-"+UUID.randomUUID().toString().replace("-","").substring(0,16).toUpperCase(Locale.ROOT);
      String kind=str(source,"kind"),title=kind.equals("award")?"家风作品获奖证书":"家风课程结业证书";
      List<String> paragraphs=new ArrayList<>(List.of("证书编号："+no,"持有人："+str(source,"name"),
          (kind.equals("award")?"作品：":"课程：")+str(source,"title")));
      if(kind.equals("completion"))paragraphs.add("课程发布版本："+source.get("courseVersion")+"；学习完成时间："+JfDocuments.displayTime(str(source,"completedAt")));
      else paragraphs.add("作品修订："+source.get("revisionNumber")+"；依据：平台已确认的获奖结果。");
      paragraphs.add("签发单位："+issuer);paragraphs.add("签发时间："+JfDocuments.displayTime(now()));paragraphs.add("验真码："+token);
      paragraphs.add("请在家风中华行平台使用验真码查询当前状态。本文件为平台人工签发记录，未使用第三方电子签章。");
      Map<String,Object> file;
      try{file=files.generated(number(source.get("ownerId")),str(source,"regionId"),no+".pdf",JfDocuments.mime("pdf"),JfDocuments.render(title,paragraphs,"pdf"));}
      catch(IOException failure){throw error(503,"CERTIFICATE_FILE_FAILED","证书文件未能生成，请稍后重试");}
      store.db().update("INSERT INTO jf_certificate(id,certificate_no,owner_id,region_id,kind,source_key,active_source_key,source_snapshot,title,issuer,file_id,file_hash,verify_token,issued_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,no,source.get("ownerId"),source.get("regionId"),kind,sourceKey,sourceKey,json(source),title,issuer,file.get("fileId"),file.get("sha256"),token,actor.id);
      store.audit(actor,"certificate.issue",id,str(source,"regionId"),m("certificateNo",no,"sourceKey",sourceKey));
      store.notifyUser(number(source.get("ownerId")),str(source,"regionId"),"证书已签发","你的证书已签发，可在个人中心查看和下载。","");
      return m("ok",true,"id",id,"certificateNo",no);
    });
  }

  private Map<String,Object> source(JfAuth.Actor actor, Map<String,Object> input) {
    String kind=str(input,"kind"),id=required(input,"sourceId",1,64);
    if(kind.equals("award")){
      var work=store.find("submission",id,true);
      require(actor.region(work.region()),404,"NOT_FOUND","作品不存在或不可见");
      require(work.status().equals("awarded"),409,"NOT_AWARDED","只能为已确认获奖的作品签发获奖证书");
      require(bool(work.data().get("copyrightAccepted")),409,"RIGHTS_UNCONFIRMED","请先完成本人版权确认");
      return m("kind",kind,"sourceKey","award:"+id+":"+str(work.data(),"revisionId"),"sourceId",id,"ownerId",work.owner(),
          "regionId",work.region(),"name",ownerName(work.owner()),"title",str(work.data(),"title"),"revisionId",str(work.data(),"revisionId"),"revisionNumber",work.data().get("revisionNumber"));
    }
    require(kind.equals("completion"),422,"INVALID_CERTIFICATE","请选择获奖或结业证书");
    long user=number(input.get("ownerId")),version=number(input.get("courseVersion"));
    var course=store.find("course",id,true);
    require(actor.region(course.region()),404,"NOT_FOUND","课程不存在或不可见");
    var rows=store.db().queryForList("SELECT l.completed_at,p.payload FROM jf_course_learning l JOIN jf_course_publication p ON p.course_id=l.course_id AND p.publication_version=l.publication_version "
        +"WHERE l.user_id=? AND l.course_id=? AND l.publication_version=? AND l.completed_at IS NOT NULL FOR UPDATE",user,id,version);
    require(!rows.isEmpty(),409,"LEARNING_INCOMPLETE","找不到此账号已完成的课程发布版本");
    return m("kind",kind,"sourceKey","completion:"+user+":"+id+":"+version,"sourceId",id,"ownerId",user,"regionId",course.region(),"courseVersion",version,
        "name",ownerName(user),"title",str(parse(text(rows.getFirst().get("payload"))),"title"),"completedAt",timestamp(rows.getFirst().get("completed_at")));
  }

  private String ownerName(long user) {
    var rows=store.db().queryForList("SELECT nick_name FROM sys_user WHERE user_id=? AND del_flag='0'",user);
    require(!rows.isEmpty(),404,"NOT_FOUND","持有人不存在");return str(rows.getFirst(),"nick_name");
  }

  @Transactional
  public Object revoke(JfAuth.Actor actor,String id,Map<String,Object> input,String key){
    JfAccess.require(actor,"certificates:write");
    return store.idempotent(actor,"certificate.revoke:"+id,key,input,()->{
      var row=record(id,true);require(actor.region(str(row,"region_id")),404,"NOT_FOUND","证书不存在或不可见");
      require(input.containsKey("version"),428,"VERSION_REQUIRED","缺少证书版本");
      require(number(input.get("version"))==number(row.get("version")),412,"VERSION_CONFLICT","证书状态已更新");
      require(str(row,"status").equals("issued"),409,"CERTIFICATE_REVOKED","证书已撤销");
      String reason=required(input,"reason",5,1000);
      store.db().update("UPDATE jf_certificate SET status='revoked',active_source_key=NULL,revoked_by=?,revoked_at=CURRENT_TIMESTAMP(3),revoke_reason=?,version=version+1 WHERE id=?",actor.id,reason,id);
      store.audit(actor,"certificate.revoke",id,str(row,"region_id"),m("reason",reason));
      store.notifyUser(number(row.get("owner_id")),str(row,"region_id"),"证书状态更新","证书已撤销，请在个人中心查看原因。","");
      return m("ok",true);
    });
  }

  public Object download(JfAuth.Actor actor,String id){
    var row=record(id,false);
    require(number(row.get("owner_id"))==actor.id||(JfAccess.can(actor,"certificates:read")&&actor.region(str(row,"region_id"))),404,"NOT_FOUND","证书不存在或不可见");
    require(str(row,"status").equals("issued"),410,"CERTIFICATE_REVOKED","证书已撤销，不能下载有效证书文件");
    store.audit(actor,"certificate.download",id,str(row,"region_id"),m("fileHash",row.get("file_hash")));
    return files.publicDownload(str(row,"file_id"));
  }

  public Object verify(String token){
    require(token.matches("[a-f0-9]{32}"),404,"NOT_FOUND","未找到此验真码");
    var rows=store.db().queryForList("SELECT certificate_no,title,issuer,status,issued_at,revoked_at,file_hash FROM jf_certificate WHERE verify_token=?",token);
    require(!rows.isEmpty(),404,"NOT_FOUND","未找到此验真码");return publicVerification(rows.getFirst());
  }

  static Map<String,Object> publicVerification(Map<String,Object> row){
    return m("certificateNo",row.get("certificate_no"),"title",row.get("title"),"issuer",row.get("issuer"),"status",row.get("status"),
        "issuedAt",timestamp(row.get("issued_at")),"revokedAt",row.get("revoked_at")==null?null:timestamp(row.get("revoked_at")),"fileHash",row.get("file_hash"));
  }
  private Map<String,Object> record(String id,boolean lock){var rows=store.db().queryForList("SELECT * FROM jf_certificate WHERE id=?"+(lock?" FOR UPDATE":""),id);require(!rows.isEmpty(),404,"NOT_FOUND","证书不存在或不可见");return rows.getFirst();}
  private Map<String,Object> dto(Map<String,Object> row){var result=publicVerification(row);var source=parse(text(row.get("source_snapshot")));result.putAll(m("id",row.get("id"),"kind",row.get("kind"),"ownerId",text(row.get("owner_id")),
      "holderName",source.get("name"),"sourceTitle",source.get("title"),"region",regionName(str(row,"region_id")),"verifyToken",row.get("verify_token"),"version",row.get("version"),"revokeReason",row.get("revoke_reason")));return result;}
}
