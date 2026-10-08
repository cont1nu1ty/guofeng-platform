package org.dromara.jiafeng;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class JfRightsController {
  private final JfAuth auth; private final JfRights rights;
  public JfRightsController(JfAuth auth,JfRights rights){this.auth=auth;this.rights=rights;}
  @GetMapping("/rights/agreement") public Object agreement(){return JfRights.agreement();}
  @GetMapping("/me/copyright-confirmations") public Object mine(){return rights.mine(auth.require());}
  @PostMapping("/submissions/{id}/copyright-confirmations") public Object confirm(@PathVariable String id,@RequestBody Map<String,Object> input,
      @RequestHeader(value="Idempotency-Key",required=false) String key){return rights.submit(auth.require(),id,input,key);}
}
