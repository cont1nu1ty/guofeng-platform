package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/** Internal authenticated transport. Provider credentials and URLs never enter user payloads/logs. */
@Service
public class JfAiClient {
  private final RestClient client;
  private final RestClient statusClient;
  private final boolean configured;

  public JfAiClient(@Value("${JIAFENG_AI_ENDPOINT:http://ai:8090}") String endpoint,
      @Value("${JIAFENG_AI_SERVICE_KEY:}") String key) {
    configured = !key.isBlank() && !endpoint.isBlank();
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(3));
    factory.setReadTimeout(Duration.ofSeconds(150));
    var fast = new SimpleClientHttpRequestFactory();
    fast.setConnectTimeout(Duration.ofSeconds(2));
    fast.setReadTimeout(Duration.ofSeconds(3));
    client = RestClient.builder().baseUrl(endpoint).requestFactory(factory)
        .defaultHeader("X-AI-Service-Key", key).build();
    statusClient = RestClient.builder().baseUrl(endpoint).requestFactory(fast)
        .defaultHeader("X-AI-Service-Key", key).build();
  }

  public Map<String, Object> status() {
    if (configured) try {
      var response = parse(statusClient.get().uri("/v1/status").retrieve().body(String.class));
      return m("enabled", bool(response.get("enabled")), "provider", str(response, "provider"),
          "model", str(response, "model"), "ocrEnabled", bool(response.get("ocrEnabled")),
          "external", bool(response.get("external")));
    } catch (RuntimeException ignored) { /* Never expose transport errors containing secrets. */ }
    return m("enabled", false, "provider", "unavailable", "model", "", "ocrEnabled", false, "external", false);
  }

  public Map<String, Object> call(String operation, Map<String, Object> payload) {
    require(configured, 503, "AI_NOT_CONFIGURED", "AI 服务尚未配置");
    try {
      return parse(client.post().uri("/v1/" + operation)
          .contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(json(payload))
          .retrieve().body(String.class));
    } catch (RestClientResponseException error) {
      // Messages are chosen locally; remote bodies may echo prompts or authentication material.
      int status = error.getStatusCode().value();
      String code = "AI_PROVIDER_ERROR";
      try { code = str(parse(error.getResponseBodyAsString()), "code"); }
      catch (RuntimeException ignored) { /* Invalid remote JSON never reaches callers. */ }
      String message = switch (code) {
        case "AI_CREDENTIAL_INVALID" -> "模型身份校验失败，请联系管理员更新配置";
        case "AI_RATE_LIMITED", "AI_BUSY" -> "AI服务繁忙或额度不足，请稍后重试";
        case "AI_NOT_CONFIGURED", "AI_CONFIG_INVALID" -> "模型尚未配置，请联系管理员";
        case "AI_OCR_NOT_CONFIGURED" -> "OCR模型尚未配置，请联系管理员";
        case "AI_OCR_EMPTY" -> "未识别到有效文字，请更换清晰文件重试";
        case "AI_OCR_PDF_UNSUPPORTED" -> "当前OCR接口仅支持图片，请将PDF转换为图片";
        case "AI_FILE_UNSUPPORTED" -> "文件类型不支持，旧版DOC请先转换为DOCX";
        case "AI_FILE_INVALID", "AI_DOCUMENT_INVALID" -> "文件无法解析，请检查文件后重试";
        case "AI_FILE_TOO_LARGE", "AI_RESPONSE_TOO_LARGE" -> "文件或模型结果过大，请缩小输入范围";
        case "AI_DOCUMENT_TIMEOUT", "AI_UNAVAILABLE" -> "模型连接或文档解析超时，请稍后重试";
        case "AI_OUTPUT_TRUNCATED" -> "模型输出达到长度限制，请缩小任务后重试";
        case "AI_RESPONSE_INVALID", "AI_REPORT_INVALID" -> "模型返回格式不正确，请重试";
        case "AI_CONTENT_BLOCKED" -> "内容命中平台拦截词，请调整后重试";
        default -> null;
      };
      if (message == null) { code = status == 429 ? "AI_BUSY" : "AI_PROVIDER_ERROR"; message = "AI服务未完成请求，请稍后重试"; }
      throw Jf.error(503, code, message);
    } catch (RuntimeException error) {
      throw Jf.error(503, "AI_UNAVAILABLE", "AI 服务暂不可用或处理超时，请稍后重试");
    }
  }
}
