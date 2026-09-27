package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Public search never receives an actor's private workspace or a caller-supplied ES query. */
@RestController
@RequestMapping("/api/v1")
public class JfSearchController {
  private final JfSearch search;
  private final JfAuth auth;

  public JfSearchController(JfSearch search, JfAuth auth) {
    this.search = search;
    this.auth = auth;
  }

  @GetMapping("/search")
  public ResponseEntity<?> search(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "all") String kind,
      @RequestParam(defaultValue = "all") String region,
      @RequestParam(defaultValue = "zh") String language,
      @RequestParam(defaultValue = "") String cursor,
      @RequestParam(defaultValue = "12") String pageSize) {
    int size;
    try { size = Integer.parseInt(pageSize); }
    catch (NumberFormatException e) { throw error(422, "INVALID_PAGE_SIZE", "每页数量须为1至50的整数"); }
    return ResponseEntity.ok().header("Cache-Control", "no-store")
        .body(search.search(q, kind, region, language, cursor, size));
  }

  private JfAuth.Actor national() {
    var actor = auth.admin();
    require(actor.national(), 403, "FORBIDDEN", "仅全国管理员可管理搜索索引");
    return actor;
  }

  @GetMapping("/admin/search/status")
  public ResponseEntity<?> status() {
    require(auth.admin().operator(), 403, "FORBIDDEN", "仅运营账号可查看搜索状态");
    return ResponseEntity.ok().header("Cache-Control", "no-store").body(search.status());
  }

  @PostMapping("/admin/search/rebuild")
  public ResponseEntity<?> rebuild() {
    return ResponseEntity.accepted().header("Cache-Control", "no-store")
        .body(search.requestRebuild(national()));
  }
}
