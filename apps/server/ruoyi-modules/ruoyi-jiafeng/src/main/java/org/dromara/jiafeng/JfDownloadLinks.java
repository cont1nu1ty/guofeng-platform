package org.dromara.jiafeng;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/** Signs only deployment-configured storage endpoints, never an incoming request authority. */
final class JfDownloadLinks implements AutoCloseable {
  private final S3Presigner primary;
  private final S3Presigner ipv6;

  JfDownloadLinks(String publicEndpoint, String publicIpv6Endpoint, String key, String secret) {
    URI alternate = null;
    if (publicIpv6Endpoint != null && !publicIpv6Endpoint.isBlank()) {
      alternate = URI.create(publicIpv6Endpoint);
      if (!java.util.Set.of("http", "https").contains(
              String.valueOf(alternate.getScheme()).toLowerCase(Locale.ROOT))
          || !isIpv6Authority(alternate.getRawAuthority())
          || !(alternate.getRawPath().isEmpty() || alternate.getRawPath().equals("/"))
          || alternate.getRawQuery() != null || alternate.getRawFragment() != null) {
        throw new IllegalArgumentException("JIAFENG_S3_PUBLIC_IPV6_ENDPOINT must be an HTTP(S) IPv6 origin");
      }
    }
    primary = signer(URI.create(publicEndpoint), key, secret);
    ipv6 = alternate == null ? null : signer(alternate, key, secret);
  }

  String url(String bucket, String objectKey, HttpServletRequest request) {
    // Forwarded headers are deliberately ignored. Host selects between two trusted configurations;
    // even a forged IPv6 Host cannot redirect a signature to an attacker-controlled endpoint.
    S3Presigner selected = ipv6 != null && request != null
        && isIpv6Authority(request.getHeader("Host")) ? ipv6 : primary;
    return selected.presignGetObject(r -> r.signatureDuration(Duration.ofMinutes(5))
        .getObjectRequest(o -> o.bucket(bucket).key(objectKey))).url().toExternalForm();
  }

  private static boolean isIpv6Authority(String authority) {
    if (authority == null || !authority.matches("\\[[0-9a-fA-F:.]+\\](?::[0-9]{1,5})?")) return false;
    try {
      // URI parses numeric IPv6 syntax without resolving a hostname or making a network request.
      URI parsed = URI.create("http://" + authority);
      return parsed.getHost() != null && parsed.getHost().startsWith("[")
          && parsed.getHost().contains(":") && parsed.getPort() <= 65535;
    } catch (IllegalArgumentException invalid) {
      return false;
    }
  }

  private static S3Presigner signer(URI endpoint, String key, String secret) {
    return S3Presigner.builder().endpointOverride(endpoint).region(Region.US_EAST_1)
        .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(key, secret)))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build()).build();
  }

  @Override
  public void close() {
    primary.close();
    if (ipv6 != null) ipv6.close();
  }
}
