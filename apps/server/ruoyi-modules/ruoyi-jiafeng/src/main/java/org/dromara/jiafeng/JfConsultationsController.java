package org.dromara.jiafeng;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
@RestController
@RequestMapping("/api/v1")
public class JfConsultationsController {
  private final JfConsultations consultations; private final JfAuth auth; private final JfStore store;
  public JfConsultationsController(JfConsultations consultations,JfAuth auth,JfStore store) { this.consultations=consultations;this.auth=auth;this.store=store; }
  private JfAuth.Actor admin(String permission) { var actor=auth.admin();JfAccess.require(actor,permission);return actor; }
  @GetMapping("/admin/consultations/{id}") public Object get(@PathVariable String id) { return consultations.get(admin("welfare:read"),id,true); }
  @PostMapping("/admin/consultations/{id}") @Transactional
  public Object followUp(@PathVariable String id,@RequestBody Map<String,Object> input,@RequestHeader(value="Idempotency-Key",required=false) String key) {
    var actor=admin("welfare:write");return store.idempotent(actor,"consultation.followup:"+id,key,input,()->consultations.followUp(actor,id,input));
  }
  @GetMapping("/me/consultations/{id}") public Object mine(@PathVariable String id) { return consultations.get(auth.require(),id,false); }
}
