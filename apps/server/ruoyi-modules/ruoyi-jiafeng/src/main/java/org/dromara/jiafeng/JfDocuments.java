package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;

/** Searchable, embedded-font A4 documents. Inputs are frozen business text, never executable HTML. */
public final class JfDocuments {
  private JfDocuments() {}
  public static String displayTime(String value){try{return java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日 HH:mm（北京时间）").withZone(java.time.ZoneId.of("Asia/Shanghai")).format(java.time.Instant.parse(value));}catch(java.time.DateTimeException invalid){return value;}}
  public static String mime(String format) { return format.equals("pdf")?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }
  public static byte[] render(String title,List<String> paragraphs,String format) throws IOException {
    require(Set.of("pdf","docx").contains(format),422,"INVALID_FORMAT","不支持的文档格式");
    require(title.length()+paragraphs.stream().mapToLong(String::length).sum()<=500000,422,"DOCUMENT_LIMIT","每份文档最多50万字符，请拆分卷册");
    return format.equals("pdf")?pdf(title,paragraphs):docx(title,paragraphs);
  }
  static String plain(String value) { return value.replaceAll("(?i)<br\\s*/?>","\n").replaceAll("(?i)</p>","\n").replaceAll("</?[A-Za-z][^>]*>","").replace("&nbsp;"," ").replace("&lt;","<").replace("&gt;",">").replace("&amp;","&").replaceAll("[\\p{Cntrl}&&[^\\n\\t]]",""); }
  static List<String> wrap(PDType0Font font,String input,float size,float width) throws IOException {
    var lines=new ArrayList<String>();
    for(String paragraph:plain(input).split("\n",-1)){
      var line=new StringBuilder();float used=0;
      for(int cp:paragraph.replace('\t',' ').codePoints().toArray()){
        String character=new String(Character.toChars(cp));float advance;
        try{advance=font.getStringWidth(character)*size/1000;}catch(IllegalArgumentException missing){throw error(422,"FONT_GLYPH_MISSING","文档含字体不支持的字符 U+"+Integer.toHexString(cp).toUpperCase(Locale.ROOT));}
        if(used+advance>width&&!line.isEmpty()){lines.add(line.toString());line.setLength(0);used=0;}
        line.append(character);used+=advance;
      }
      lines.add(line.toString());
    }
    return lines;
  }
  public static byte[] pdf(String title,List<String> paragraphs) throws IOException {
    try(var document=new PDDocument();var fontStream=JfDocuments.class.getResourceAsStream("/fonts/NotoSansSC-Regular.ttf");var output=new ByteArrayOutputStream()){
      if(fontStream==null)throw new IOException("Document font unavailable");
      var font=PDType0Font.load(document,fontStream,true);
      List<String> text=new ArrayList<>();text.add(title);text.addAll(paragraphs);
      PDPageContentStream canvas=null;float y=0;int pageNumber=0;
      try{
        for(int paragraph=0;paragraph<text.size();paragraph++){
          float size=paragraph==0?20:11.5f,lineHeight=paragraph==0?30:19;
          for(String line:wrap(font,text.get(paragraph),size,PDRectangle.A4.getWidth()-100)){
            if(canvas==null||y<66){
              if(canvas!=null)canvas.close();
              require(++pageNumber<=500,422,"PAGE_LIMIT","文档超过500页，请拆分卷册");
              var page=new PDPage(PDRectangle.A4);document.addPage(page);canvas=new PDPageContentStream(document,page);y=PDRectangle.A4.getHeight()-60;
              canvas.beginText();canvas.setFont(font,9);canvas.newLineAtOffset(50,32);canvas.showText("家风中华行  /  "+pageNumber);canvas.endText();
            }
            canvas.beginText();canvas.setFont(font,size);canvas.newLineAtOffset(50,y);canvas.showText(line);canvas.endText();y-=lineHeight;
          }
          y-=8;
        }
      }finally{if(canvas!=null)canvas.close();}
      document.getDocumentInformation().setTitle(title);document.getDocumentInformation().setProducer("Jiafeng document service / PDFBox");
      document.save(output);return output.toByteArray();
    }
  }
  static String xml(String text){return plain(text).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
  static void entry(ZipOutputStream zip,String name,String value)throws IOException{zip.putNextEntry(new ZipEntry(name));zip.write(value.getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
  public static byte[] docx(String title,List<String> paragraphs)throws IOException {
    var body=new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>");
    var all=new ArrayList<String>();all.add(title);all.addAll(paragraphs);
    for(int i=0;i<all.size();i++)for(String line:plain(all.get(i)).split("\n",-1))body.append("<w:p><w:pPr><w:spacing w:after=\"160\" w:line=\"360\" w:lineRule=\"auto\"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=\"Noto Sans SC\" w:eastAsia=\"Noto Sans SC\"/><w:sz w:val=\"").append(i==0?"40":"23").append("\"/>").append(i==0?"<w:b/>":"").append("</w:rPr><w:t xml:space=\"preserve\">").append(xml(line)).append("</w:t></w:r></w:p>");
    body.append("<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1134\" w:right=\"1000\" w:bottom=\"1134\" w:left=\"1000\"/></w:sectPr></w:body></w:document>");
    var output=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(output)){
      entry(zip,"[Content_Types].xml","<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>");
      entry(zip,"_rels/.rels","<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>");entry(zip,"word/document.xml",body.toString());
    }return output.toByteArray();
  }
}
