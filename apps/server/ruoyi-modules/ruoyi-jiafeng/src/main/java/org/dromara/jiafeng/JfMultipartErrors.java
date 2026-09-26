package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.ModelAndView;
import tools.jackson.databind.json.JsonMapper;

/** Multipart parsing can fail before Spring has selected a controller/advice package. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JfMultipartErrors implements HandlerExceptionResolver {
  private final JsonMapper mapper;

  public JfMultipartErrors(JsonMapper mapper) {
    this.mapper = mapper;
  }

  @Override
  public ModelAndView resolveException(
      HttpServletRequest request,
      HttpServletResponse response,
      Object handler,
      Exception exception) {
    String path = request.getRequestURI().substring(request.getContextPath().length());
    if (!path.startsWith("/api/v1/")
        || !(exception instanceof MultipartException)
        || response.isCommitted()) return null;
    boolean tooLarge = exception instanceof MaxUploadSizeExceededException;
    response.setStatus(tooLarge ? 413 : 400);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType("application/json");
    response.setHeader("Cache-Control", "no-store");
    try {
      response
          .getWriter()
          .write(
              mapper.writeValueAsString(
                  m(
                      "code", tooLarge ? "FILE_TOO_LARGE" : "INVALID_REQUEST",
                      "message", tooLarge ? "文件超过允许大小" : "上传格式不正确，请重新选择文件后重试",
                      "requestId", id("req_"))));
      return new ModelAndView();
    } catch (IOException ignored) {
      // The connection has already failed; no exception text or upload metadata
      // should be written to the client by a second exception resolver.
      return new ModelAndView();
    }
  }
}
