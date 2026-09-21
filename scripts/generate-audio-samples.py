#!/usr/bin/env python3
"""Rebuild original synthetic samples using locally installed eSpeak NG and FFmpeg.
Optional ESPEAK_BINARY, ESPEAK_DATA_PARENT and LD_LIBRARY_PATH support an isolated tool install.
No text is sent to an external service. Tool binaries are not included in the project.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'scripts/audio-sample-manifest.json').read_text())
# Runtime files may be moved to the content subpackage by the build-layout migration.
folder = ROOT / 'apps/miniapp/src/pkg-content/static/audio'
if not folder.exists():
    folder = ROOT / 'apps/miniapp/src/static/audio'
folder.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as temporary:
    for item in manifest['samples']:
        wav = Path(temporary) / (item['name'] + '.wav')
        command = [os.environ.get('ESPEAK_BINARY', 'espeak-ng')]
        if os.environ.get('ESPEAK_DATA_PARENT'):
            command.append('--path=' + os.environ['ESPEAK_DATA_PARENT'])
        command += ['-v', item['voice'], '-s', '155', '-w', str(wav), item['script']]
        subprocess.run(command, check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-ar', '22050', '-ac', '1', '-b:a', '24k', str(folder / (item['name'] + '.mp3'))], check=True)
