package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Local, bounded MP4 normalization. No remote URLs, user filters or shell execution. */
@Service
public class JfVideo {
  private final String ffmpeg, ffprobe;
  private final Semaphore slots = new Semaphore(1);
  public JfVideo(@Value("${JIAFENG_FFMPEG:ffmpeg}") String ffmpeg,
      @Value("${JIAFENG_FFPROBE:ffprobe}") String ffprobe) {
    this.ffmpeg=ffmpeg; this.ffprobe=ffprobe;
  }
  public record Converted(Path path, long durationMs) {}
  public Converted convert(Path input) throws IOException {
    require(slots.tryAcquire(),503,"VIDEO_BUSY","视频处理繁忙，请稍后重试");
    Path output=null;
    try {
      long before=inspect(input);
      output=Files.createTempFile("jiafeng-video-", ".mp4");
      run(List.of(ffmpeg,"-nostdin","-v","error","-y","-max_alloc","67108864","-threads","1",
          "-protocol_whitelist","file,pipe","-format_whitelist","mov,matroska,webm","-i",input.toString(),
          "-map","0:v:0","-map","0:a:0?","-sn","-dn","-map_metadata","-1",
          "-vf","scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
          "-c:v","libx264","-preset","veryfast","-crf","25","-pix_fmt","yuv420p","-threads","1",
          "-c:a","aac","-ac","2","-ar","44100","-b:a","96k","-movflags","+faststart",
          "-t","601","-fs","52428801",output.toString()),45);
      long after=inspect(output);
      require(Files.size(output)>0 && Files.size(output)<=50L*1024*1024,
          422,"VIDEO_TOO_LARGE","转换后视频超过50MB，请压缩后重试");
      require(Math.abs(after-before)<=1500,422,"INVALID_VIDEO","视频未完整转换，请压缩后重试");
      return new Converted(output,after);
    } catch(Exception e) { if(output!=null)Files.deleteIfExists(output); throw e; }
    finally { slots.release(); }
  }
  private long inspect(Path input) throws IOException {
    return duration(parse(run(List.of(ffprobe,"-v","error","-max_alloc","67108864","-threads","1",
        "-protocol_whitelist","file,pipe","-format_whitelist","mov,matroska,webm",
        "-show_entries","stream=codec_type,width,height:format=duration","-of","json",input.toString()),5)));
  }
  static long duration(Map<String,Object> metadata) {
    var videos=list(metadata.get("streams")).stream().map(Jf::obj)
        .filter(s->str(s,"codec_type").equals("video")).toList();
    require(videos.size()==1,422,"INVALID_VIDEO","请选择包含单一画面的视频文件");
    var video=videos.getFirst(); long width=number(video.get("width")),height=number(video.get("height"));
    require(width>=2 && height>=2 && width<=4096 && height<=4096 && width*height<=8388608,
        422,"INVALID_VIDEO","视频尺寸须在4096像素和800万像素以内");
    double seconds;
    try { seconds=Double.parseDouble(str(obj(metadata.get("format")),"duration")); }
    catch(NumberFormatException e) { throw error(422,"INVALID_VIDEO","无法读取视频时长"); }
    require(Double.isFinite(seconds)&&seconds>0,422,"INVALID_VIDEO","视频时长无效");
    require(seconds<=600.15,422,"VIDEO_TOO_LONG","视频最长10分钟");
    return Math.round(seconds*1000);
  }
  private String run(List<String> arguments,int timeout) throws IOException {
    Process process;
    try { process=new ProcessBuilder(arguments).redirectError(ProcessBuilder.Redirect.DISCARD).start(); }
    catch(IOException e) { throw error(503,"VIDEO_UNAVAILABLE","视频处理服务未就绪，请稍后重试"); }
    try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
      Future<byte[]> output=executor.submit(()->process.getInputStream().readNBytes(65537));
      try {
        if(!process.waitFor(timeout,TimeUnit.SECONDS)) {process.destroyForcibly();throw error(503,"VIDEO_TIMEOUT","视频处理超时，请压缩后重试");}
        byte[] bytes=output.get(2,TimeUnit.SECONDS);
        require(process.exitValue()==0 && bytes.length<=65536,422,"INVALID_VIDEO","视频无法解码，请重新选择文件");
        return new String(bytes,StandardCharsets.UTF_8);
      } catch(InterruptedException e) {Thread.currentThread().interrupt();throw error(503,"VIDEO_INTERRUPTED","视频处理已中断，请重试");}
      catch(ExecutionException|TimeoutException e) {throw error(503,"VIDEO_UNAVAILABLE","视频处理失败，请重试");}
      finally {process.destroyForcibly();}
    }
  }
}
