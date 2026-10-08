package org.dromara.jiafeng;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1")
public class JfResourcesController {
  private final JfAuth auth;private final JfResources resources;
  public JfResourcesController(JfAuth auth,JfResources resources){this.auth=auth;this.resources=resources;}
  @GetMapping("/resources") public Object catalog(@RequestParam(defaultValue="")String query,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int pageSize){return resources.catalog(auth.optional(),false,query,page,pageSize);}
  @GetMapping("/admin/resources") public Object administration(@RequestParam(defaultValue="")String query,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int pageSize){return resources.catalog(auth.admin(),true,query,page,pageSize);}
  @PostMapping("/admin/resources") public Object create(@RequestBody Map<String,Object> input,@RequestHeader(value="Idempotency-Key",required=false)String key){return resources.save(auth.admin(),"",input,key);}
  @PostMapping("/admin/resources/{id}") public Object update(@PathVariable String id,@RequestBody Map<String,Object> input,@RequestHeader(value="Idempotency-Key",required=false)String key){return resources.save(auth.admin(),id,input,key);}
  @PostMapping("/resources/{id}/download") public Object download(@PathVariable String id,@RequestBody Map<String,Object> input){return resources.download(auth.require(),id,input);}
}
