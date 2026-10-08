package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class JfReplayScopeTest {
  private JfAuth.Actor actor(String region) {
    return new JfAuth.Actor(m("user_id",42,"version",2,"roles",List.of("content_operator"),
        "region_ids",List.of(region),"permissions",List.of("content:write")));
  }
  private Map<String,Object> replay(String authorizedRegion,String currentRegion,String historicalRegion) {
    var auth=mock(JfAuth.class);var store=mock(JfStore.class);
    var actor=actor(authorizedRegion);
    when(auth.admin()).thenReturn(actor);
    doCallRealMethod().when(auth).operate(any(),anyString());
    var result=m("id","content1","regionId",historicalRegion,"body","未发布资料不得绕过当前地区授权");
    when(store.idempotent(eq(actor),eq("admin:saveContent"),eq("original-key"),any(),any())).thenReturn(result);
    when(store.find("content","content1",false)).thenReturn(new JfStore.Entity("content1","content",42L,currentRegion,"草稿",m(),1,"",""));
    var operations=new JfOperations(store,auth,mock(JfFiles.class),mock(JfCatalog.class),mock(JfReviewWindows.class));
    var controller=new JfController(auth,mock(JfSchema.class),store,mock(JfFiles.class),mock(JfSubmissions.class),
        mock(JfProjection.class),mock(JfReview.class),operations,mock(JfMember.class),mock(JfCatalog.class),mock(JfAccounts.class),mock(JfEducation.class));
    // A create replay has no input entity ID; authorization must use the cached result ID.
    var response=obj(controller.adminCommand(m("command","saveContent","entityId","","data",m()),"original-key","compact"));
    verify(store,never()).save(any(),anyString(),anyString(),anyMap());
    return response;
  }
  @Test void CachedCreateResultIsDeniedAfterRegionRevocation() {
    assertEquals("NOT_FOUND",assertThrows(ApiException.class,()->replay("beijing","zhejiang","zhejiang")).code);
  }
  @Test void EntityTransferredOutsideScopeCannotBeReadFromCachedResult() {
    assertEquals("NOT_FOUND",assertThrows(ApiException.class,()->replay("zhejiang","beijing","zhejiang")).code);
  }
  @Test void HistoricalPayloadIsDeniedEvenWhenEntityMovesIntoNewScope() {
    assertEquals("NOT_FOUND",assertThrows(ApiException.class,()->replay("beijing","beijing","zhejiang")).code);
  }
  @Test void SameScopeRetryStillReturnsOriginalResultWithoutAnotherMutation() {
    assertEquals("content1",obj(replay("zhejiang","zhejiang","zhejiang").get("result")).get("id"));
  }
}
