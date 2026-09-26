package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice(basePackages = "org.dromara.jiafeng")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JfErrors {
  private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(JfErrors.class);

  @ExceptionHandler(Jf.ApiException.class)
  public ResponseEntity<Map<String, Object>> domain(Jf.ApiException e, HttpServletRequest request) {
    return ResponseEntity.status(e.status)
        .body(m("code", e.code, "message", e.getMessage(), "requestId", id("req_")));
  }

  @ExceptionHandler(cn.dev33.satoken.exception.NotLoginException.class)
  public ResponseEntity<Map<String, Object>> login(Exception e) {
    return ResponseEntity.status(401)
        .body(m("code", "UNAUTHENTICATED", "message", "登录已失效，请重新登录", "requestId", id("req_")));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<Map<String, Object>> size(Exception e) {
    return ResponseEntity.status(413)
        .body(m("code", "FILE_TOO_LARGE", "message", "文件超过允许大小", "requestId", id("req_")));
  }

  @ExceptionHandler({
    org.springframework.http.converter.HttpMessageNotReadableException.class,
    org.springframework.web.bind.MissingServletRequestParameterException.class,
    org.springframework.web.multipart.support.MissingServletRequestPartException.class
  })
  public ResponseEntity<Map<String, Object>> input(Exception e) {
    return ResponseEntity.status(400)
        .body(m("code", "INVALID_REQUEST", "message", "请求格式不正确或缺少必填字段", "requestId", id("req_")));
  }

  @ExceptionHandler(org.springframework.dao.ConcurrencyFailureException.class)
  public ResponseEntity<Map<String, Object>> conflict(Exception e) {
    return ResponseEntity.status(409)
        .body(m("code", "CONCURRENT_UPDATE", "message", "同时有其他操作，请刷新后重试", "requestId", id("req_")));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> unexpected(Exception e) {
    String requestId = id("req_");
    LOG.error("Jiafeng API failure {}", requestId, e);
    return ResponseEntity.status(500)
        .body(m("code", "INTERNAL_ERROR", "message", "操作未完成，请稍后重试或联系管理员", "requestId", requestId));
  }
}
