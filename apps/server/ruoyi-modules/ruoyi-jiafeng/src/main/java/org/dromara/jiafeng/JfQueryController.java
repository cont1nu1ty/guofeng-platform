package org.dromara.jiafeng;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class JfQueryController {
  private final JfAuth auth;
  private final JfQueries queries;
  public JfQueryController(JfAuth auth, JfQueries queries) { this.auth = auth; this.queries = queries; }
  @GetMapping("/bootstrap") public Object bootstrap() { return queries.bootstrap(auth.admin()); }
  @GetMapping("/records/{collection}") public Object records(@PathVariable String collection,
      @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="25") int pageSize,
      @RequestParam(defaultValue="") String q, @RequestParam(defaultValue="") String status,
      @RequestParam(defaultValue="") String region) {
    return queries.page(auth.admin(), collection, page, pageSize, q, status, region);
  }
  @GetMapping("/records/{collection}/{id}") public Object detail(@PathVariable String collection, @PathVariable String id) {
    return queries.detail(auth.admin(), collection, id);
  }
  @GetMapping("/statistics") public Object statistics(@RequestParam(defaultValue="") String region) {
    return queries.statistics(auth.admin(), region);
  }
  @GetMapping("/collection-candidates") public Object candidates(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="") String region){return queries.collectionCandidates(auth.admin(),q,region);}
  @GetMapping("/activities/{id}/registrations") public Object registrations(@PathVariable String id,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="25")int pageSize,@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="")String status){return queries.registrations(auth.admin(),id,page,pageSize,q,status);}
}
