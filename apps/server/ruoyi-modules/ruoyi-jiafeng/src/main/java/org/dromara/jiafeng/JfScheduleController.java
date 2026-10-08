package org.dromara.jiafeng;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/me/delivery-preferences")
public class JfScheduleController {
  private final JfAuth auth;private final JfSchedules schedules;
  public JfScheduleController(JfAuth auth,JfSchedules schedules){this.auth=auth;this.schedules=schedules;}
  @GetMapping public Object get(){return schedules.preferences(auth.require());}
  @PutMapping public Object put(@RequestBody Map<String,Object> input){return schedules.save(auth.require(),input);}
}
