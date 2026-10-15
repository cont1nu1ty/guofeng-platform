package org.dromara.jiafeng;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class JfDownloadLinksTest {
  private static final String PRIMARY = "http://192.0.2.10:19340";
  private static final String IPV6 = "http://[2001:db8::10]:19340";

  private JfDownloadLinks links(String alternate) {
    return new JfDownloadLinks(PRIMARY, alternate, "test-key", "test-secret");
  }

  private MockHttpServletRequest request(String host) {
    var request = new MockHttpServletRequest();
    if (host != null) request.addHeader("Host", host);
    return request;
  }

  private URI signed(JfDownloadLinks links, MockHttpServletRequest request) {
    return URI.create(links.url("private-files", "member/example.pdf", request));
  }

  @Test
  void ipv4AndDomainHostsKeepTheConfiguredPrimaryEndpoint() {
    try (var links = links(IPV6)) {
      for (String host : List.of("192.0.2.10", "192.0.2.10:19084", "localhost:19084",
          "platform.example", "unknown.attacker.example:19084")) {
        assertEquals("192.0.2.10:19340", signed(links, request(host)).getRawAuthority(), host);
      }
    }
  }

  @Test
  void bracketedIpv6HostsUseConfiguredIpv6EndpointWithItsOwnPort() {
    try (var links = links(IPV6)) {
      for (String host : List.of("[2001:db8::10]", "[2001:db8::10]:19084",
          "[2001:0db8:0000:0000:0000:0000:0000:0010]:443", "[::1]:19084",
          "[::ffff:192.0.2.10]:19084")) {
        assertEquals("[2001:db8::10]:19340", signed(links, request(host)).getRawAuthority(), host);
      }
    }
  }

  @Test
  void anUnknownIpv6HostNeverBecomesTheSignatureTarget() {
    try (var links = links(IPV6)) {
      assertEquals("[2001:db8::10]:19340",
          signed(links, request("[2001:db8:bad::1]:12345")).getRawAuthority());
    }
  }

  @Test
  void malformedOrAmbiguousAuthoritiesFallBackToPrimary() {
    try (var links = links(IPV6)) {
      for (String host : List.of("", "2001:db8::10", "[not-ipv6]:19084", "[2001:db8:::10]",
          "[127.0.0.1]", "[::1]:", "[::1]:65536", "[::1]:-1", "[::1]:port",
          "http://[::1]:19084", "[::1]@evil.example", "[::1]/path", "[::1]?query=1",
          "[::1]#fragment", "[::1],evil.example", " [::1] ", "[::1%25zone]:19084")) {
        assertEquals("192.0.2.10:19340", signed(links, request(host)).getRawAuthority(), host);
      }
    }
  }

  @Test
  void forwardedHeadersCannotSelectOrReplaceTheSignatureEndpoint() {
    try (var links = links(IPV6)) {
      var request = request("192.0.2.10:19084");
      request.addHeader("Forwarded", "host=\"[2001:db8::10]:19084\";proto=https");
      request.addHeader("X-Forwarded-Host", "[2001:db8::10]:19084");
      request.addHeader("X-Forwarded-Proto", "https");
      assertEquals(PRIMARY, signed(links, request).getScheme() + "://" + signed(links, request).getRawAuthority());
      request.removeHeader("Host");
      assertEquals("192.0.2.10:19340", signed(links, request).getRawAuthority());
    }
  }

  @Test
  void missingRequestAndMissingHostUsePrimary() {
    try (var links = links(IPV6)) {
      assertEquals("192.0.2.10:19340", signed(links, null).getRawAuthority());
      assertEquals("192.0.2.10:19340", signed(links, request(null)).getRawAuthority());
    }
  }

  @Test
  void optionalEmptyConfigurationPreservesExistingIpv6RequestBehavior() {
    for (String config : List.of("", " ")) {
      try (var links = links(config)) {
        assertEquals("192.0.2.10:19340", signed(links, request("[2001:db8::10]:19084")).getRawAuthority());
      }
    }
  }

  @Test
  void alternateConfigurationMustBeAnHttpIpv6Origin() {
    for (String config : List.of("http://evil.example", "http://192.0.2.10:19340",
        "ftp://[2001:db8::10]:19340", "http://user:password@[2001:db8::10]:19340",
        "http://[2001:db8::10]:19340/storage", "http://[2001:db8::10]:19340?q=1",
        "http://[2001:db8::10]:19340#fragment", "http://[2001:db8::10]:65536")) {
      assertThrows(IllegalArgumentException.class, () -> links(config), config);
    }
  }

  @Test
  void bothSignaturesBindTheBucketObjectAndFiveMinuteExpiry() {
    try (var links = links(IPV6)) {
      for (String host : List.of("192.0.2.10:19084", "[2001:db8::10]:19084")) {
        URI url = signed(links, request(host));
        assertEquals("/private-files/member/example.pdf", url.getPath());
        assertTrue(url.getRawQuery().contains("X-Amz-Expires=300"));
        assertTrue(url.getRawQuery().contains("X-Amz-SignedHeaders=host"));
        assertTrue(url.getRawQuery().contains("X-Amz-Signature="));
      }
    }
  }

  @Test
  void configuredIpv6HttpsAndPortRemainUnchanged() {
    try (var links = links("https://[2001:db8::10]:9443/")) {
      URI url = signed(links, request("[2001:db8::10]:19084"));
      assertEquals("https", url.getScheme());
      assertEquals("[2001:db8::10]:9443", url.getRawAuthority());
      assertEquals("/private-files/member/example.pdf", url.getPath());
    }
  }
}
