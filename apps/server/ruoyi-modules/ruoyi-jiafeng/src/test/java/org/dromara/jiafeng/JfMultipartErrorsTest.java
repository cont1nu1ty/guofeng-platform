package org.dromara.jiafeng;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import tools.jackson.databind.json.JsonMapper;

class JfMultipartErrorsTest {
  private final JfMultipartErrors resolver = new JfMultipartErrors(JsonMapper.builder().build());

  @Test
  void oversizedUploadBeforeControllerSelectionHasReal413() throws Exception {
    var request = new MockHttpServletRequest("POST", "/api/v1/files");
    var response = new MockHttpServletResponse();
    var result =
        resolver.resolveException(
            request, response, null, new MaxUploadSizeExceededException(50L * 1024 * 1024));
    assertNotNull(result);
    assertEquals(413, response.getStatus());
    assertEquals("application/json;charset=UTF-8", response.getContentType());
    assertEquals("no-store", response.getHeader("Cache-Control"));
    String body = response.getContentAsString();
    assertTrue(body.contains("\"code\":\"FILE_TOO_LARGE\""));
    assertTrue(body.contains("\"requestId\":\"req_"));
  }

  @Test
  void malformedUploadDoesNotLeakInternalCause() throws Exception {
    var request = new MockHttpServletRequest("POST", "/api/v1/files");
    var response = new MockHttpServletResponse();
    assertNotNull(
        resolver.resolveException(
            request,
            response,
            null,
            new MultipartException("sensitive-object-key /private/upload/path")));
    assertEquals(400, response.getStatus());
    String body = response.getContentAsString();
    assertTrue(body.contains("INVALID_REQUEST"));
    assertFalse(body.contains("sensitive-object-key"));
    assertFalse(body.contains("/private/upload/path"));
  }

  @Test
  void nativeRuoyiUploadIsLeftToItsExistingResolver() {
    var request = new MockHttpServletRequest("POST", "/resource/oss/upload");
    var response = new MockHttpServletResponse();
    assertNull(
        resolver.resolveException(
            request, response, null, new MaxUploadSizeExceededException(50L * 1024 * 1024)));
    assertEquals(200, response.getStatus());
    assertEquals(0, response.getContentAsByteArray().length);
  }

  @Test
  void domainErrorsRemainHandledByControllerAdvice() {
    var request = new MockHttpServletRequest("POST", "/api/v1/files");
    var response = new MockHttpServletResponse();
    assertNull(
        resolver.resolveException(
            request, response, null, Jf.error(422, "INVALID_FILE_TYPE", "格式无效")));
    assertEquals(0, response.getContentAsByteArray().length);
  }

  @Test
  void apiPrefixIsResolvedRelativeToServletContext() {
    var request = new MockHttpServletRequest("POST", "/platform/api/v1/files");
    request.setContextPath("/platform");
    var response = new MockHttpServletResponse();
    assertNotNull(
        resolver.resolveException(
            request, response, null, new MaxUploadSizeExceededException(50L * 1024 * 1024)));
    assertEquals(413, response.getStatus());
  }
}
