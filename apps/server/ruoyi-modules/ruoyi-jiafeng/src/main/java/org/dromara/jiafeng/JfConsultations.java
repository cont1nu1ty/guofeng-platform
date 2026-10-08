package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;

/** Human follow-up and non-binding quotations, separate from public-welfare fulfilment. */
@Service
public class JfConsultations {
  private final JfStore store; private final JfAuth auth;
  public JfConsultations(JfStore store, JfAuth auth) { this.store = store; this.auth = auth; }
  static final Map<String,String> STAGES = Map.of("accepted", "已受理", "discussion", "沟通中", "quoted", "已报价", "closed", "已结束");
  static Map<String,Object> validate(Map<String,Object> input) {
    String stage = str(input,"stage"), note = required(input,"note",2,2000);
    require(STAGES.containsKey(stage),422,"CONSULTATION_STAGE","请选择有效的咨询阶段");
    String raw = str(input,"quoteAmount").trim(), description = required(input,"quoteDescription",0,2000);
    BigDecimal amount = null;
    if (!raw.isEmpty()) {
      require(raw.matches("(?:0|[1-9][0-9]{0,11})(?:\\.[0-9]{1,2})?"),422,"QUOTE_AMOUNT","报价金额须为非负数，最多两位小数");
      amount = new BigDecimal(raw);
    }
    require(!stage.equals("quoted") || (amount != null && description.length() >= 5),422,"QUOTE_REQUIRED","报价阶段须填写金额与至少5字的服务范围说明");
    require(stage.equals("quoted") || (amount == null && description.isEmpty()),422,"QUOTE_STAGE","只有报价阶段可以记录报价明细");
    return m("stage",stage,"note",note,"quoteAmount",amount,"quoteDescription",description);
  }
  private JfStore.Entity claim(JfAuth.Actor actor,String id,boolean admin,boolean lock) {
    var claim = store.find("claim",id,lock);
    require("custom".equals(str(claim.data(),"kind")),404,"NOT_FOUND","定制咨询不存在");
    if (admin) auth.operate(actor,claim.region()); else require(Objects.equals(claim.owner(),actor.id),404,"NOT_FOUND","定制咨询不存在");
    return claim;
  }
  public Object get(JfAuth.Actor actor,String id,boolean admin) {
    var claim = claim(actor,id,admin,false);
    var history = store.db().queryForList("SELECT id,stage,note,quote_amount,quote_description,created_at FROM jf_consultation_event WHERE claim_id=? ORDER BY created_at,id",id)
        .stream().map(row -> m("id",row.get("id"),"stage",row.get("stage"),"note",row.get("note"),"quoteAmount",row.get("quote_amount"),"quoteDescription",row.get("quote_description"),"createdAt",timestamp(row.get("created_at")))).toList();
    return m("id",id,"version",claim.version(),"cancelled",claim.status().equals("已取消"),"stage",claim.data().getOrDefault("consultationStage","pending"),"events",history,
        "notice","咨询报价用于沟通，不构成付款、商业订单或物流承诺。跟进记录会展示给申请人。");
  }
  public Object followUp(JfAuth.Actor actor,String id,Map<String,Object> input) {
    var claim = claim(actor,id,true,true); store.checkVersion(claim,input.get("version"));
    require(!claim.status().equals("已取消"),409,"CONSULTATION_CANCELLED","申请人已取消咨询，不能继续处理");
    var clean = validate(input); String stage = str(clean,"stage");
    store.db().update("INSERT INTO jf_consultation_event(id,claim_id,actor_id,stage,note,quote_amount,quote_description) VALUES(?,?,?,?,?,?,?)",
        id("consult_"),id,actor.id,stage,clean.get("note"),clean.get("quoteAmount"),clean.get("quoteDescription"));
    var data = copy(claim.data()); data.put("consultationStage",stage);
    store.save(claim,claim.region(),claim.status(),data);
    store.audit(actor,"consultation.followup",id,claim.region(),m("stage",stage,"hasQuote",clean.get("quoteAmount") != null));
    store.notifyUser(claim.owner(),claim.region(),"定制咨询更新",STAGES.get(stage) + "：" + str(clean,"note"),"");
    return get(actor,id,true);
  }
}
