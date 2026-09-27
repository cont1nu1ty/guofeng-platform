package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class JfAudioTest {
  @Test
  void serverDurationComesFromProbeAndNotClientMetadata() {
    assertEquals(12345, JfAudio.duration(m("streams", List.of(m("codec_type", "audio")),
        "format", m("duration", "12.345"))));
  }

  @Test
  void videoDisguisedAsAudioIsRejected() {
    assertThrows(Jf.ApiException.class, () -> JfAudio.duration(m("streams",
        List.of(m("codec_type", "audio"), m("codec_type", "video")),
        "format", m("duration", "12"))));
  }

  @Test
  void EmptyTracksUnknownAndInvalidDurationCannotCreateCompletedRecording() {
    assertThrows(Jf.ApiException.class, () -> JfAudio.duration(m("streams", List.of(),
        "format", m("duration", "12"))));
    for (String duration : List.of("", "N/A", "NaN", "Infinity", "-1", "0", "181", "90000")) {
      assertThrows(Jf.ApiException.class, () -> JfAudio.duration(m("streams",
          List.of(m("codec_type", "audio")), "format", m("duration", duration))));
    }
  }

  @Test
  void MissingExecutableReturnsStableUnavailableErrorWithoutExposingPath() {
    var audio = new JfAudio("/missing-sensitive-path/ffmpeg", "/missing-sensitive-path/ffprobe");
    var failure = assertThrows(Jf.ApiException.class, () -> audio.convert(Path.of("ignored.wav")));
    assertEquals("AUDIO_UNAVAILABLE", failure.code);
    assertFalse(failure.getMessage().contains("missing-sensitive-path"));
  }
}
