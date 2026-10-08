package org.dromara.jiafeng;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1")
public class JfCertificatesController {
  private final JfAuth auth;private final JfCertificates certificates;
  public JfCertificatesController(JfAuth auth,JfCertificates certificates){this.auth=auth;this.certificates=certificates;}
  @GetMapping("/admin/certificates/eligible") public Object eligible(@RequestParam(defaultValue="") String query){return certificates.eligible(auth.admin(),query);}
  @GetMapping("/admin/certificates") public Object administration(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){return certificates.certificates(auth.admin(),true,page,pageSize);}
  @GetMapping("/me/certificates") public Object mine(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){return certificates.certificates(auth.require(),false,page,pageSize);}
  @PostMapping("/admin/certificates") public Object issue(@RequestBody Map<String,Object> input,@RequestHeader(value="Idempotency-Key",required=false)String key){return certificates.issue(auth.admin(),input,key);}
  @PostMapping("/admin/certificates/{id}/revoke") public Object revoke(@PathVariable String id,@RequestBody Map<String,Object> input,@RequestHeader(value="Idempotency-Key",required=false)String key){return certificates.revoke(auth.admin(),id,input,key);}
  @GetMapping("/certificates/{id}/download") public Object download(@PathVariable String id){return certificates.download(auth.require(),id);}
  @GetMapping("/certificates/verify/{token}") public Object verify(@PathVariable String token){return certificates.verify(token);}
}
