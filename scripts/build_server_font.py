#!/usr/bin/env python3
"""Reproduce the licensed server PDF font. Requires fonttools==4.65.0."""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts/font-data/server-manifest.json"
meta = json.loads(MANIFEST.read_text())
base = f"https://raw.githubusercontent.com/google/fonts/{meta['revision']}/ofl/notosanssc/"
raw = urllib.request.urlopen(base + "NotoSansSC%5Bwght%5D.ttf", timeout=60).read()
if hashlib.sha256(raw).hexdigest() != meta["sourceSha256"]:
    raise RuntimeError("Upstream font checksum mismatch")
font = instantiateVariableFont(TTFont(io.BytesIO(raw), recalcTimestamp=False), meta["instance"], inplace=False)
# PDFBox reverses glyph mappings for ToUnicode. Noto maps some radicals and ordinary
# ideographs to the same glyph; retain the ordinary characters so PDF text extraction
# returns 风/人/etc. instead of compatibility radicals. No drawn glyph is modified.
for table in font['cmap'].tables:
    if table.isUnicode() and hasattr(table, 'cmap'):
        ordinary = {glyph for cp, glyph in table.cmap.items() if not 0x2E80 <= cp <= 0x2FDF}
        for cp in list(table.cmap):
            if 0x2E80 <= cp <= 0x2FDF and table.cmap[cp] in ordinary:
                del table.cmap[cp]
font.save(ROOT / meta["file"])
digest = hashlib.sha256((ROOT / meta["file"]).read_bytes()).hexdigest()
print(f"Font SHA256: {digest}")
