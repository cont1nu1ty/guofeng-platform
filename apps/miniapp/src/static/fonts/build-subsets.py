#!/usr/bin/env python3
"""Rebuild OFL subsets. Requires fonttools==4.65.0; see docs/09-fonts.md."""
import argparse
import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset, version
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[5]
OUTPUT = ROOT / 'apps/miniapp/src/static/fonts'
FONT_SOURCES = [
    {
        'repo': 'source-han-sans',
        'revision': 'a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2',
        'release': '2.005R',
        'filename': 'SourceHanSansSC-Regular.otf',
        'sha256': 'f1d8611151880c6c336aabeac4640ef434fa13cbfbf1ffe82d0a71b2a5637256',
        'family': 'JiafengSans', 'style': 'Regular', 'weight': 400,
    },
    {
        'repo': 'source-han-serif',
        'revision': '7889f11bf31170b5d092a083b357c8c8130f89e0',
        'release': '2.003R',
        'filename': 'SourceHanSerifSC-SemiBold.otf',
        'sha256': 'faf16caeaf207e1926e01af8d9f1a8e71b0e9d8f51bf3b5d9a78f9f30e7e3e31',
        'family': 'JiafengSerif', 'style': 'SemiBold', 'weight': 600,
    },
]
UNIHAN_URL = 'https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip'
UNIHAN_SHA256 = 'f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url, target, expected):
    if not target.exists():
        urllib.request.urlretrieve(url, target)
    if sha256(target) != expected:
        raise RuntimeError(f'SHA256 mismatch: {target}; inspect before replacing cache')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True,
                        help='Intermediate download cache outside the delivered project')
    parser.add_argument('--common-count', type=int, default=1800)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    archive = args.cache / 'Unihan.zip'
    download(UNIHAN_URL, archive, UNIHAN_SHA256)
    frequencies = {}
    with zipfile.ZipFile(archive) as data:
        for line in data.read('Unihan_Readings.txt').decode().splitlines():
            if '\tkHanyuPinlu\t' in line:
                code, _, readings = line.split('\t')
                frequencies[chr(int(code[2:], 16))] = sum(
                    map(int, re.findall(r'\((\d+)\)', readings)))
    frequent = sorted(frequencies, key=lambda char: (-frequencies[char], ord(char)))
    chars = set(frequent[:args.common_count])
    for start, end in [(0x20, 0x7f), (0x2000, 0x2070), (0x3000, 0x3040), (0xff01, 0xff60)]:
        chars.update(map(chr, range(start, end)))
    for path in (ROOT / 'apps/miniapp/src').rglob('*'):
        if path.is_file() and path.suffix in ['.vue', '.ts', '.json', '.scss'] and 'fonts' not in path.parts:
            chars.update(path.read_text())
    report = []
    for source in FONT_SOURCES:
        url = (f"https://raw.githubusercontent.com/adobe-fonts/{source['repo']}/"
               f"{source['revision']}/OTF/SimplifiedChinese/{source['filename']}")
        original = args.cache / source['filename']
        download(url, original, source['sha256'])
        font = TTFont(original, recalcTimestamp=False)
        source_version = font['name'].getDebugName(5)
        codepoints = sorted(set(map(ord, chars)) & set(font.getBestCmap()))
        options = subset.Options()
        options.hinting = False
        # Preserve punctuation alternates used by vertical reading.
        options.layout_features = ['ccmp', 'vert', 'vrt2', 'kern']
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
        options.name_legacy = True
        options.name_languages = ['*']
        engine = subset.Subsetter(options=options)
        engine.populate(unicodes=codepoints)
        engine.subset(font)
        family, style = source['family'], source['style']
        names = {1: family, 2: style, 3: family+' '+style+' v0.2',
                 4: family+' '+style, 6: family+'-'+style, 16: family, 17: style}
        for entry in font['name'].names:
            if entry.nameID in names:
                entry.string = names[entry.nameID].encode(entry.getEncoding())
        if 'CFF ' in font:
            cff = font['CFF '].cff
            cff.fontNames = [family+'-'+style]
            cff.topDictIndex[0].FullName = family+' '+style
            cff.topDictIndex[0].FamilyName = family
        font.flavor = 'woff'
        name = family+'-'+style+'.woff'
        font.save(OUTPUT / name)
        report.append({
            'family': family, 'style': style, 'weight': source['weight'], 'file': name,
            'bytes': (OUTPUT / name).stat().st_size, 'sha256': sha256(OUTPUT / name),
            'source_file': source['filename'], 'source_url': url,
            'source_release': source['release'], 'source_version': source_version,
            'source_sha256': source['sha256'], 'glyph_count': len(font.getGlyphOrder()),
            'codepoint_count': len(codepoints),
        })
    manifest = {'fonttools': version, 'common_character_source': UNIHAN_URL,
                'common_character_source_sha256': UNIHAN_SHA256,
                'common_character_method': 'sum kHanyuPinlu frequencies; descending; code point tie-break',
                'common_character_count': args.common_count, 'fonts': report}
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    (OUTPUT / 'charset.txt').write_text(''.join(sorted(chars)))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('Total font bytes:', sum(item['bytes'] for item in report))


if __name__ == '__main__':
    main()
