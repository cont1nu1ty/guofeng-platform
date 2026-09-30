package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/review-alerts")
public class JfReviewAlertsController {
  private final JfAuth auth;
  private final JfReviewWindows windows;

  public JfReviewAlertsController(JfAuth auth, JfReviewWindows windows) {
    this.auth = auth;
    this.windows = windows;
  }

  @GetMapping
  public Object list(@RequestParam(defaultValue = "all") String phase,
      @RequestParam(defaultValue = "mine") String scope,
      @RequestParam(defaultValue = "false") String unreadOnly,
      @RequestParam(defaultValue = "1") String page,
      @RequestParam(defaultValue = "20") String pageSize) {
    require(unreadOnly.equals("true") || unreadOnly.equals("false"), 422, "INVALID_FILTER", "未读筛选参数无效");
    int index, size;
    try { index = Integer.parseInt(page); size = Integer.parseInt(pageSize); }
    catch (NumberFormatException invalid) { throw error(422, "INVALID_PAGE", "分页参数无效"); }
    return windows.alerts(auth.admin(), phase, scope, Boolean.parseBoolean(unreadOnly), index, size);
  }
}
