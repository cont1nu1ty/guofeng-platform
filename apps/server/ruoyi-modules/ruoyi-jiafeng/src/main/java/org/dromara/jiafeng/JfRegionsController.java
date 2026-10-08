package org.dromara.jiafeng;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
@RestController
@RequestMapping("/api/v1")
public class JfRegionsController {
  private final JfRegions regions; private final JfAuth auth; private final JfStore store;
  public JfRegionsController(JfRegions regions, JfAuth auth, JfStore store) { this.regions = regions; this.auth = auth; this.store = store; }
  private JfAuth.Actor actor(String permission) { var actor = auth.admin(); JfAccess.require(actor, permission); return actor; }
  @GetMapping("/regions/children") public Object children(@RequestParam(defaultValue = "") String parentId) { return regions.children(parentId, null); }
  @GetMapping("/regions/venues") public Object venues(@RequestParam String areaId) { return regions.venueIds(areaId); }
  @GetMapping("/regions/venue-map/{id}") public Object venueMap(@PathVariable String id) { return regions.venueMap(id); }
  @GetMapping("/regions/venue-coordinates") public Object coordinates() { return regions.coordinates(); }
  @GetMapping("/admin/regions") public Object adminChildren(@RequestParam(defaultValue = "") String parentId) { return regions.children(parentId, actor("regions:read")); }
  @PostMapping("/admin/regions") @Transactional
  public Object save(@RequestBody Map<String, Object> input, @RequestHeader(value="Idempotency-Key",required=false) String key) {
    var actor = actor("regions:write"); return store.idempotent(actor, "region.save", key, input, () -> regions.save(actor, input));
  }
  @GetMapping("/admin/regions/venues/{id}") public Object venue(@PathVariable String id) { return regions.venueArea(actor("content:write"), id); }
  @PostMapping("/admin/regions/venues/{id}") @Transactional
  public Object bind(@PathVariable String id, @RequestBody Map<String, Object> input, @RequestHeader(value="Idempotency-Key",required=false) String key) {
    var actor = actor("content:write"); return store.idempotent(actor, "venue.area:" + id, key, input, () -> regions.bindVenue(actor,id,input));
  }
}
