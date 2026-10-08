package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

class JfExportAuthorizationTest {
  private JfAuth.Actor actor(String... permissions) {
    return new JfAuth.Actor(m("user_id",42,"version",2,"roles",List.of("data_operator"),
        "region_ids",List.of("zhejiang"),"permissions",List.of(permissions)));
  }
  private void revokedReadCannotDownload(String kind,String export) {
    var store=mock(JfStore.class);var db=mock(JdbcTemplate.class);var files=mock(JfFiles.class);
    when(store.db()).thenReturn(db);
    when(db.queryForList(anyString(),eq("job1"),eq(42L))).thenReturn(List.of(m("id","job1","kind",kind,
        "permission_key",export,"status","completed","created_at",Instant.now().toString(),
        "snapshot",json(m("scope",List.of("zhejiang"),"volumes",List.of(m("id","v1")))),"request","{}","result",json(m("fileId","file1")))));
    var jobs=new JfJobs(store,mock(JfAuth.class),mock(JfQueries.class),files,mock(JfSchema.class),mock(PlatformTransactionManager.class));
    try {
      assertEquals("FORBIDDEN",assertThrows(ApiException.class,()->jobs.download(actor(export),"job1")).code);
      verifyNoInteractions(files);
    } finally { jobs.close(); }
  }
  @Test void CollectionDownloadRequiresCurrentReadPermissionAsWellAsExport() {
    revokedReadCannotDownload("collection","collections:export");
  }
  @Test void ArchivedReportDownloadRequiresCurrentReadPermissionAsWellAsExport() {
    revokedReadCannotDownload("report","analytics:export");
  }
  @Test void CollectionTransferredOutOfScopeIsRecheckedBeforeIssuingUrl() {
    var store=mock(JfStore.class);var db=mock(JdbcTemplate.class);var files=mock(JfFiles.class);
    when(store.db()).thenReturn(db);
    when(db.queryForList(anyString(),eq("job1"),eq(42L))).thenReturn(List.of(m("id","job1","kind","collection",
        "permission_key","collections:export","status","completed","created_at",Instant.now().toString(),
        "snapshot",json(m("scope",List.of("zhejiang"),"volumes",List.of(m("id","v1")))),"request","{}","result",json(m("fileId","file1")))));
    // The current region-scoped entity query no longer sees the transferred volume.
    when(store.page(eq("collection"),anyString(),anyList(),eq(0),eq(1))).thenReturn(List.of());
    var queries=new JfQueries(store,mock(JfProjection.class),mock(JfReviewWindows.class));
    var jobs=new JfJobs(store,mock(JfAuth.class),queries,files,mock(JfSchema.class),mock(PlatformTransactionManager.class));
    try {
      assertEquals("NOT_FOUND",assertThrows(ApiException.class,()->jobs.download(actor("collections:export","collections:read"),"job1")).code);
      verifyNoInteractions(files);
    } finally { jobs.close(); }
  }
  @Test void RevokedReadIsCheckedBeforeCreateIdempotencyReplay() {
    var store=mock(JfStore.class);var jobs=new JfJobs(store,mock(JfAuth.class),mock(JfQueries.class),mock(JfFiles.class),mock(JfSchema.class),mock(PlatformTransactionManager.class));
    try {
      assertThrows(ApiException.class,()->jobs.create(actor("analytics:export"),m("kind","report"),"original-key"));
      verifyNoInteractions(store);
    } finally { jobs.close(); }
  }
}
