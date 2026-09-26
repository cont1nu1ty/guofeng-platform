package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.dromara.warm.flow.core.FlowEngine;
import org.dromara.warm.flow.core.dto.*;
import org.springframework.stereotype.Service;

/** WarmFlow owns actual task/instance history. Domain authorization precedes these calls. */
@Service
public class JfReviewFlow {
  private final JfStore store;

  public JfReviewFlow(JfStore store) {
    this.store = store;
  }

  public String start(String revisionId, Map<String, Object> config, long operator) {
    String code = "jiafeng_review_v" + config.getOrDefault("flowVersion", 1);
    var definitions =
        store
            .db()
            .queryForList(
                "SELECT id FROM flow_definition WHERE flow_code=? AND is_publish=1", code);
    if (definitions.isEmpty()) {
      List<Integer> stages = new ArrayList<>();
      List<Object> enabled = list(config.get("enabled"));
      for (int i = 0; i < 6; i++) if (enabled.size() > i && bool(enabled.get(i))) stages.add(i);
      List<NodeJson> nodes = new ArrayList<>();
      List<String> codes = new ArrayList<>();
      codes.add("start");
      stages.forEach(i -> codes.add("stage" + i));
      codes.add("end");
      for (int i = 0; i < codes.size(); i++) {
        String c = codes.get(i);
        NodeJson n =
            new NodeJson()
                .setNodeCode(c)
                .setNodeName(
                    c.equals("start")
                        ? "提交"
                        : c.equals("end") ? "评审完成" : STAGES.get(Integer.parseInt(c.substring(5))))
                .setNodeType(i == 0 ? 0 : i == codes.size() - 1 ? 2 : 1)
                .setVersion("1")
                .setPermissionFlag(Long.toString(operator))
                .setNodeRatio("0");
        if (i < codes.size() - 1)
          n.setSkipList(
              List.of(
                  new SkipJson()
                      .setNowNodeCode(c)
                      .setNextNodeCode(codes.get(i + 1))
                      .setSkipType("PASS")));
        nodes.add(n);
      }
      var definition =
          FlowEngine.defService()
              .importDef(
                  new DefJson()
                      .setFlowCode(code)
                      .setFlowName("家风试点评审")
                      .setVersion("1")
                      .setModelValue("CLASSICS")
                      .setFormCustom("Y")
                      .setNodeList(nodes));
      FlowEngine.defService().publish(definition.getId());
    }
    var instance =
        FlowEngine.insService()
            .start(
                revisionId,
                FlowParams.build()
                    .flowCode(code)
                    .handler(Long.toString(operator))
                    .nextHandler(Long.toString(operator))
                    .variable(m("jiafeng", true, "revisionId", revisionId)));
    var tasks = FlowEngine.taskService().getByInsId(instance.getId());
    require(tasks.size() == 1, 500, "FLOW_CONFIGURATION", "流程初始任务异常");
    if (tasks.getFirst().getNodeCode().equals("stage0"))
      FlowEngine.taskService()
          .skip(
              tasks.getFirst().getId(),
              FlowParams.build()
                  .handler(Long.toString(operator))
                  .permissionFlag(List.of(Long.toString(operator)))
                  .skipType("PASS")
                  .message("通过初审")
                  .nextHandler(Long.toString(operator)));
    return instance.getId().toString();
  }

  public Map<String, Object> assign(String instance, long expert, long operator) {
    var tasks = FlowEngine.taskService().getByInsId(Long.parseLong(instance));
    require(tasks.size() == 1, 409, "FLOW_FINISHED", "当前流程没有可分配任务");
    var task = tasks.getFirst();
    FlowEngine.taskService()
        .updateHandler(
            task.getId(),
            FlowParams.build()
                .handler(Long.toString(operator))
                .ignore(true)
                .addHandlers(List.of(Long.toString(expert))));
    return m(
        "flowTaskId",
        task.getId().toString(),
        "stage",
        task.getNodeName(),
        "nodeCode",
        task.getNodeCode());
  }

  public int complete(
      String instance, String taskId, long expert, long nextOperator, String comment) {
    FlowEngine.taskService()
        .skip(
            Long.parseLong(taskId),
            FlowParams.build()
                .handler(Long.toString(expert))
                .permissionFlag(List.of(Long.toString(expert)))
                .skipType("PASS")
                .message(comment)
                .nextHandler(Long.toString(nextOperator)));
    var tasks = FlowEngine.taskService().getByInsId(Long.parseLong(instance));
    return tasks.isEmpty() ? 6 : Integer.parseInt(tasks.getFirst().getNodeCode().substring(5));
  }

  public void terminate(String instance, long actor, String reason) {
    if (instance.isBlank()) return;
    if (!FlowEngine.taskService().getByInsId(Long.parseLong(instance)).isEmpty())
      FlowEngine.taskService()
          .terminationByInsId(
              Long.parseLong(instance),
              FlowParams.build().handler(Long.toString(actor)).ignore(true).message(reason));
  }

  public int currentStage(String instance) {
    var tasks = FlowEngine.taskService().getByInsId(Long.parseLong(instance));
    return tasks.isEmpty() ? 6 : Integer.parseInt(tasks.getFirst().getNodeCode().substring(5));
  }

  public boolean finished(String instance) {
    return !instance.isBlank()
        && FlowEngine.taskService().getByInsId(Long.parseLong(instance)).isEmpty();
  }
}
