package org.dromara.jiafeng;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/v1/admin/submission-imports")
public class JfSubmissionImportsController {
  private final JfAuth auth; private final JfStore store; private final JfSubmissionImports imports;
  public JfSubmissionImportsController(JfAuth auth, JfStore store, JfSubmissionImports imports) { this.auth = auth; this.store = store; this.imports = imports; }
  private JfAuth.Actor actor() { var actor = auth.admin(); JfAccess.require(actor, "submissions:write"); return actor; }
  @PostMapping("/preview")
  @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object preview(@RequestBody Map<String, Object> input) { return imports.preview(actor(), input); }
  @PostMapping("/confirm")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object confirm(@RequestBody Map<String, Object> input, @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    var actor = actor(); return store.idempotent(actor, "submission.import", key, input, () -> imports.confirm(actor, input));
  }
}
