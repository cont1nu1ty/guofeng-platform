package org.dromara.jiafeng;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/accounts")
public class JfAccountsController {
  private final JfAuth auth;
  private final JfAccounts accounts;
  public JfAccountsController(JfAuth auth, JfAccounts accounts) { this.auth = auth; this.accounts = accounts; }

  @GetMapping
  public Object list(@RequestParam(defaultValue="") String query, @RequestParam(defaultValue="") String role,
      @RequestParam(defaultValue="") String region, @RequestParam(defaultValue="") String status,
      @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int pageSize) {
    return accounts.list(auth.admin(), query, role, region, status, page, pageSize);
  }

  @GetMapping("/{id}")
  public Object detail(@PathVariable long id) { return accounts.detail(auth.admin(), id); }

  @PostMapping
  public Object create(@RequestBody Map<String,Object> input,
      @RequestHeader(value="Idempotency-Key",required=false) String key) {
    return accounts.change(auth.admin(), 0, "create", input, key);
  }

  @PostMapping("/{id}/{action}")
  public Object change(@PathVariable long id, @PathVariable String action, @RequestBody Map<String,Object> input,
      @RequestHeader(value="Idempotency-Key",required=false) String key) {
    return accounts.change(auth.admin(), id, action, input, key);
  }
}
