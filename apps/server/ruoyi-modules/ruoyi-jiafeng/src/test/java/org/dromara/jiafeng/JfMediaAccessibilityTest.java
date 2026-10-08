package org.dromara.jiafeng;
import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class JfMediaAccessibilityTest {
  @Test void CaptionsRequireOrderedNonOverlappingRealIntervals() {
    var valid=m("language","zh","cues",List.of(m("startMs",0,"endMs",1000,"text","家风"),m("startMs",1000,"endMs",2000,"text","传承")));
    assertEquals(2,list(JfMediaAccessibility.normalize(valid).get("cues")).size());
    valid.put("cues",List.of(m("startMs",500,"endMs",500,"text","空区间")));
    assertThrows(ApiException.class,()->JfMediaAccessibility.normalize(valid));
    valid.put("cues",List.of(m("startMs",0,"endMs",1000,"text","第一句"),m("startMs",900,"endMs",2000,"text","重叠")));
    assertThrows(ApiException.class,()->JfMediaAccessibility.normalize(valid));
    valid.put("cues",List.of(m("startMs",0,"endMs",600001,"text","超长")));
    assertThrows(ApiException.class,()->JfMediaAccessibility.normalize(valid));
  }
  @Test void UnpublishedMediaNeverReturnsCaptionsOrRecording() {
    var store=mock(JfStore.class);var files=mock(JfFiles.class);
    when(store.find("media","m",false)).thenReturn(new JfStore.Entity("m","media",1L,"all","草稿",m(),1,"",""));
    assertThrows(ApiException.class,()->new JfMediaAccessibility(store,mock(JfAuth.class),files).published("m"));
    verifyNoInteractions(files);
  }
  @Test void VideoProbeRejectsOversizeDurationAndNonVideoInput() {
    var valid=m("streams",List.of(m("codec_type","video","width",1920,"height",1080)),"format",m("duration","10.1"));
    assertEquals(10100,JfVideo.duration(valid));
    valid.put("format",m("duration","601"));assertThrows(ApiException.class,()->JfVideo.duration(valid));
    valid.put("format",m("duration","NaN"));assertThrows(ApiException.class,()->JfVideo.duration(valid));
    valid.put("streams",List.of(m("codec_type","audio")));assertThrows(ApiException.class,()->JfVideo.duration(valid));
  }
}
