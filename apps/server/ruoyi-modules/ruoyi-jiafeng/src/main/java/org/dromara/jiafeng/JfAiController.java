package org.dromara.jiafeng;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class JfAiController {
  private final JfAuth auth;
  private final JfAi ai;
  public JfAiController(JfAuth auth, JfAi ai) { this.auth = auth; this.ai = ai; }

  @GetMapping("/ai/status") public Object status() { return ai.status(); }
  @PostMapping("/ai/tasks") public Object create(@RequestBody Map<String, Object> input,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return ai.create(auth.require(), input, key);
  }
  @GetMapping("/ai/tasks") public Object own() { return ai.listTasks(auth.require(), false); }
  @GetMapping("/ai/tasks/{id}") public Object task(@PathVariable String id) { return ai.get(auth.require(), id); }
  @GetMapping("/admin/ai/tasks") public Object admin() { return ai.listTasks(auth.admin(), true); }
  @PostMapping("/admin/ai/knowledge/{id}/index") public Object index(@PathVariable String id,
      @RequestBody Map<String, Object> input,
      @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    return ai.index(auth.admin(), id, input, key);
  }
  @PostMapping("/admin/ai/knowledge/{id}/withdraw") public Object withdraw(@PathVariable String id,
      @RequestBody Map<String, Object> input) { return ai.withdraw(auth.admin(), id, input); }
}
