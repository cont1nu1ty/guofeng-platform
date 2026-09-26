package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import jakarta.annotation.PreDestroy;
import java.io.*;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.zip.ZipFile;
import org.dromara.common.oss.client.DefaultOssClientImpl;
import org.dromara.common.oss.client.OssClient;
import org.dromara.common.oss.config.OssClientConfig;
import org.dromara.common.oss.properties.OssProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class JfFiles {
  private final JfStore store;
  private final JfAuth auth;
  private final OssClient oss;
  private final software.amazon.awssdk.services.s3.presigner.S3Presigner downloads;
  private final String bucket;

  public JfFiles(
      JfStore store,
      JfAuth auth,
      @Value("${JIAFENG_S3_ENDPOINT:http://storage:8333}") String endpoint,
      @Value("${JIAFENG_S3_PUBLIC_ENDPOINT:http://127.0.0.1:18333}") String publicEndpoint,
      @Value("${JIAFENG_S3_ACCESS_KEY:}") String key,
      @Value("${JIAFENG_S3_SECRET_KEY:}") String secret,
      @Value("${JIAFENG_S3_BUCKET:jiafeng-private}") String bucket) {
    this.store = store;
    this.auth = auth;
    this.bucket = bucket;
    OssProperties p = new OssProperties();
    p.setEndpoint(endpoint);
    p.setAccessKey(key);
    p.setSecretKey(secret);
    p.setBucketName(bucket);
    p.setRegion("us-east-1");
    p.setIsHttps(endpoint.startsWith("https:") ? "Y" : "N");
    p.setAccessPolicy("0");
    oss =
        new DefaultOssClientImpl(
            "jiafeng-private",
            OssClientConfig.formProperties(p).toBuilder().usePathStyleAccess(true).build());
    // The upstream custom-domain mode means bucket-bound CDN. Our public endpoint is
    // an S3 gateway, so sign its complete path with the same AWS SDK, including bucket.
    downloads =
        software.amazon.awssdk.services.s3.presigner.S3Presigner.builder()
            .endpointOverride(java.net.URI.create(publicEndpoint))
            .region(software.amazon.awssdk.regions.Region.US_EAST_1)
            .credentialsProvider(
                software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
                    software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create(
                        key, secret)))
            .serviceConfiguration(
                software.amazon.awssdk.services.s3.S3Configuration.builder()
                    .pathStyleAccessEnabled(true)
                    .build())
            .build();
  }

  @PreDestroy
  public void close() throws Exception {
    oss.close();
    downloads.close();
  }

  @org.springframework.transaction.annotation.Transactional(
      rollbackFor = Exception.class,
      isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public Map<String, Object> upload(MultipartFile file, String purpose) throws Exception {
    var actor = auth.require();
    require(Set.of("manuscript", "media").contains(purpose), 422, "INVALID_PURPOSE", "上传用途无效");
    boolean media = purpose.equals("media");
    require(
        file.getSize() > 0 && file.getSize() <= (media ? 50L : 10L) * 1024 * 1024,
        413,
        "FILE_TOO_LARGE",
        media ? "媒体文件须在50MB以内" : "文件须在10MB以内");
    String name = Objects.requireNonNullElse(file.getOriginalFilename(), "file").replace('\\', '/');
    name = name.substring(name.lastIndexOf('/') + 1);
    require(
        !name.isBlank() && name.length() <= 200 && !name.chars().anyMatch(c -> c < 32),
        422,
        "INVALID_FILENAME",
        "文件名无效");
    String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    require(
        (media
                ? Set.of("png", "jpg", "jpeg", "mp4", "mp3", "wav")
                : Set.of("png", "jpg", "jpeg", "pdf", "doc", "docx"))
            .contains(ext),
        422,
        "INVALID_FILE_TYPE",
        media ? "媒体上传仅接受MP4/MP3/WAV及PNG/JPEG封面" : "仅接受PNG/JPEG/PDF/Word文件");
    if (Set.of("png", "jpg", "jpeg").contains(ext))
      require(file.getSize() <= 10L * 1024 * 1024, 413, "FILE_TOO_LARGE", "图片须在10MB以内");
    Path temp = Files.createTempFile("jiafeng-upload-", "." + ext);
    String objectKey = actor.id + "/" + id("file_") + "." + ext;
    boolean uploaded = false;
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      try (InputStream in = new DigestInputStream(file.getInputStream(), digest)) {
        Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
      }
      byte[] head;
      try (InputStream in = Files.newInputStream(temp)) {
        head = in.readNBytes(16);
      }
      String magic = new String(head, java.nio.charset.StandardCharsets.ISO_8859_1);
      boolean valid =
          switch (ext) {
            case "pdf" -> magic.startsWith("%PDF-");
            case "png" ->
                head.length >= 8 && head[0] == (byte) 137 && magic.substring(1, 4).equals("PNG");
            case "jpg", "jpeg" ->
                head.length >= 3
                    && head[0] == (byte) 255
                    && head[1] == (byte) 216
                    && head[2] == (byte) 255;
            case "doc" ->
                head.length >= 8
                    && HexFormat.of().formatHex(Arrays.copyOf(head, 8)).equals("d0cf11e0a1b11ae1");
            case "docx" -> {
              try (ZipFile zip = new ZipFile(temp.toFile())) {
                yield zip.getEntry("[Content_Types].xml") != null
                    && zip.getEntry("word/document.xml") != null;
              } catch (IOException e) {
                yield false;
              }
            }
            case "mp4" -> head.length >= 12 && magic.substring(4, 8).equals("ftyp");
            case "mp3" ->
                magic.startsWith("ID3")
                    || (head.length >= 2 && head[0] == (byte) 255 && (head[1] & 0xe0) == 0xe0);
            case "wav" ->
                head.length >= 12
                    && magic.startsWith("RIFF")
                    && magic.substring(8, 12).equals("WAVE");
            default -> false;
          };
      require(valid, 422, "INVALID_FILE_TYPE", "文件内容与格式不符");
      String type =
          ext.equals("mp4")
              ? "video"
              : Set.of("mp3", "wav").contains(ext)
                  ? "audio"
                  : ext.equals("pdf") ? "pdf" : ext.startsWith("doc") ? "word" : "image";
      String mime =
          switch (ext) {
            case "pdf" -> "application/pdf";
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "doc" -> "application/msword";
            case "mp4" -> "video/mp4";
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            default -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          };
      oss.upload(objectKey, temp);
      uploaded = true;
      String id = id("file_");
      String region = actor.regions.stream().findFirst().orElse("all");
      store
          .db()
          .update(
              "INSERT INTO"
                  + " jf_file(id,owner_id,region_id,object_key,name,mime_type,file_type,size,sha256)"
                  + " VALUES(?,?,?,?,?,?,?,?,?)",
              id,
              actor.id,
              region,
              objectKey,
              name,
              mime,
              type,
              file.getSize(),
              HexFormat.of().formatHex(digest.digest()));
      store.audit(actor, "upload", id, region, m("size", file.getSize(), "type", type));
      return m(
          "id",
          id,
          "fileId",
          id,
          "name",
          name,
          "size",
          file.getSize(),
          "type",
          type,
          "mimeType",
          mime);
    } catch (Exception e) {
      if (uploaded) {
        try {
          oss.delete(objectKey);
        } catch (Exception ignored) {
          /* orphan is private; log/reconcile separately */
        }
      }
      throw e;
    } finally {
      Files.deleteIfExists(temp);
    }
  }

  public Map<String, Object> metadata(String id, long owner) {
    var row = lookup(id);
    require(number(row.get("owner_id")) == owner, 404, "NOT_FOUND", "附件不存在或不属于当前账号");
    return m(
        "id",
        id,
        "fileId",
        id,
        "name",
        row.get("name"),
        "size",
        row.get("size"),
        "type",
        row.get("file_type"),
        "mimeType",
        row.get("mime_type"));
  }

  public Map<String, Object> manuscriptMetadata(String id, long owner) {
    var file = metadata(id, owner);
    require(
        Set.of("image", "pdf", "word").contains(str(file, "type"))
            && number(file.get("size")) <= 10L * 1024 * 1024,
        422,
        "INVALID_FILE_TYPE",
        "稿件附件仅限10MB以内的图片/PDF/Word文件");
    return file;
  }

  // Internal metadata access; no controller exposes this unfiltered row.
  Map<String, Object> info(String id) {
    return lookup(id);
  }

  private Map<String, Object> lookup(String id) {
    var rows = store.db().queryForList("SELECT * FROM jf_file WHERE id=?", id);
    require(!rows.isEmpty(), 404, "NOT_FOUND", "文件不存在或不可见");
    return rows.getFirst();
  }

  public Map<String, Object> download(String id) {
    var a = auth.require();
    var f = lookup(id);
    boolean allowed = number(f.get("owner_id")) == a.id;
    if (!allowed)
      allowed =
          store.all("media").stream()
              .anyMatch(
                  e ->
                      Objects.equals(e.owner(), a.id)
                          && List.of("sourceFileId", "posterFileId").stream()
                              .anyMatch(key -> str(e.data(), key).equals(id)));
    if (!allowed && a.operator()) {
      for (var row :
          store
              .db()
              .queryForList(
                  "SELECT s.region_id FROM jf_revision_file f JOIN jf_revision r ON"
                      + " r.id=f.revision_id JOIN jf_entity s ON s.id=r.submission_id WHERE"
                      + " f.file_id=?",
                  id))
        if (a.region(text(row.get("region_id")))) {
          allowed = true;
          break;
        }
      if (!allowed)
        allowed =
            store.all("knowledge").stream()
                .anyMatch(e -> a.region(e.region()) && str(e.data(), "fileId").equals(id));
      if (!allowed)
        for (String kind : List.of("banner", "media"))
          if (store.all(kind).stream()
              .anyMatch(
                  e ->
                      a.region(e.region())
                          && List.of("sourceFileId", "posterFileId", "coverFileId").stream()
                              .anyMatch(key -> str(e.data(), key).equals(id)))) {
            allowed = true;
            break;
          }
    }
    require(allowed, 404, "NOT_FOUND", "文件不存在或不可见");
    return signed(f);
  }

  Map<String, Object> publicDownload(String id) {
    return signed(lookup(id));
  }

  private Map<String, Object> signed(Map<String, Object> f) {
    return m(
        "url",
        downloads
            .presignGetObject(
                r ->
                    r.signatureDuration(Duration.ofMinutes(5))
                        .getObjectRequest(o -> o.bucket(bucket).key(str(f, "object_key"))))
            .url()
            .toExternalForm(),
        "expiresIn",
        300,
        "name",
        f.get("name"));
  }
}
