package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.id;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.dromara.common.satoken.utils.LoginHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

/** Bounded, body-free denial logs remain visible even when a write transaction rolls back. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class JfRequestAuditFilter extends OncePerRequestFilter {
  private static final Logger LOG = LoggerFactory.getLogger(JfRequestAuditFilter.class);
  static final String REQUEST_ID = JfRequestAuditFilter.class.getName() + ".requestId";

  static String requestId(HttpServletRequest request) {
    Object value = request.getAttribute(REQUEST_ID);
    if (value instanceof String text) return text;
    String generated = id("req_");
    request.setAttribute(REQUEST_ID, generated);
    return generated;
  }

  static String currentRequestId() {
    if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)
      return requestId(attributes.getRequest());
    return "";
  }

  @Override protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getServletPath().startsWith("/api/v1/");
  }

  @Override protected void doFilterInternal(HttpServletRequest request,
      HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    String requestId = requestId(request);
    response.setHeader("X-Request-Id", requestId);
    String previous = MDC.get("requestId");
    MDC.put("requestId", requestId);
    try {
      chain.doFilter(request, response);
    } finally {
      if (response.getStatus() >= 400) {
        // Route templates omit verification codes, signed queries and private filenames.
        Object route = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        Object variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        Object target = variables instanceof Map<?, ?> values ? values.get("id") : null;
        String subject = "anonymous";
        try {
          var user = LoginHelper.getLoginUser();
          if (user != null) subject = String.valueOf(user.getUserId());
        } catch (Exception ignored) { subject = "unavailable"; }
        LOG.warn("security_request requestId={} subject={} method={} route={} target={} status={}",
            requestId, subject, safe(request.getMethod()), safe(route), safe(target), response.getStatus());
      }
      if (previous == null) MDC.remove("requestId"); else MDC.put("requestId", previous);
    }
  }

  private static String safe(Object value) {
    if (value == null) return "-";
    String text = String.valueOf(value).replaceAll("[\\r\\n\\t]", "_");
    return text.substring(0, Math.min(text.length(), 160));
  }
}
