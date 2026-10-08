package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JfResources {
  private final JfStore store; private final JfFiles files;
  public JfResources(JfStore store,JfFiles files){this.store=store;this.files=files;}

  public Object catalog(JfAuth.Actor actor,boolean admin,String query,int page,int size){
    require(page>=1&&page<=100000&&size>=1&&size<=100,422,"INVALID_PAGE","分页参数无效");
    require(query.length()<=80,422,"INVALID_FILTER","搜索内容过长");
    if(admin)JfAccess.require(actor,"resources:read");
    StringBuilder where=new StringBuilder(" WHERE 1=1");List<Object> args=new ArrayList<>();
    if(admin){if(!actor.national()){where.append(" AND JSON_CONTAINS(?,JSON_QUOTE(r.region_id))");args.add(json(actor.regions));}}
    else {
      where.append(" AND r.status='published'");
      if(actor==null)where.append(" AND r.audience='all_members'");
      else if(!actor.national()){where.append(" AND (r.audience='all_members' OR JSON_CONTAINS(?,JSON_QUOTE(r.region_id)))");args.add(json(actor.regions));}
    }
    if(!query.isBlank()){where.append(" AND r.title LIKE ?");args.add("%"+query.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%");}
    var total=store.db().queryForObject("SELECT COUNT(*) FROM jf_resource r"+where,Long.class,args.toArray());
    args.add(size);args.add((page-1)*size);
    var rows=store.db().queryForList("SELECT r.*,f.name AS file_name,f.mime_type,f.size,f.sha256 FROM jf_resource r JOIN jf_file f ON f.id=r.file_id"+where
        +" ORDER BY r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?",args.toArray());
    return m("items",rows.stream().map(row->dto(row,admin)).toList(),"total",total,"page",page,"pageSize",size);
  }

  @Transactional
  public Object save(JfAuth.Actor actor,String id,Map<String,Object> input,String key){
    JfAccess.require(actor,"resources:write");
    return store.idempotent(actor,"resource.save:"+id,key,input,()->{
      Map<String,Object> old=id.isBlank()?null:record(id,true);
      if(old!=null){require(actor.region(str(old,"region_id")),404,"NOT_FOUND","资源不存在或不可见");require(input.containsKey("version"),428,"VERSION_REQUIRED","缺少资源版本");
        require(number(input.get("version"))==number(old.get("version")),412,"VERSION_CONFLICT","资源已更新，请刷新");}
      String region=region(input.get("regionId"));require(actor.region(region),404,"NOT_FOUND","地区不在授权范围");
      String title=required(input,"title",2,160),description=required(input,"description",5,2000),license=required(input,"licenseText",10,4000),attribution=required(input,"attribution",2,500);
      String audience=str(input,"audience"),status=str(input,"status"),fileId=required(input,"fileId",1,64);
      require(Set.of("all_members","authorized_regions").contains(audience),422,"INVALID_AUDIENCE","请选择下载范围");
      require(Set.of("draft","published","withdrawn").contains(status),422,"INVALID_STATUS","请选择资源状态");
      require(!status.equals("published")||Boolean.TRUE.equals(input.get("authorized")),422,"AUTHORIZATION_REQUIRED","发布前须确认拥有该资源的分发授权");
      var file=files.info(fileId);
      boolean retained=old!=null&&str(old,"file_id").equals(fileId);
      require(retained||number(file.get("owner_id"))==actor.id,404,"NOT_FOUND","只能选择本人上传的资源文件");
      require(Set.of("pdf","word","image").contains(str(file,"file_type")),422,"INVALID_RESOURCE_FILE","资源目录暂接受PDF、Word或图片文件");
      require(!str(file,"purpose").equals("generated"),422,"PRIVATE_GENERATED_FILE","证书和私人导出不能作为公共资源发布");
      String resource=id.isBlank()?id("resource_"):id;
      if(old==null)store.db().update("INSERT INTO jf_resource(id,owner_id,region_id,title,description,file_id,license_text,attribution,audience,status) VALUES(?,?,?,?,?,?,?,?,?,?)",
          resource,actor.id,region,title,description,fileId,license,attribution,audience,status);
      else store.db().update("UPDATE jf_resource SET region_id=?,title=?,description=?,file_id=?,license_text=?,attribution=?,audience=?,status=?,version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
          region,title,description,fileId,license,attribution,audience,status,resource);
      store.audit(actor,"resource.save",resource,region,m("status",status,"fileHash",file.get("sha256"),"licenseHash",hash(license),"audience",audience));
      return m("ok",true,"id",resource);
    });
  }

  public Object download(JfAuth.Actor actor,String id,Map<String,Object> input){
    var row=record(id,false);authorizeDownload(actor,row);
    require(Boolean.TRUE.equals(input.get("acceptedLicense")),422,"LICENSE_REQUIRED","请阅读并确认资源使用许可");
    require(input.containsKey("version")&&number(input.get("version"))==number(row.get("version")),412,"RESOURCE_CHANGED","资源或使用许可已更新，请刷新后重新确认");
    var file=files.info(str(row,"file_id"));
    store.audit(actor,"resource.download",id,str(row,"region_id"),m("version",row.get("version"),"fileHash",file.get("sha256"),"licenseHash",hash(str(row,"license_text"))));
    return files.publicDownload(str(row,"file_id"));
  }

  static void authorizeDownload(JfAuth.Actor actor,Map<String,Object> row){
    require(actor!=null,401,"UNAUTHENTICATED","请登录后下载授权资源");
    require(str(row,"status").equals("published")&&(str(row,"audience").equals("all_members")||actor.region(str(row,"region_id"))),404,"NOT_FOUND","资源已下架或不在授权范围");
  }
  private Map<String,Object> record(String id,boolean lock){var rows=store.db().queryForList("SELECT * FROM jf_resource WHERE id=?"+(lock?" FOR UPDATE":""),id);require(!rows.isEmpty(),404,"NOT_FOUND","资源不存在或不可见");return rows.getFirst();}
  private Map<String,Object> dto(Map<String,Object> row,boolean admin){var result=m("id",row.get("id"),"title",row.get("title"),"description",row.get("description"),"regionId",row.get("region_id"),"region",regionName(str(row,"region_id")),
      "licenseText",row.get("license_text"),"attribution",row.get("attribution"),"audience",row.get("audience"),"status",row.get("status"),"version",row.get("version"),
      "fileName",row.get("file_name"),"mimeType",row.get("mime_type"),"size",row.get("size"),"sha256",row.get("sha256"),"updatedAt",timestamp(row.get("updated_at")));
    if(admin)result.put("fileId",row.get("file_id"));return result;}
}
