package org.dromara.jiafeng;
import static org.dromara.jiafeng.Jf.*;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1")
public class JfMediaAccessibilityController {
  private final JfMediaAccessibility service;private final JfAuth auth;private final JfStore store;
  public JfMediaAccessibilityController(JfMediaAccessibility service,JfAuth auth,JfStore store){this.service=service;this.auth=auth;this.store=store;}
  @GetMapping("/media/{id}/accessibility") public Object published(@PathVariable String id){return service.published(id);}
  @GetMapping("/admin/media/{id}/accessibility") public Object admin(@PathVariable String id){return service.admin(auth.admin(),id);}
  @PostMapping("/admin/media/{id}/accessibility")
  @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object save(@PathVariable String id,@RequestBody Map<String,Object> input,@RequestHeader("Idempotency-Key")String key){
    var actor=auth.admin();JfAccess.require(actor,"content:write");service.admin(actor,id);return store.idempotent(actor,"media.accessibility:"+id,key,input,
        ()->service.save(actor,id,input.get("version"),str(input,"action"),obj(input.get("data"))));
  }
}
