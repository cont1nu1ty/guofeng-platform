package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import tools.jackson.databind.json.JsonMapper;

class JfAiClientTest {
  private HttpServer server;
  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  @AfterEach void close() { if (server != null) server.stop(0); }

  private JfAiClient service(int code, Map<String, Object> body) throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      assertEquals("internal-test-key", exchange.getRequestHeaders().getFirst("X-AI-Service-Key"));
      byte[] bytes = json(body).getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(code, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
    server.start();
    return new JfAiClient("http://127.0.0.1:" + server.getAddress().getPort(), "internal-test-key");
  }

  @Test void credentialFailureRetainsStableCodeWithoutRemoteErrorBody() throws Exception {
    var client = service(502, m("code", "AI_CREDENTIAL_INVALID", "message", "secret-key-and-private-text"));
    var error = assertThrows(ApiException.class, () -> client.call("generate", m("prompt", "private")));
    assertEquals("AI_CREDENTIAL_INVALID", error.code);
    assertFalse(error.getMessage().contains("secret")); assertFalse(error.getMessage().contains("private"));
  }

  @Test void untrustedRemoteErrorsUseGenericLocalMessage() throws Exception {
    var client = service(500, m("code", "echo_private_prompt", "message", "raw-provider-token"));
    var error = assertThrows(ApiException.class, () -> client.call("generate", m()));
    assertEquals("AI_PROVIDER_ERROR", error.code); assertFalse(error.getMessage().contains("raw-provider"));
  }

  @Test void statusExposesOnlyPublicConfigurationFields() throws Exception {
    var client = service(200, m("enabled", true, "provider", "local", "model", "model-v1",
        "external", false, "ocrEnabled", true, "apiKey", "not-public", "endpoint", "internal-url"));
    var status = client.status();
    assertEquals(true, status.get("enabled"));
    assertFalse(status.containsKey("apiKey")); assertFalse(status.containsKey("endpoint"));
  }
}
