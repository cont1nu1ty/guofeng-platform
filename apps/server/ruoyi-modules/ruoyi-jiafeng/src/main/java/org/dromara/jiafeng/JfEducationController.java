package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class JfEducationController {
  private final JfEducation education;
  private final JfAuth auth;
  private final JfStore store;
  public JfEducationController(JfEducation education, JfAuth auth, JfStore store) {
    this.education = education; this.auth = auth; this.store = store;
  }
  @GetMapping("/education/courses") public Object courses() { return m("items", education.publicCourses()); }
  @GetMapping("/education/courses/{id}") public Object course(@PathVariable String id, @RequestParam(required=false) Long version) {
    return education.detail(auth.optional(), id, version);
  }
  @GetMapping("/education/me") public Object mine() { return education.mine(auth.require()); }
  @GetMapping("/admin/education") public Object admin(@RequestParam(defaultValue="1") int coursePage,
      @RequestParam(defaultValue="1") int groupPage,@RequestParam(defaultValue="1") int identityPage,@RequestParam(defaultValue="") String q) {
    return education.admin(auth.admin(),coursePage,groupPage,identityPage,q);
  }
  @GetMapping("/admin/education/members") public Object members(@RequestParam(defaultValue="") String q) {
    return m("items",education.memberCandidates(auth.admin(),q));
  }
  @PostMapping("/admin/education/commands")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object adminCommand(@RequestBody Map<String,Object> input, @RequestHeader("Idempotency-Key") String key) {
    var actor = auth.admin();
    JfAccess.require(actor, "education:write");
    String command = required(input, "command", 1, 80), id = str(input, "entityId");
    require(JfEducation.ADMIN_COMMANDS.contains(command), 422, "UNKNOWN_COMMAND", "教育操作不存在");
    return store.idempotent(actor, "education:admin:" + command, key, input, () -> {
      Object result = education.adminCommand(actor, command, id, input.get("version"), obj(input.get("data")));
      store.audit(actor, command, id.isEmpty() ? str(obj(result), "id") : id, actor.regions.stream().findFirst().orElse("all"), m());
      return result;
    });
  }
  @PostMapping("/education/commands")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object memberCommand(@RequestBody Map<String,Object> input, @RequestHeader("Idempotency-Key") String key) {
    var actor = auth.require();
    String command = required(input, "command", 1, 80), id = str(input, "entityId");
    education.authorizeMemberCommand(actor, command, id, obj(input.get("data")));
    return store.idempotent(actor, "education:member:" + command, key, input, () -> {
      Object result = education.memberCommand(actor, command, id, input.get("version"), obj(input.get("data")));
      store.audit(actor, command, id, actor.regions.stream().findFirst().orElse("all"), m("publicationVersion", obj(input.get("data")).get("publicationVersion")));
      return result;
    });
  }
}
