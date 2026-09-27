package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class JfPersonalRecordsTest {
  private final JfStore store = mock(JfStore.class);
  private final JfFiles files = mock(JfFiles.class);
  private final JdbcTemplate db = mock(JdbcTemplate.class);
  private final JfPersonalRecords records = new JfPersonalRecords(store, files);

  JfPersonalRecordsTest() {
    when(store.db()).thenReturn(db);
    doCallRealMethod().when(store).checkVersion(any(), any());
  }

  private JfAuth.Actor member(long id) {
    return new JfAuth.Actor(m("user_id", id, "version", 1, "realm", "member", "roles", List.of(),
        "region_ids", List.of("zhejiang")));
  }

  private JfStore.Entity record(String kind, long owner, String status, Map<String, Object> data) {
    return new JfStore.Entity("record-1", kind, owner, "zhejiang", status, data, 2,
        "2026-09-27T00:00:00Z", "2026-09-27T00:00:00Z");
  }

  @Test
  void IdentitiesDoNotSharePersonPromiseKey() {
    assertNotEquals(JfPersonalRecords.promiseId(1, "person-1"), JfPersonalRecords.promiseId(2, "person-1"));
    assertNotEquals(JfPersonalRecords.promiseId(1, "person-1"), JfPersonalRecords.promiseId(1, "person-2"));
  }

  @Test
  void CrossOwnerDeleteIsDeniedBeforeAnyWrite() {
    when(store.find("recitation", "record-1", true)).thenReturn(record("recitation", 2, "active", m()));
    assertThrows(Jf.ApiException.class,
        () -> records.command(member(1), "recitation.remove", "record-1", 2, m()));
    verify(store, never()).save(any(), anyString(), anyString(), anyMap());
  }

  @Test
  void PrivateDeletionDoesNotDeleteReferencedMediaFile() {
    var item = record("recitation", 1, "active", m("fileId", "source-file"));
    when(store.find("recitation", "record-1", true)).thenReturn(item);
    records.command(member(1), "recitation.remove", "record-1", 2, m());
    verify(store).checkVersion(item, 2);
    verify(store).save(item, "zhejiang", "deleted", item.data());
    verifyNoInteractions(files);
  }

  @Test
  void MemberProjectionContainsOnlyActiveOwnerRecords() {
    when(store.all("recitation")).thenReturn(List.of(
        record("recitation", 1, "active", m("title", "本人诵读")),
        record("recitation", 2, "active", m("title", "他人私密诵读")),
        record("recitation", 1, "deleted", m("title", "已删除诵读"))));
    when(store.all("familyPromise")).thenReturn(List.of());
    Map<String, Object> result = m();
    records.addMember(result, member(1));
    var own = list(result.get("recitations"));
    assertEquals(1, own.size());
    assertEquals("本人诵读", obj(own.getFirst()).get("title"));
    Map<String, Object> anonymous = m();
    records.addMember(anonymous, null);
    assertTrue(list(anonymous.get("recitations")).isEmpty());
  }

  @Test
  void AdminStatisticsExcludeOtherRegionsAndAllPrivateFields() {
    when(db.queryForList(anyString())).thenReturn(List.of(
        m("region_id", "zhejiang", "kind", "recitation", "record_count", 3),
        m("region_id", "zhejiang", "kind", "familyPromise", "record_count", 2),
        m("region_id", "beijing", "kind", "recitation", "record_count", 10)));
    var operator = new JfAuth.Actor(m("user_id", 3, "version", 1, "realm", "admin", "roles", List.of("regional_admin"),
        "region_ids", List.of("zhejiang")));
    Map<String, Object> output = m();
    records.addAdmin(output, operator);
    var stats = obj(output.get("privateRecordStats"));
    assertEquals(3L, stats.get("recitations"));
    assertEquals(2L, stats.get("familyPromises"));
    assertEquals(Set.of("recitations", "familyPromises", "byRegion"), stats.keySet());
    var region = obj(list(stats.get("byRegion")).getFirst());
    assertEquals(Set.of("regionId", "recitations", "familyPromises"), region.keySet());
    verify(store, never()).all(anyString());
  }
  @Test
  void StaleVersionCannotOverwritePrivateRecord() {
    var item = record("recitation", 1, "active", m("fileId", "source-file"));
    when(store.find("recitation", "record-1", true)).thenReturn(item);
    var error = assertThrows(Jf.ApiException.class,
        () -> records.command(member(1), "recitation.remove", "record-1", 1, m()));
    assertEquals("VERSION_CONFLICT", error.code);
    verify(store, never()).save(any(), anyString(), anyString(), anyMap());
  }

  @Test
  void NewPromiseRequiresPublishedRealPerson() {
    String key = JfPersonalRecords.promiseId(1, "person-1");
    when(db.queryForList(anyString(), eq(key))).thenReturn(List.of());
    when(store.find("hallPerson", "person-1", false))
        .thenReturn(record("hallPerson", 2, "草稿", m("title", "未发布人物")));
    assertThrows(Jf.ApiException.class, () -> records.command(member(1), "familyPromise.save", "", 0,
        m("personId", "person-1", "text", "每周共同阅读")));
    verify(store, never()).save(any(), anyString(), anyString(), anyMap());
  }

  @Test
  void WithdrawnPersonDoesNotDeleteOwnersPromiseOrPreventEditing() {
    String key = JfPersonalRecords.promiseId(1, "person-1");
    when(db.queryForList(anyString(), eq(key))).thenReturn(List.of(m("id", key)));
    var item = record("familyPromise", 1, "active",
        m("personId", "person-1", "personName", "历史人物", "personLanguage", "zh", "text", "每周共同阅读"));
    when(store.find("familyPromise", key, true)).thenReturn(item);
    when(store.save(eq(item), eq("zhejiang"), eq("active"), anyMap()))
        .thenAnswer(i -> new JfStore.Entity(key, "familyPromise", 1L, "zhejiang", "active", i.getArgument(3), 3,
            item.createdAt(), item.updatedAt()));
    when(db.queryForObject(anyString(), eq(Long.class), eq("person-1"))).thenReturn(0L);
    var result = obj(records.command(member(1), "familyPromise.save", key, 2,
        m("personId", "person-1", "text", "每晚一起认真阅读", "ownerId", 99, "personName", "伪造名字")));
    assertEquals("每晚一起认真阅读", result.get("text"));
    assertEquals("历史人物", result.get("personName"));
    assertEquals(false, result.get("targetAvailable"));
    assertEquals(3L, result.get("lockVersion"));
    assertFalse(result.containsKey("ownerId"));
  }

}
