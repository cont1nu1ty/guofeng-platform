package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.HandlerMapping;

class JfRequestAuditTest {
  @Test void successAndFailureShareServerGeneratedCorrelationWithoutLoggingBodiesOrQueries() throws Exception {
    var request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
    request.setServletPath("/api/v1/auth/login");
    request.addHeader("X-Request-Id", "untrusted-request-id");
    request.setQueryString("secret=private-query");
    request.setContent("private-password-and-body".getBytes());
    request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/v1/auth/login");
    var response = new MockHttpServletResponse();
    var logger = (Logger) LoggerFactory.getLogger(JfRequestAuditFilter.class);
    var events = new ListAppender<ILoggingEvent>();
    events.start(); logger.addAppender(events);
    try {
      new JfRequestAuditFilter().doFilter(request, response, (req, res) -> {
        var result = new JfErrors().domain(error(401, "INVALID_CREDENTIALS", "账号或密码错误"), request);
        assertEquals(response.getHeader("X-Request-Id"), result.getBody().get("requestId"));
        response.setStatus(result.getStatusCode().value());
      });
      assertTrue(response.getHeader("X-Request-Id").startsWith("req_"));
      assertNotEquals("untrusted-request-id", response.getHeader("X-Request-Id"));
      assertNull(MDC.get("requestId"));
      assertEquals(1, events.list.size());
      String line = events.list.getFirst().getFormattedMessage();
      assertTrue(line.contains("status=401"));
      assertTrue(line.contains(response.getHeader("X-Request-Id")));
      assertFalse(line.contains("private-query"));
      assertFalse(line.contains("private-password"));
    } finally { logger.detachAppender(events); events.stop(); }
  }

  @Test void successfulAuditAddsCorrelationWithoutMutatingDomainDetails() {
    var request = new MockHttpServletRequest();
    var attributes = new ServletRequestAttributes(request);
    RequestContextHolder.setRequestAttributes(attributes);
    try {
      var db = mock(JdbcTemplate.class);
      var details = Map.<String,Object>of("version", 2);
      new JfStore(db).audit(JfAccessTest.actor("content_operator", "content:write"),
          "content.saved", "C1", "zhejiang", details);
      verify(db).update(startsWith("INSERT INTO jf_audit"), anyString(), eq(7L), eq("zhejiang"),
          eq("content.saved"), eq("C1"), argThat((Object value) -> {
            var recorded = parse(String.valueOf(value));
            return number(recorded.get("version")) == 2 && recorded.get("requestId").equals(JfRequestAuditFilter.requestId(request));
          }));
      assertFalse(details.containsKey("requestId"));
    } finally { RequestContextHolder.resetRequestAttributes(); }
  }

  @Test void unexpectedErrorsExposeAndLogTypeOnly() {
    var logger = (Logger) LoggerFactory.getLogger(JfErrors.class);
    var events = new ListAppender<ILoggingEvent>();
    events.start(); logger.addAppender(events);
    try {
      var result = new JfErrors().unexpected(new IllegalStateException("private-model-input api-key"));
      assertEquals(500, result.getStatusCode().value());
      assertFalse(result.getBody().toString().contains("private-model-input"));
      assertEquals(1, events.list.size());
      assertTrue(events.list.getFirst().getFormattedMessage().contains("IllegalStateException"));
      assertFalse(events.list.getFirst().getFormattedMessage().contains("api-key"));
      assertNull(events.list.getFirst().getThrowableProxy());
    } finally { logger.detachAppender(events); events.stop(); }
  }
}
