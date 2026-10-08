package org.dromara.jiafeng;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/admin/exports")
public class JfJobController {
  private final JfAuth auth;private final JfJobs jobs;
  public JfJobController(JfAuth auth,JfJobs jobs){this.auth=auth;this.jobs=jobs;}
  @PostMapping public Object create(@RequestBody Map<String,Object> input,@RequestHeader("Idempotency-Key") String key){return jobs.create(auth.admin(),input,key);}
  @GetMapping public Object list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="25") int pageSize){return jobs.listJobs(auth.admin(),page,pageSize);}
  @PostMapping("/{id}/{action}") public Object action(@PathVariable String id,@PathVariable String action){return jobs.action(auth.admin(),id,action);}
  @GetMapping("/{id}/download") public Object download(@PathVariable String id){return jobs.download(auth.admin(),id);}
}
