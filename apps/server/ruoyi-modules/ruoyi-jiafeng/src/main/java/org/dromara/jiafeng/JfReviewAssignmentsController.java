package org.dromara.jiafeng;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/v1/admin/review-assignments")
public class JfReviewAssignmentsController {
  private final JfAuth auth; private final JfStore store; private final JfReviewAssignments assignments;
  public JfReviewAssignmentsController(JfAuth auth, JfStore store, JfReviewAssignments assignments) {
    this.auth = auth; this.store = store; this.assignments = assignments;
  }
  private JfAuth.Actor actor() { var actor = auth.admin(); JfAccess.require(actor, "reviews:manage"); return actor; }
  @GetMapping("/candidates")
  public Object candidates(@RequestParam String submissionId) { return assignments.candidates(actor(), submissionId); }
  @PostMapping("/preview")
  @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object preview(@RequestBody Map<String, Object> input) { return assignments.preview(actor(), input, false); }
  @PostMapping("/confirm")
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Object confirm(@RequestBody Map<String, Object> input, @RequestHeader(value = "Idempotency-Key", required = false) String key) {
    var actor = actor();
    return store.idempotent(actor, "review.assign.batch", key, input, () -> assignments.confirm(actor, input));
  }
}
