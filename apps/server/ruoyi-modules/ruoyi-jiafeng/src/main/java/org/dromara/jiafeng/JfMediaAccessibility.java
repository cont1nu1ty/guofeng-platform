package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Human-authored caption/narration drafts are published separately from the source media. */
@Service
public class JfMediaAccessibility {
  private final JfStore store;
  private final JfAuth auth;
  private final JfFiles files;
  public JfMediaAccessibility(JfStore store,JfAuth auth,JfFiles files) {this.store=store;this.auth=auth;this.files=files;}
  private JfStore.Entity editable(JfAuth.Actor actor,String id,boolean write) {
    JfAccess.require(actor,write?"content:write":"content:read");
    var media=store.find("media",id,write);
    require(actor.region(media.region()),403,"FORBIDDEN","不能操作其他地区媒体");
    return media;
  }
  public Map<String,Object> admin(JfAuth.Actor actor,String id) {
    editable(actor,id,false);
    var rows=store.db().queryForList("SELECT * FROM jf_media_accessibility WHERE media_id=?",id);
    if(rows.isEmpty())return m("mediaId",id,"version",0,"draft",m("language","zh","cues",List.of(),"narrationFileId",""),"publishedAt",null);
    var row=rows.getFirst();
    return m("mediaId",id,"version",row.get("version"),"draft",parse(text(row.get("draft"))),"publishedAt",timestamp(row.get("published_at")));
  }
  public Object save(JfAuth.Actor actor,String id,Object version,String action,Map<String,Object> input) {
    var media=editable(actor,id,true);
    var rows=store.db().queryForList("SELECT * FROM jf_media_accessibility WHERE media_id=? FOR UPDATE",id);
    long current=rows.isEmpty()?0:number(rows.getFirst().get("version"));
    require(version!=null&&number(version)==current,409,"VERSION_CONFLICT","字幕已变更，请重新加载后编辑");
    require(Set.of("save","publish","unpublish").contains(action),422,"INVALID_ACTION","字幕操作无效");
    if(action.equals("save")) {
      var draft=normalize(input);
      checkNarration(actor,str(draft,"narrationFileId"),rows.isEmpty()?"":str(parse(text(rows.getFirst().get("draft"))),"narrationFileId"));
      if(rows.isEmpty())store.db().update("INSERT INTO jf_media_accessibility(media_id,version,draft,updated_by) VALUES(?,1,?,?)",id,json(draft),actor.id);
      else store.db().update("UPDATE jf_media_accessibility SET version=version+1,draft=?,updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE media_id=?",json(draft),actor.id,id);
    } else {
      require(!rows.isEmpty(),422,"MISSING_DRAFT","请先保存字幕草稿");
      var draft=parse(text(rows.getFirst().get("draft")));
      if(action.equals("publish")) {
        require(media.status().equals("已发布"),422,"MEDIA_NOT_PUBLISHED","请先审核发布媒体，再发布字幕与朗读");
        require(!list(draft.get("cues")).isEmpty()||!str(draft,"narrationFileId").isBlank(),422,"EMPTY_ACCESSIBILITY","请添加人工字幕或朗读录音");
        String source=str(media.data(),"sourceFileId");
        var file=files.info(source);
        long duration=file.get("duration_ms")==null?600000:number(file.get("duration_ms"));
        for(Object cue:list(draft.get("cues")))require(number(obj(cue).get("endMs"))<=duration+150,422,"INVALID_CUES","字幕时间超出媒体时长");
        draft.put("sourceFileId",source);
        store.db().update("UPDATE jf_media_accessibility SET version=version+1,published=?,published_at=CURRENT_TIMESTAMP(3),updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE media_id=?",json(draft),actor.id,id);
      } else store.db().update("UPDATE jf_media_accessibility SET version=version+1,published=NULL,published_at=NULL,updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE media_id=?",actor.id,id);
    }
    store.audit(actor,"media.accessibility."+action,id,media.region(),m("version",current+1));
    return admin(actor,id);
  }
  private void checkNarration(JfAuth.Actor actor,String id,String previous) {
    if(id.isBlank())return;
    var file=files.info(id);
    require(str(file,"file_type").equals("audio")&&str(file,"purpose").equals("media"),422,"INVALID_NARRATION","请选择已上传的媒体音频");
    require(id.equals(previous)||number(file.get("owner_id"))==actor.id,403,"FORBIDDEN","新关联录音须由当前编辑账号上传");
  }
  static Map<String,Object> normalize(Map<String,Object> input) {
    String language=str(input,"language");
    require(Set.of("zh","en").contains(language),422,"INVALID_LANGUAGE","请选择字幕语言");
    var cues=list(input.get("cues"));require(cues.size()<=500,422,"INVALID_CUES","每条媒体最多500条字幕");
    List<Object> clean=new ArrayList<>();long end=0;
    for(Object item:cues) {
      var cue=obj(item);long start=number(cue.get("startMs")),next=number(cue.get("endMs"));
      require(start>=end&&next>start&&next<=600000,422,"INVALID_CUES","字幕须按时间排序、互不重叠且在10分钟内");
      clean.add(m("startMs",start,"endMs",next,"text",required(cue,"text",1,1000)));end=next;
    }
    String narration=str(input,"narrationFileId");require(narration.length()<=80,422,"INVALID_NARRATION","录音编号无效");
    return m("language",language,"cues",clean,"narrationFileId",narration);
  }
  public Object published(String id) {
    var media=store.find("media",id,false);
    require(media.status().equals("已发布"),404,"NOT_FOUND","媒体不存在或已下架");
    var rows=store.db().queryForList("SELECT published,published_at FROM jf_media_accessibility WHERE media_id=? AND published IS NOT NULL",id);
    if(rows.isEmpty())return m("cues",List.of(),"narrationUrl","");
    var row=rows.getFirst();var value=parse(text(row.get("published")));
    // Editing/replacing the video invalidates timing until an operator republishes captions.
    if(!str(value,"sourceFileId").equals(str(media.data(),"sourceFileId")))return m("cues",List.of(),"narrationUrl","");
    String narration=str(value,"narrationFileId");
    return m("language",value.get("language"),"cues",value.get("cues"),"publishedAt",timestamp(row.get("published_at")),
        "narrationUrl",narration.isBlank()?"":str(files.publicDownload(narration),"url"));
  }
}
