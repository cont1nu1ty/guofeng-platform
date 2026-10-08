package org.dromara.jiafeng;
import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import java.time.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/engagement/events")
public class JfEngagementController {
  private final JfAuth auth;private final JfStore store;private final JfCatalog catalog;
  public JfEngagementController(JfAuth auth,JfStore store,JfCatalog catalog){this.auth=auth;this.store=store;this.catalog=catalog;}
  @PostMapping public Object record(@RequestBody Map<String,Object> input){
    var actor=auth.require();String kind=str(input,"kind"),action=str(input,"action"),id=required(input,"targetId",1,64);
    require(Set.of("media","submission","content","collection").contains(kind)&&Set.of("view","share_intent").contains(action),422,"INVALID_EVENT","传播事件无效");
    var entity=store.find(kind,id,false);
    boolean visible=switch(kind){case "media"->catalog.visible(entity);case "content"->entity.status().equals("已发布");case "collection"->entity.status().equals("已入藏");default->Set.of("shortlisted","awarded","collected").contains(entity.status())&&bool(entity.data().get("published"));};
    require(visible,404,"NOT_FOUND","公开内容不存在或已下架");
    int inserted=store.db().update("INSERT IGNORE INTO jf_engagement(owner_id,target_kind,target_id,action,day_key,region_id) VALUES(?,?,?,?,?,?)",actor.id,kind,id,action,LocalDate.now(ZoneId.of("Asia/Shanghai")).toString(),entity.region());
    return m("recorded",inserted==1,"metricVersion","signed-in-content-day-v1");
  }
}
