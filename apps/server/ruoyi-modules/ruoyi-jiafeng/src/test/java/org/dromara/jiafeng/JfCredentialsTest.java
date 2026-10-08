package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.dromara.common.core.utils.SpringUtils;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class JfCredentialsTest {
  @BeforeAll static void mapper() {
    var beans=new DefaultListableBeanFactory();beans.registerSingleton("jsonMapper",JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  @Test void anonymousVerificationExcludesHolderAndSourceEvenWhenDatabaseRowContainsThem() {
    var row=m("certificate_no","JF-test","title","结业证书","issuer","签发方","status","issued","issued_at","2026-10-07T10:00:00Z",
        "file_hash","sha","owner_id",42,"source_snapshot",m("name","私密姓名","title","私密稿件"),"verify_token","private-token","revoke_reason","私密原因");
    var result=JfCertificates.publicVerification(row);
    assertEquals(Set.of("certificateNo","title","issuer","status","issuedAt","revokedAt","fileHash"),result.keySet());
    assertFalse(json(result).contains("私密"));
  }
  @Test void resourceDownloadRequiresAuthenticationPublicationAndRegionalAccess() {
    var actor=JfAccessTest.actor("member");
    var row=m("status","published","audience","authorized_regions","region_id","zhejiang");
    assertDoesNotThrow(()->JfResources.authorizeDownload(actor,row));
    assertEquals(401,assertThrows(ApiException.class,()->JfResources.authorizeDownload(null,row)).status);
    row.put("region_id","beijing");assertEquals(404,assertThrows(ApiException.class,()->JfResources.authorizeDownload(actor,row)).status);
    row.put("audience","all_members");assertDoesNotThrow(()->JfResources.authorizeDownload(actor,row));
    row.put("status","withdrawn");assertThrows(ApiException.class,()->JfResources.authorizeDownload(actor,row));
  }
  @Test void changedResourceLicenceCannotMintAnAuthorizedDownloadLink() {
    var store=mock(JfStore.class);var db=mock(JdbcTemplate.class);var files=mock(JfFiles.class);when(store.db()).thenReturn(db);
    when(db.queryForList(anyString(),eq("resource-test"))).thenReturn(List.of(m("status","published","audience","all_members","region_id","zhejiang","version",2)));
    var service=new JfResources(store,files);
    var failure=assertThrows(ApiException.class,()->service.download(JfAccessTest.actor("member"),"resource-test",m("acceptedLicense",true,"version",1)));
    assertEquals("RESOURCE_CHANGED",failure.code);verifyNoInteractions(files);
  }
  @Test void copyrightConfirmationRejectsOtherOwnerAndChangedRevisionBeforeWritingHistory() {
    var store=mock(JfStore.class);var db=mock(JdbcTemplate.class);var actor=JfAccessTest.actor("member");
    when(store.find("submission","work",true)).thenReturn(new JfStore.Entity("work","submission",8L,"zhejiang","draft",m("revisionId","revision-2"),1,"", ""));
    var service=new JfRights(store);
    assertEquals(404,assertThrows(ApiException.class,()->service.confirm(actor,"work","revision-2",JfRights.AGREEMENT_VERSION)).status);
    when(store.find("submission","work",true)).thenReturn(new JfStore.Entity("work","submission",7L,"zhejiang","draft",m("revisionId","revision-2"),1,"", ""));
    assertEquals("REVISION_CHANGED",assertThrows(ApiException.class,()->service.confirm(actor,"work","revision-1",JfRights.AGREEMENT_VERSION)).code);
    assertEquals("AGREEMENT_CHANGED",assertThrows(ApiException.class,()->service.confirm(actor,"work","revision-2","older-terms")).code);
    verify(store,never()).db();verifyNoInteractions(db);
  }
}
