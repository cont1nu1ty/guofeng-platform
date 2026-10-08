package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Display hierarchy is separate from the existing province-level authorization scope. */
@Service
public class JfRegions {
  private final JfStore store; private final JfAuth auth;
  public JfRegions(JfStore store, JfAuth auth) { this.store = store; this.auth = auth; }
  public Map<String, Object> node(String id, boolean lock) {
    if (REGION_IDS.contains(id)) return m("id", id, "parentId", "", "provinceId", id, "level", 0,
        "name", regionName(id), "nameEn", "", "enabled", true, "version", 0, "source", "现有省级展示字典");
    var rows = store.db().queryForList("SELECT * FROM jf_region_node WHERE id=?" + (lock ? " FOR UPDATE" : ""), id);
    require(!rows.isEmpty(), 404, "REGION_NOT_FOUND", "地区不存在");
    return dto(rows.getFirst());
  }
  private static Map<String, Object> dto(Map<String, Object> row) {
    return m("id", row.get("id"), "parentId", row.get("parent_id"), "provinceId", row.get("province_id"), "level", row.get("level"),
        "name", row.get("name"), "nameEn", row.get("name_en"), "officialCode", row.get("official_code"), "source", row.get("source"),
        "enabled", Boolean.TRUE.equals(row.get("enabled")) || "1".equals(text(row.get("enabled"))), "version", row.get("version"));
  }
  public Object children(String parentId, JfAuth.Actor admin) {
    List<Map<String, Object>> nodes;
    if (parentId.isBlank()) nodes = REGION_IDS.stream().filter(id -> admin == null || admin.region(id)).map(id -> node(id, false)).toList();
    else {
      var parent = node(parentId, false);
      if (admin != null) auth.operate(admin, str(parent, "provinceId"));
      else require(visible(parent), 404, "REGION_NOT_FOUND", "地区尚未开放");
      nodes = store.db().queryForList("SELECT * FROM jf_region_node WHERE parent_id=?" + (admin == null ? " AND enabled=1" : "") + " ORDER BY name,id", parentId).stream().map(JfRegions::dto).toList();
    }
    return m("items", nodes, "notice", "市县节点使用运营核对的地区名称与来源；未配置地区不推断下级目录。地区筛选不改变账号授权。");
  }
  private boolean visible(Map<String, Object> node) {
    if (!bool(node.get("enabled"))) return false;
    return number(node.get("level")) < 2 || bool(node(str(node, "parentId"), false).get("enabled"));
  }
  public Object save(JfAuth.Actor actor, Map<String, Object> input) {
    String id = str(input, "id"), parentId = required(input, "parentId", 1, 64);
    var parent = node(parentId, true); auth.operate(actor, str(parent, "provinceId"));
    require(number(parent.get("level")) < 2, 422, "REGION_DEPTH", "只支持省、市、区县三级目录");
    String name = required(input, "name", 1, 100), en = required(input, "nameEn", 0, 200), source = required(input, "source", 2, 1000);
    String code = required(input, "officialCode", 0, 40); boolean enabled = bool(input.get("enabled"));
    if (id.isEmpty()) {
      id = id("area_");
      store.db().update("INSERT INTO jf_region_node(id,parent_id,province_id,level,name,name_en,official_code,source,enabled) VALUES(?,?,?,?,?,?,?,?,?)",
          id, parentId, parent.get("provinceId"), number(parent.get("level")) + 1, name, en, code, source, enabled);
    } else {
      var old = node(id, true); auth.operate(actor, str(old, "provinceId"));
      require(number(old.get("level")) > 0 && parentId.equals(str(old, "parentId")), 422, "REGION_PARENT_IMMUTABLE", "已有地区不能跨层级或跨省移动");
      require(input.containsKey("version") && number(input.get("version")) == number(old.get("version")), 412, "VERSION_CONFLICT", "地区已更新，请重新读取");
      store.db().update("UPDATE jf_region_node SET name=?,name_en=?,official_code=?,source=?,enabled=?,version=version+1 WHERE id=?", name, en, code, source, enabled, id);
    }
    store.audit(actor, "region.save", id, str(parent, "provinceId"), m("parentId", parentId));
    return node(id, false);
  }
  public Object venueArea(JfAuth.Actor actor, String venueId) {
    var venue = store.find("venue", venueId, false); auth.operate(actor, venue.region());
    var rows = store.db().queryForList("SELECT area_id FROM jf_venue_area WHERE venue_id=?", venueId);
    return m("venueId", venueId, "version", venue.version(), "coordinateSystem", venue.data().getOrDefault("coordinateSystem", "unknown"), "area", rows.isEmpty() ? null : node(text(rows.getFirst().get("area_id")), false));
  }
  public Object bindVenue(JfAuth.Actor actor, String venueId, Map<String, Object> input) {
    var venue = store.find("venue", venueId, true); auth.operate(actor, venue.region()); store.checkVersion(venue, input.get("version"));
    String areaId = str(input, "areaId");
    if (areaId.isBlank()) store.db().update("DELETE FROM jf_venue_area WHERE venue_id=?", venueId);
    else {
      var area = node(areaId, false);
      require(number(area.get("level")) > 0 && venue.region().equals(str(area, "provinceId")) && visible(area), 422, "INVALID_VENUE_AREA", "阵地须归属同省的已启用市县节点");
      store.db().update("INSERT INTO jf_venue_area(venue_id,area_id) VALUES(?,?) ON DUPLICATE KEY UPDATE area_id=VALUES(area_id)", venueId, areaId);
    }
    String coordinateSystem = str(input,"coordinateSystem");
    require(List.of("unknown","wgs84","gcj02").contains(coordinateSystem),422,"COORDINATE_SYSTEM","请选择坐标来源的坐标系，无法确认时保留待核对");
    var data = copy(venue.data()); data.put("coordinateSystem",coordinateSystem);
    store.save(venue, venue.region(), venue.status(), data);
    store.audit(actor, "venue.area", venueId, venue.region(), m("areaId", areaId));
    return venueArea(actor, venueId);
  }
  public Object venueIds(String areaId) {
    var area = node(areaId, false); require(visible(area), 404, "REGION_NOT_FOUND", "地区尚未开放");
    var rows = store.db().queryForList("SELECT l.venue_id FROM jf_venue_area l JOIN jf_region_node n ON n.id=l.area_id JOIN jf_entity e ON e.id=l.venue_id"
        + " WHERE e.kind='venue' AND e.status='已发布' AND e.region_id=n.province_id AND n.enabled=1 AND (n.id=? OR n.parent_id=?) ORDER BY l.venue_id", areaId, areaId);
    return m("ids", rows.stream().map(row -> row.get("venue_id")).toList());
  }
  public Object venueMap(String id) {
    var venue=store.find("venue",id,false);
    require(venue.status().equals("已发布"),404,"NOT_FOUND","阵地不存在");
    return m("coordinateSystem",venue.data().getOrDefault("coordinateSystem","unknown"));
  }
  public Object coordinates() {
    var items=store.select("venue","status='已发布' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.coordinateSystem'))='wgs84'").stream()
        .filter(e -> !bool(e.data().get("sample")) && e.data().get("latitude") instanceof Number && e.data().get("longitude") instanceof Number)
        .map(e -> m("id",e.id(),"latitude",e.data().get("latitude"),"longitude",e.data().get("longitude"))).toList();
    return m("items",items);
  }
}
