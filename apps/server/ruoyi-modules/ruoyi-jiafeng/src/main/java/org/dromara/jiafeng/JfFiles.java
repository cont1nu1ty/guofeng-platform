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
  private final JfAudio audio;
  private final JfVideo video;
  private final org.springframework.transaction.support.TransactionTemplate transaction;

  public JfFiles(
      JfStore store,
      JfAuth auth,
      JfAudio audio,
      JfVideo video,
      org.springframework.transaction.PlatformTransactionManager transactions,
      @Value("${JIAFENG_S3_ENDPOINT:http://storage:8333}") String endpoint,
      @Value("${JIAFENG_S3_PUBLIC_ENDPOINT:http://127.0.0.1:18333}") String publicEndpoint,
      @Value("${JIAFENG_S3_ACCESS_KEY:}") String key,
      @Value("${JIAFENG_S3_SECRET_KEY:}") String secret,
      @Value("${JIAFENG_S3_BUCKET:jiafeng-private}") String bucket) {
    this.store = store;
    this.auth = auth;
    this.audio = audio;
    this.video = video;
    this.transaction = new org.springframework.transaction.support.TransactionTemplate(transactions);
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

  public Map<String, Object> upload(MultipartFile file, String purpose) throws Exception {
    var actor = auth.require();
    require(Set.of("manuscript", "media", "recitation").contains(purpose), 422, "INVALID_PURPOSE", "上传用途无效");
    boolean media = purpose.equals("media");
    boolean recitation = purpose.equals("recitation");
    if (recitation) require(actor.realm.equals("member"), 403, "FORBIDDEN", "请使用会员账号上传诵读录音");
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
        (recitation
                ? Set.of("mp3", "wav", "m4a", "aac", "ogg", "webm")
                : media ? Set.of("png", "jpg", "jpeg", "mp4", "mov", "webm", "mp3", "wav")
                : Set.of("png", "jpg", "jpeg", "pdf", "doc", "docx"))
            .contains(ext),
        422,
        "INVALID_FILE_TYPE",
        recitation ? "诵读上传仅接受MP3/WAV/M4A/AAC/OGG/WebM音频" : media ? "媒体上传接受MP4/MOV/WebM视频、MP3/WAV音频及PNG/JPEG图片" : "仅接受PNG/JPEG/PDF/Word文件");
    if (Set.of("png", "jpg", "jpeg").contains(ext))
      require(file.getSize() <= 10L * 1024 * 1024, 413, "FILE_TOO_LARGE", "图片须在10MB以内");
    Path temp = Files.createTempFile("jiafeng-upload-", "." + ext);
    Path inputTemp = temp;
    String originalName = name;
    boolean convertVideo=media&&Set.of("mp4","mov","webm").contains(ext);
    String objectKey = actor.id + "/" + id("file_") + "." + (recitation ? "mp3" : convertVideo ? "mp4" : ext);
    long durationMs = 0;
    boolean uploaded = false;
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      try (InputStream in = new DigestInputStream(file.getInputStream(), digest)) {
        Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
      }
      String sourceSha256 = HexFormat.of().formatHex(digest.digest());
      if (recitation) {
        var converted = audio.convert(inputTemp);
        temp = converted.path();
        durationMs = converted.durationMs();
        ext = "mp3";
        name = originalName.substring(0, originalName.lastIndexOf('.') > 0 ? originalName.lastIndexOf('.') : originalName.length()) + ".mp3";
      }
      if(convertVideo){var converted=video.convert(inputTemp);temp=converted.path();durationMs=converted.durationMs();ext="mp4";name=originalName.substring(0,originalName.lastIndexOf('.')>0?originalName.lastIndexOf('.'):originalName.length())+".mp4";}
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
      long storedSize = Files.size(temp);
      String storedSha = sourceSha256;
      if (recitation || convertVideo) {
        MessageDigest normalizedDigest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new DigestInputStream(Files.newInputStream(temp), normalizedDigest)) {
          in.transferTo(OutputStream.nullOutputStream());
        }
        storedSha = HexFormat.of().formatHex(normalizedDigest.digest());
      }
      String finalName = name, finalSha = storedSha;
      long finalDuration = durationMs;
      transaction.executeWithoutResult(status -> {
        // Recheck the session after potentially slow conversion, then commit metadata atomically.
        auth.byId(actor.id);
        store.db().update("INSERT INTO jf_file(id,owner_id,region_id,object_key,name,mime_type,"
                + "file_type,size,sha256,purpose,duration_ms,original_name,source_sha256)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id, actor.id, region, objectKey, finalName, mime, type, storedSize, finalSha, purpose,
            recitation || convertVideo ? finalDuration : null, originalName, sourceSha256);
        store.audit(actor, recitation ? "recitation.upload" : "upload", id, region, m("size", storedSize, "type", type));
      });
      return m("id", id, "fileId", id, "name", name, "size", storedSize, "type", type,
          "mimeType", mime, "purpose", purpose, "duration", durationMs / 1000.0,
          "originalName", originalName);
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
      if (!temp.equals(inputTemp)) Files.deleteIfExists(inputTemp);
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

  public Map<String, Object> recitationMetadata(String id, long owner) {
    var row = lookup(id);
    require(number(row.get("owner_id")) == owner, 404, "NOT_FOUND", "录音不存在或不属于当前账号");
    require(str(row, "purpose").equals("recitation") && str(row, "file_type").equals("audio")
            && number(row.get("duration_ms")) > 0 && number(row.get("duration_ms")) <= 180150,
        422, "INVALID_AUDIO", "请先上传有效诵读录音");
    var result = metadata(id, owner);
    result.put("duration", number(row.get("duration_ms")) / 1000.0);
    return result;
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
    require(!str(f, "purpose").equals("generated"), 404, "NOT_FOUND", "请从对应业务记录下载文件");
    boolean allowed = number(f.get("owner_id")) == a.id;
    if (allowed && str(f, "purpose").equals("recitation")) {
      // Deleted private records revoke new download URLs unless a media submission still references it.
      var records = store.all("recitation").stream()
          .filter(e -> Objects.equals(e.owner(), a.id) && str(e.data(), "fileId").equals(id)).toList();
      if (!records.isEmpty()) allowed = records.stream().anyMatch(e -> e.status().equals("active"));
    }
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
        if (JfAccess.can(a,"submissions:read") && a.region(text(row.get("region_id")))) {
          allowed = true;
          break;
        }
      if (!allowed && JfAccess.can(a,"ai:read"))
        allowed =
            store.all("knowledge").stream()
                .anyMatch(e -> a.region(e.region()) && str(e.data(), "fileId").equals(id));
      if (!allowed && JfAccess.can(a,"content:read"))
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
    store.audit(a, "file.download", id, str(f, "region_id"), m("purpose", f.get("purpose")));
    return signed(f);
  }

  /** Private generated files are downloadable only through an authorizing domain endpoint. */
  public Map<String, Object> generated(long owner, String region, String name, String mime, byte[] bytes) throws IOException {
    require(bytes.length > 0 && bytes.length <= 50 * 1024 * 1024, 422, "FILE_TOO_LARGE", "生成文件超过50MB限制，请缩小范围");
    String fileId = id("file_"), key = "generated/" + owner + "/" + fileId;
    Path temporary = Files.createTempFile("jf-generated-", ".bin");
    boolean uploaded = false;
    try {
      Files.write(temporary, bytes); oss.upload(key, temporary); uploaded = true;
      String checksum;
      try { checksum = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
      catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
      store.db().update("INSERT INTO jf_file(id,owner_id,region_id,object_key,name,mime_type,file_type,size,sha256,purpose,original_name) VALUES(?,?,?,?,?,?,'document',?,?,'generated',?)",
          fileId, owner, region, key, name, mime, bytes.length, checksum, name);
      return m("fileId", fileId, "name", name, "mimeType", mime, "size", bytes.length, "sha256", checksum);
    } catch (Exception error) {
      if (uploaded) try { oss.delete(key); } catch (Exception ignored) { /* Private orphan; no business URL is issued. */ }
      throw error;
    } finally { Files.deleteIfExists(temporary); }
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
