#!/usr/bin/env python3
"""Rebuild OFL subsets. Requires fonttools==4.65.0; see docs/engineering/fonts.md."""
import argparse
import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset, version
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
H5_OUTPUT = ROOT / 'apps/miniapp/src/static/h5/fonts'
METADATA = ROOT / 'scripts/font-data'
MP_OUTPUT = METADATA / 'mp'
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


def common_characters(archive):
    frequencies = {}
    with zipfile.ZipFile(archive) as data:
        for line in data.read('Unihan_Readings.txt').decode().splitlines():
            if '\tkHanyuPinlu\t' in line:
                code, _, readings = line.split('\t')
                frequencies[chr(int(code[2:], 16))] = sum(
                    map(int, re.findall(r'\((\d+)\)', readings)))
    return sorted(frequencies, key=lambda char: (-frequencies[char], ord(char)))


def project_characters():
    chars = set()
    for start, end in [(0x20, 0x7f), (0x2000, 0x2070), (0x3000, 0x3040), (0xff01, 0xff60)]:
        chars.update(map(chr, range(start, end)))
    for path in (ROOT / 'apps/miniapp/src').rglob('*'):
        if path.is_file() and path.suffix in ['.vue', '.ts', '.json', '.scss'] and 'fonts' not in path.parts:
            chars.update(path.read_text())
    return chars


def build_subsets(chars, cache, output, *, expand_cff_subroutines=False):
    output.mkdir(parents=True, exist_ok=True)
    report = []
    for source in FONT_SOURCES:
        url = (f"https://raw.githubusercontent.com/adobe-fonts/{source['repo']}/"
               f"{source['revision']}/OTF/SimplifiedChinese/{source['filename']}")
        original = cache / source['filename']
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
            if expand_cff_subroutines:
                # For these subsets, expanded outlines compress better in WOFF.
                # This keeps glyph drawing, metrics and vertical layout unchanged.
                cff.desubroutinize()
        font.flavor = 'woff'
        name = family+'-'+style+'.woff'
        font.save(output / name)
        font.close()
        # Layout closure may retain additional cmap aliases; report the file as saved.
        saved_font = TTFont(output / name)
        report.append({
            'family': family, 'style': style, 'weight': source['weight'], 'file': name,
            'bytes': (output / name).stat().st_size, 'sha256': sha256(output / name),
            'source_file': source['filename'], 'source_url': url,
            'source_release': source['release'], 'source_version': source_version,
            'source_sha256': source['sha256'], 'glyph_count': len(saved_font.getGlyphOrder()),
            'codepoint_count': len(saved_font.getBestCmap()),
        })
        saved_font.close()
    return report


def write_metadata(directory, chars, manifest):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    (directory / 'charset.txt').write_text(''.join(sorted(chars)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True,
                        help='Intermediate download cache outside the delivered project')
    parser.add_argument('--common-count', type=int, default=1800,
                        help='H5: union source characters with this many top common Han characters')
    parser.add_argument('--mp-extra-count', type=int, default=200,
                        help='WeChat: add this many common Han characters absent from the source set (default: 200; use 600 for expanded dynamic-text coverage)')
    args = parser.parse_args()
    if args.common_count < 0 or args.mp_extra_count < 0:
        parser.error('Character counts must be non-negative')
    args.cache.mkdir(parents=True, exist_ok=True)
    archive = args.cache / 'Unihan.zip'
    download(UNIHAN_URL, archive, UNIHAN_SHA256)
    frequent = common_characters(archive)
    base = project_characters()
    additional = [char for char in frequent if char not in base]
    if args.mp_extra_count > len(additional):
        parser.error('Not enough extra common characters in the pinned Unihan data')
    h5_chars = base | set(frequent[:args.common_count])
    mp_chars = base | set(additional[:args.mp_extra_count])
    shared = {'fonttools': version, 'common_character_source': UNIHAN_URL,
              'common_character_source_sha256': UNIHAN_SHA256}
    h5_fonts = build_subsets(h5_chars, args.cache, H5_OUTPUT)
    write_metadata(METADATA, h5_chars, {
        **shared,
        'common_character_method': 'sum kHanyuPinlu frequencies; descending; code point tie-break',
        'common_character_count': args.common_count,
        'fonts': h5_fonts,
    })
    mp_fonts = build_subsets(mp_chars, args.cache, MP_OUTPUT, expand_cff_subroutines=True)
    write_metadata(MP_OUTPUT, mp_chars, {
        **shared,
        'common_character_method': 'sum kHanyuPinlu frequencies; descending; code point tie-break; exclude source characters and fixed punctuation before selecting extras',
        'extra_common_character_count': args.mp_extra_count,
        'cff_optimization': 'desubroutinize after subsetting; WOFF compression unchanged',
        'fonts': mp_fonts,
    })
    print(json.dumps({'h5': h5_fonts, 'mp-weixin': mp_fonts}, ensure_ascii=False, indent=2))
    print('H5 font bytes:', sum(item['bytes'] for item in h5_fonts))
    print('WeChat font bytes:', sum(item['bytes'] for item in mp_fonts))


if __name__ == '__main__':
    main()
