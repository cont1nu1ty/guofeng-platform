package org.dromara.jiafeng;
import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
class JfConsultationsTest {
  @Test void quotePreservesExactDecimalAndRequiresDescribedScope() {
    var result=JfConsultations.validate(m("stage","quoted","note","与申请人确认参考范围","quoteAmount","1200.50","quoteDescription","参考价含排版与印制，七日内有效。"));
    assertEquals(new BigDecimal("1200.50"),result.get("quoteAmount"));
    assertThrows(ApiException.class,()->JfConsultations.validate(m("stage","quoted","note","参考报价","quoteAmount","1200","quoteDescription","短")));
  }
  @Test void refusesNegativeFractionalOrOverflowPricesAndNonQuoteStagePrices() {
    for(String amount:new String[]{"-1","1.001","1e3","9999999999999","NaN"})
      assertThrows(ApiException.class,()->JfConsultations.validate(m("stage","quoted","note","参考报价","quoteAmount",amount,"quoteDescription","完整报价范围说明")));
    assertThrows(ApiException.class,()->JfConsultations.validate(m("stage","discussion","note","继续人工沟通","quoteAmount","100")));
    assertThrows(ApiException.class,()->JfConsultations.validate(m("stage","paid","note","未接入支付，不支持付款状态")));
  }
  @Test void ordinaryFollowUpDoesNotInventAnOrderOrQuote() {
    var result=JfConsultations.validate(m("stage","discussion","note","请补充尺寸后人工沟通方案"));
    assertNull(result.get("quoteAmount"));assertFalse(result.containsKey("orderId"));
  }
}
