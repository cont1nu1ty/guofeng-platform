package org.dromara.jiafeng;
import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import java.time.LocalDate;
import java.io.*;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class JfJobsTest {
  @Test void csvNeutralizesFormulaPrefixesIncludingMultilineAndEscapesQuotes(){
    assertEquals("\"'  =1+1\"",JfJobs.csvCell("  =1+1"));
    assertEquals("\"'\n@evil\nx\"",JfJobs.csvCell("\n@evil\nx"));
    assertEquals("\"甲\"\"乙\"",JfJobs.csvCell("甲\"乙"));
  }
  @Test void regionalFiltersRemainScopedWithAdversarialSearch(){
    var actor=new JfAuth.Actor(m("user_id",42,"user_name","r","nick_name","r","version",1,"realm","staff","roles",List.of("data_operator"),"region_ids",List.of("zhejiang"),"permissions",List.of("submissions:read"),"profile",m()));
    var filter=JfQueries.filter(actor,"submission","all","%' OR 1=1 --","待初审");
    assertTrue(filter.sql().contains("region_id IN (?)"));assertFalse(filter.sql().contains("OR 1=1"));
    assertEquals("zhejiang",filter.args().getFirst());assertTrue(filter.args().contains("pending_initial_review"));
  }
  @Test void expertCannotReadOtherCollectionsThroughGenericPaging(){
    var actor=new JfAuth.Actor(m("user_id",42,"version",1,"roles",List.of("expert"),"region_ids",List.of("zhejiang"),"permissions",List.of("reviews:read")));
    assertTrue(JfQueries.filter(actor,"submission","","","").sql().contains("1=0"));
    assertTrue(JfQueries.filter(actor,"task","","","").sql().contains("owner_id=?"));
    var queries=new JfQueries(mock(JfStore.class),mock(JfProjection.class),mock(JfReviewWindows.class));
    assertThrows(ApiException.class,()->queries.resource(actor,"submissions"));
  }
  @Test void chinesePdfIsSearchableAndWordIsRealOoxml() throws Exception {
    byte[] pdf=JfDocuments.render("家风典籍测试",List.of("第一章 传承","中文正文与 English 2026。","长文\n"+"家风传承。".repeat(1000)),"pdf");
    try(var document=Loader.loadPDF(pdf)){assertTrue(document.getNumberOfPages()>1);String text=new PDFTextStripper().getText(document);assertTrue(text.contains("家风典籍测试"));assertTrue(text.contains("English 2026"));}
    byte[] docx=JfDocuments.render("家风典籍测试",List.of("甲 & 乙 <家>"),"docx");
    boolean content=false;try(var zip=new ZipInputStream(new ByteArrayInputStream(docx))){for(var entry=zip.getNextEntry();entry!=null;entry=zip.getNextEntry()){if(entry.getName().equals("word/document.xml")){String xml=new String(zip.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);assertTrue(xml.contains("&amp;"));assertTrue(xml.contains("&lt;家&gt;"));content=true;}}}assertTrue(content);
  }
  @Test void periodsAreCompleteCalendarPeriodsAtYearAndLeapBoundaries(){
    var month=JfSchedules.previous("month",LocalDate.of(2024,3,1));assertEquals(LocalDate.of(2024,2,1),month.from());assertEquals(LocalDate.of(2024,3,1),month.to());
    var quarter=JfSchedules.previous("quarter",LocalDate.of(2026,1,8));assertEquals(LocalDate.of(2025,10,1),quarter.from());assertEquals(LocalDate.of(2026,1,1),quarter.to());
    var week=JfSchedules.previous("weekly",LocalDate.of(2026,10,7));assertEquals(LocalDate.of(2026,9,28),week.from());assertEquals(LocalDate.of(2026,10,5),week.to());
  }
}
