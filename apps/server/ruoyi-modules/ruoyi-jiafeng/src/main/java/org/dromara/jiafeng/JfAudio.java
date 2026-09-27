package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Bounded audio-only conversion. Inputs are local temporary files, never user URLs or commands. */
@Service
public class JfAudio {
  private final String ffmpeg;
  private final String ffprobe;
  private final Semaphore slots = new Semaphore(2);

  public JfAudio(
      @Value("${JIAFENG_FFMPEG:ffmpeg}") String ffmpeg,
      @Value("${JIAFENG_FFPROBE:ffprobe}") String ffprobe) {
    this.ffmpeg = ffmpeg;
    this.ffprobe = ffprobe;
  }

  public record Converted(Path path, long durationMs) {}

  public Converted convert(Path input) throws IOException {
    require(slots.tryAcquire(), 503, "AUDIO_BUSY", "录音处理繁忙，请稍后重试");
    Path output = null;
    try {
      inspect(input, true);
      output = Files.createTempFile("jiafeng-audio-", ".mp3");
      run(List.of(ffmpeg, "-nostdin", "-v", "error", "-y", "-max_alloc", "67108864", "-threads", "1",
          "-protocol_whitelist", "file,pipe", "-format_whitelist", "mp3,wav,mov,aac,ogg,matroska,webm", "-i", input.toString(), "-map", "0:a:0",
          "-vn", "-sn", "-dn", "-map_metadata", "-1", "-threads", "1", "-ac", "1",
          "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "64k", "-t", "181",
          "-fs", "10485760", output.toString()));
      long duration = inspect(output, false);
      require(Files.size(output) > 0 && Files.size(output) <= 10L * 1024 * 1024,
          422, "INVALID_AUDIO", "录音处理结果无效");
      return new Converted(output, duration);
    } catch (Exception e) {
      if (output != null) Files.deleteIfExists(output);
      throw e;
    } finally {
      slots.release();
    }
  }

  private long inspect(Path input, boolean allowUnknownDuration) throws IOException {
    String result = run(List.of(ffprobe, "-v", "error", "-max_alloc", "67108864", "-threads", "1",
        "-protocol_whitelist", "file,pipe", "-format_whitelist", "mp3,wav,mov,aac,ogg,matroska,webm", "-show_entries", "stream=codec_type:format=duration",
        "-of", "json", input.toString()));
    var metadata = parse(result);
    if (allowUnknownDuration && str(obj(metadata.get("format")), "duration").isBlank()) {
      var streams = list(metadata.get("streams"));
      require(!streams.isEmpty() && streams.stream().allMatch(s -> str(obj(s), "codec_type").equals("audio")),
          422, "INVALID_AUDIO", "请选择纯音频文件");
      return 0; // Browser WebM can omit duration; bounded decoding measures the MP3 output.
    }
    return duration(metadata);
  }

  static long duration(Map<String, Object> metadata) {
    var streams = list(metadata.get("streams"));
    require(!streams.isEmpty()
            && streams.stream().allMatch(s -> str(obj(s), "codec_type").equals("audio")),
        422, "INVALID_AUDIO", "请选择纯音频文件");
    double seconds;
    try { seconds = Double.parseDouble(str(obj(metadata.get("format")), "duration")); }
    catch (NumberFormatException e) { throw error(422, "INVALID_AUDIO", "无法读取录音时长"); }
    require(Double.isFinite(seconds) && seconds > 0, 422, "INVALID_AUDIO", "录音时长无效");
    require(seconds <= 180.15, 422, "AUDIO_TOO_LONG", "诵读音频最长3分钟");
    return Math.round(seconds * 1000);
  }

  private String run(List<String> arguments) throws IOException {
    Process process;
    try {
      process = new ProcessBuilder(arguments).redirectError(ProcessBuilder.Redirect.DISCARD).start();
    } catch (IOException e) {
      throw error(503, "AUDIO_UNAVAILABLE", "录音处理服务未就绪，请稍后重试");
    }
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      Future<byte[]> output = executor.submit(() -> process.getInputStream().readNBytes(65537));
      try {
        if (!process.waitFor(30, TimeUnit.SECONDS)) {
          process.destroyForcibly();
          throw error(503, "AUDIO_TIMEOUT", "录音处理超时，请重试");
        }
        byte[] bytes = output.get(2, TimeUnit.SECONDS);
        require(process.exitValue() == 0 && bytes.length <= 65536,
            422, "INVALID_AUDIO", "录音无法解码，请重新选择文件");
        return new String(bytes, StandardCharsets.UTF_8);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw error(503, "AUDIO_INTERRUPTED", "录音处理已中断，请重试");
      } catch (ExecutionException | TimeoutException e) {
        throw error(503, "AUDIO_UNAVAILABLE", "录音处理失败，请重试");
      } finally {
        process.destroyForcibly();
      }
    }
  }
}
