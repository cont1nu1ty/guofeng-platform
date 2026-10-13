"""Resource-bounded local text extraction subprocess. Does not load model secrets."""
import base64
import io
import json
import resource
import sys
import xml.etree.ElementTree as ET
import zipfile

resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024,) * 2)
resource.setrlimit(resource.RLIMIT_CPU, (12, 12))


def parse(data):
    raw = base64.b64decode(data["base64"], validate=True)
    if len(raw) > 10 * 1024 * 1024:
        raise ValueError("文件超过 10MiB")
    if raw.startswith(b"%PDF-"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        if reader.is_encrypted:
            raise ValueError("不支持加密 PDF，请先解除加密")
        if len(reader.pages) > 30:
            raise ValueError("每次最多处理 30 页，请拆分文档")
        texts = []
        for n, page in enumerate(reader.pages, 1):
            content = page.get_contents()
            if content and len(content.get_data()) > 8 * 1024 * 1024:
                raise ValueError("PDF 页面过于复杂，请转换为图片")
            texts.append(f"[第{n}页]\n" + (page.extract_text() or ""))
        text = "\n\n".join(texts)
        # OCR a scan, including PDFs that mix scanned pages with a text layer.
        needs_ocr = any(len(t.split("\n", 1)[1].strip()) < 10 for t in texts)
    elif raw.startswith(b"PK\x03\x04"):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > 8 * 1024 * 1024:
                raise ValueError("DOCX 正文过大")
            root = ET.fromstring(archive.read(info))
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        text = "\n".join("".join(p.itertext()) for p in root.findall(".//w:p", ns))
        needs_ocr = False
    else:
        text = raw.decode("utf-8-sig")
        needs_ocr = False
    if len(text) > 120000:
        raise ValueError("正文超过 12 万字，请拆分资料")
    if not text.strip():
        raise ValueError("没有可解析正文")
    return {"text": text, "needsOcr": needs_ocr}


try:
    print(json.dumps(parse(json.load(sys.stdin)), ensure_ascii=False))
except (Exception, MemoryError):
    print(json.dumps({"error": "文档解析失败：请使用未加密、30页以内的有效 PDF、DOCX 或 UTF-8 文本。"}, ensure_ascii=False))
