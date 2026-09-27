#!/usr/bin/env python3
"""Real API/audio checks in an explicitly selected disposable demo environment.

JIAFENG_ENV_FILE must point to a jiafeng-demo-* project. Test records are original
and uniquely prefixed; they remain in that isolated environment for inspection.
No production/current-demo records are changed and no volumes are removed.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import uuid

HERE = Path(__file__).resolve().parents[1]
assert os.environ.get('JIAFENG_ENV_FILE'), 'Select a disposable verification environment'
spec = importlib.util.spec_from_file_location('private_record_seed', HERE / 'seed-catalog.py')
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)
base = seed.base
assert seed.PROJECT.startswith('jiafeng-demo-'), 'Only isolated jiafeng-demo-* projects are allowed'
assert base.ENV.get('JIAFENG_DEV_ACCOUNTS_ENABLED') == 'true'
CHECKS = []
RUN = uuid.uuid4().hex[:12]
PREFIX = '个人云记录验收-' + RUN
CREATED = {'files': [], 'recitations': [], 'familyPromises': [], 'hallPeople': [], 'media': []}


def check(label, condition):
    assert condition, label
    CHECKS.append({'check': label, 'passed': True})
    print('PASS:', label, flush=True)


def call(client, method, path, data=None, expected=(200,), key=None):
    headers = {'Content-Type': 'application/json'}
    if client:
        headers['Authorization'] = 'Bearer ' + client.token
    if key:
        headers['Idempotency-Key'] = key
    req = urllib.request.Request(base.BASE + path, method=method, headers=headers,
        data=None if data is None else json.dumps(data, ensure_ascii=False).encode())
    try:
        with base.HTTP.open(req, timeout=120) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    result = json.loads(raw) if raw else {}
    assert status in expected, f'{method} {path}: {status} {result.get("code")}'
    if status >= 400:
        assert result.get('requestId') and result.get('code'), 'Stable API errors required'
    return status, result


def command(client, name, data=None, entity='', version=None, admin=False,
            expected=(200,), key=None):
    payload = {'command': name, 'entityId': entity, 'data': data or {}}
    if version is not None:
        payload['version'] = version
    return call(client, 'POST', '/admin/commands' if admin else '/commands', payload,
        expected, key or 'private-probe:' + str(uuid.uuid4()))


def upload(client, name, blob, expected=(200,), purpose='recitation'):
    boundary = 'private-record-' + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
        'Content-Type: application/octet-stream\r\n\r\n').encode() + blob + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(base.BASE + '/files?purpose=' + purpose, data=body,
        headers={'Authorization': 'Bearer ' + client.token,
            'Content-Type': 'multipart/form-data; boundary=' + boundary})
    try:
        with base.HTTP.open(req, timeout=120) as response:
            status, result = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, result = error.code, json.load(error)
    assert status in expected, f'Upload {name}: {status} {result.get("code")}'
    if status >= 400:
        assert result.get('requestId') and result.get('code')
    else:
        CREATED['files'].append(result['fileId'])
    return result


def audio(ext, seconds=1):
    options = {'wav': ['-c:a', 'pcm_s16le', '-f', 'wav'],
        'mp3': ['-c:a', 'libmp3lame', '-f', 'mp3'],
        'm4a': ['-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4'],
        'aac': ['-c:a', 'aac', '-f', 'adts'],
        'ogg': ['-c:a', 'libopus', '-f', 'ogg'],
        'webm': ['-c:a', 'libopus', '-f', 'webm']}[ext]
    return base.deploy.compose('exec', '-T', 'server', 'ffmpeg', '-nostdin', '-v', 'error',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000', '-t', str(seconds),
        '-threads', '1', *options, 'pipe:1', capture_output=True).stdout


def find(client, collection, id, admin=False):
    return next(item for item in client.workspace(admin)[collection] if item['id'] == id)


def main():
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    admin, regional = seed.Client('devadmin', 'admin'), seed.Client('region_zj', 'admin')
    other_region, expert = seed.Client('region_bj', 'admin'), seed.Client('expert_zj', 'admin')
    member, other = seed.Client('member_zj'), seed.Client('member_bj')
    report = {'project': seed.PROJECT, 'run': RUN, 'startedAt': started, 'checks': CHECKS,
        'created': CREATED, 'passed': False,
        'notExercised': ['FFmpeg timeout/concurrency saturation fault injection',
            'WeChat physical microphone/playback', 'Five-minute URL expiry waiting',
            'Container restart (run separately against retained records)']}
    destination = Path(os.environ.get('JIAFENG_PRIVATE_PROBE_OUTPUT',
        str(HERE / '.local' / (seed.PROJECT + '-private-records-checks.json'))))
    try:
        ffmpeg = base.deploy.compose('exec', '-T', 'server', 'ffmpeg', '-version',
            capture_output=True, text=True).stdout.splitlines()[0]
        report['ffmpeg'] = ffmpeg
        initial_files = int(base.sql('SELECT COUNT(*) FROM jf_file;'))
        files = {}
        for ext in ('mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'):
            source = audio(ext)
            saved = upload(member, PREFIX + '.' + ext, source)
            files[ext] = saved
            check(ext + ' normalizes to private MP3 with measured duration',
                saved['type'] == 'audio' and saved['mimeType'] == 'audio/mpeg'
                and saved['name'].endswith('.mp3') and 0 < saved['duration'] < 3
                and saved['originalName'] == PREFIX + '.' + ext)
            row = json.loads(base.sql('SELECT JSON_OBJECT(\'purpose\',purpose,\'source\',source_sha256,'
                '\'sha256\',sha256,\'duration\',duration_ms) FROM jf_file WHERE id=' + base.lit(saved['fileId']) + ';'))
            check(ext + ' stores input checksum and normalized metadata', row['purpose'] == 'recitation'
                and row['source'] == hashlib.sha256(source).hexdigest() and row['duration'] > 0)
            signed = call(member, 'GET', '/files/' + saved['fileId'] + '/url')[1]
            with base.HTTP.open(signed['url'], timeout=30) as response:
                normalized = response.read()
            check(ext + ' returns five-minute playable S3 bytes with matching checksum',
                signed['expiresIn'] == 300 and normalized[:3] == b'ID3'
                and hashlib.sha256(normalized).hexdigest() == row['sha256'])
        check('Six successful uploads create six database files',
            int(base.sql('SELECT COUNT(*) FROM jf_file;')) == initial_files + 6)
        disguised_video = base.deploy.compose('exec', '-T', 'server', 'ffmpeg', '-nostdin', '-v', 'error',
            '-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=1', '-t', '1', '-threads', '1',
            '-c:v', 'mpeg4', '-f', 'matroska', 'pipe:1', capture_output=True).stdout
        for label, filename, blob, status, code in (
            ('Oversized audio', PREFIX + '.wav', b'x' * (10 * 1024 * 1024 + 1), 413, 'FILE_TOO_LARGE'),
            ('Invalid audio masquerading as MP3', PREFIX + '.mp3', b'ID3not-a-real-audio-file', 422, 'INVALID_AUDIO'),
            ('Video stream disguised as MP3', PREFIX + '.mp3', disguised_video, 422, 'INVALID_AUDIO'),
            ('Overlong audio', PREFIX + '.mp3', audio('mp3', 182), 422, 'AUDIO_TOO_LONG'),
            ('Unbounded browser WebM duration', PREFIX + '.webm', audio('webm', 182), 422, 'AUDIO_TOO_LONG'),
            ('Unsupported extension', PREFIX + '.exe', b'fake', 422, 'INVALID_FILE_TYPE')):
            failure = upload(member, filename, blob, expected=(status,))
            check(label + ' fails without creating an effective file', failure['code'] == code
                and int(base.sql('SELECT COUNT(*) FROM jf_file;')) == initial_files + 6)
        upload(admin, PREFIX + '.mp3', audio('mp3'), expected=(403,))
        check('Staff cannot create private member recording uploads', True)
        file_id = files['webm']['fileId']
        for actor in (other, admin, regional, other_region, expert):
            denied = call(actor, 'GET', '/files/' + file_id + '/url', expected=(404,))[1]
            check(actor.name + ' cannot read unsubmitted private audio',
                set(denied) == {'code', 'message', 'requestId'})
        call(None, 'GET', '/files/' + file_id + '/public', expected=(404,))
        call(None, 'GET', '/files/' + file_id + '/url', expected=(401,))
        command(other, 'recitation.create', {'title': PREFIX, 'fileId': file_id, 'consent': True}, expected=(404,))
        command(member, 'recitation.create', {'title': PREFIX, 'fileId': file_id}, expected=(422,))
        check('Private file binding requires ownership and recording consent', True)
        payload = {'title': PREFIX, 'fileId': file_id, 'consent': True}
        idem = 'private-probe:recitation:' + RUN
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: command(member, 'recitation.create', payload, key=idem)[1]['result'], range(2)))
        recording = results[0]
        CREATED['recitations'].append(recording['id'])
        check('Concurrent idempotent creates produce exactly one recording', results[1]['id'] == recording['id']
            and len([x for x in member.workspace()['recitations'] if x['title'] == PREFIX]) == 1)
        command(member, 'recitation.create', {**payload, 'title': PREFIX + '不同'}, key=idem, expected=(409,))
        check('Same idempotency key with changed content is rejected', True)
        for actor in (other, admin, regional, expert):
            check(actor.name + ' workspace excludes another member recording',
                recording['id'] not in {x['id'] for x in actor.workspace().get('recitations', [])})
        command(other, 'recitation.remove', entity=recording['id'], version=recording['lockVersion'], expected=(404,))
        command(member, 'recitation.remove', entity=recording['id'], version=0, expected=(412,))
        check('Recording deletion enforces owner and version', True)
        person = command(admin, 'saveHallPerson', {'title': PREFIX + '人物', 'language': 'zh',
            'region': 'zhejiang', 'sample': True}, admin=True)[1]['result']
        CREATED['hallPeople'].append(person['id'])
        promise_data = {'personId': person['id'], 'text': '每周和家人共读一封家书' + RUN}
        command(member, 'familyPromise.save', promise_data, version=0, expected=(404,))
        person = command(admin, 'setHallPersonStatus', {'status': '已发布'}, person['id'], person['lockVersion'], admin=True)[1]['result']
        with ThreadPoolExecutor(max_workers=2) as executor:
            races = list(executor.map(lambda _: command(member, 'familyPromise.save', promise_data,
                version=0, expected=(200, 412)), range(2)))
        check('Concurrent first promise save has one success and one conflict', sorted(x[0] for x in races) == [200, 412])
        promise = next(result['result'] for status, result in races if status == 200)
        CREATED['familyPromises'].append(promise['id'])
        check('Promise captures actual person identity', promise['personName'] == PREFIX + '人物'
            and promise['personLanguage'] == 'zh' and promise['targetAvailable'])
        other_promise = command(other, 'familyPromise.save', {**promise_data, 'text': '另一个家庭的私人约定' + RUN}, version=0)[1]['result']
        CREATED['familyPromises'].append(other_promise['id'])
        check('Different owners keep distinct promises for the same person', other_promise['id'] != promise['id'])
        command(other, 'familyPromise.remove', entity=promise['id'], version=promise['lockVersion'], expected=(404,))
        command(member, 'familyPromise.save', promise_data, promise['id'], 0, expected=(412,))
        person = command(admin, 'setHallPersonStatus', {'status': '已下架'}, person['id'], person['lockVersion'], admin=True)[1]['result']
        historical = find(member, 'familyPromises', promise['id'])
        check('Person withdrawal preserves owner history with unavailable link',
            historical['text'] == promise_data['text'] and not historical['targetAvailable'])
        promise = command(member, 'familyPromise.save', {**promise_data, 'text': '下架后仍可编辑自己的私人约定' + RUN},
            promise['id'], promise['lockVersion'])[1]['result']
        check('Withdrawn-person promise remains editable for owner', not promise['targetAvailable']
            and promise['lockVersion'] > historical['lockVersion'])
        unicode_text = '𠮷' * 180
        promise = command(member, 'familyPromise.save', {**promise_data, 'text': unicode_text},
            promise['id'], promise['lockVersion'])[1]['result']
        command(member, 'familyPromise.save', {**promise_data, 'text': unicode_text + '𠮷'},
            promise['id'], promise['lockVersion'], expected=(422,))
        check('Promise uses Unicode code-point text limits', promise['text'] == unicode_text)
        for actor in (admin, regional, other_region, expert):
            workspace = actor.workspace(True)
            text = json.dumps(workspace, ensure_ascii=False)
            check(actor.name + ' admin response contains no private body or file ID',
                unicode_text not in text and file_id not in text and promise_data['text'] not in text)
            stats = workspace['privateRecordStats']
            check(actor.name + ' receives only aggregate private-record statistics',
                set(stats) == {'recitations', 'familyPromises', 'byRegion'}
                and all(set(x) == {'regionId', 'recitations', 'familyPromises'} for x in stats['byRegion']))
        check('Regional statistics only include authorized regions', all(x['regionId'] == 'zhejiang'
            for x in regional.workspace(True)['privateRecordStats']['byRegion']))
        check('Expert receives zero private-record statistics', expert.workspace(True)['privateRecordStats']
            == {'recitations': 0, 'familyPromises': 0, 'byRegion': []})
        command(member, 'familyPromise.remove', entity=promise['id'], version=promise['lockVersion'])
        check('Deleted family promise is absent from owner workspace',
            promise['id'] not in {x['id'] for x in member.workspace()['familyPromises']})
        revived = command(member, 'familyPromise.save', promise_data, version=0)[1]['result']
        check('Explicit resave after deletion keeps monotonic version', revived['id'] == promise['id']
            and revived['lockVersion'] > promise['lockVersion'])
        command(member, 'familyPromise.save', promise_data, promise['id'], promise['lockVersion'], expected=(412,))
        check('Stale pre-deletion version cannot overwrite recreated promise', True)
        media = command(member, 'media.submit', {'title': PREFIX + '主动投稿', 'region': 'zhejiang',
            'language': 'zh', 'category': 'recitation', 'type': 'audio', 'sourceFileId': file_id,
            'excerpt': '原创测试音调，仅验证主动投稿与私有记录解耦。'}, admin=False)[1]['result']
        CREATED['media'].append(media['id'])
        check('Media submission reuses normalized file without new upload',
            int(base.sql('SELECT COUNT(*) FROM jf_file;')) == initial_files + 6)
        command(member, 'recitation.remove', entity=recording['id'], version=recording['lockVersion'])
        check('Deleting check-in preserves explicit submitted media reference',
            recording['id'] not in {x['id'] for x in member.workspace()['recitations']}
            and find(member, 'mediaSubmissions', media['id'])['sourceFileId'] == file_id)
        call(regional, 'GET', '/files/' + file_id + '/url')
        call(other_region, 'GET', '/files/' + file_id + '/url', expected=(404,))
        check('After explicit submission only its region operator can review the audio', True)
        standalone = command(member, 'recitation.create', {'title': PREFIX + '独立',
            'fileId': files['wav']['fileId'], 'consent': True})[1]['result']
        CREATED['recitations'].append(standalone['id'])
        command(member, 'recitation.remove', entity=standalone['id'], version=standalone['lockVersion'])
        call(member, 'GET', '/files/' + files['wav']['fileId'] + '/url', expected=(404,))
        check('Deleting unsubmitted recording revokes new signed downloads', True)
        recreated = command(member, 'recitation.create', {'title': PREFIX + '可重启验证',
            'fileId': files['mp3']['fileId'], 'consent': True})[1]['result']
        CREATED['recitations'].append(recreated['id'])
        second_session = seed.Client('member_zj')
        check('Independent login reads the same persisted owner records',
            find(second_session, 'recitations', recreated['id'])['fileId'] == files['mp3']['fileId']
            and find(second_session, 'familyPromises', revived['id'])['text'] == promise_data['text'])
        public = call(None, 'GET', '/workspace')[1]
        check('Guest workspace contains no personal record content', not public['recitations'] and not public['familyPromises'])
        audit = base.sql('SELECT CAST(detail AS CHAR) FROM jf_audit WHERE created_at>=' + base.lit(started[:19].replace('T', ' ')) + ';')
        check('Audit details exclude private recording titles and promise text',
            PREFIX not in audit and unicode_text not in audit and promise_data['text'] not in audit)
        report['restartTargets'] = {'owner': 'member_zj', 'recitationId': recreated['id'],
            'fileId': files['mp3']['fileId'], 'familyPromiseId': revived['id']}
        report['passed'] = True
    finally:
        report['finishedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'passed': report['passed'], 'checks': len(CHECKS), 'evidence': str(destination)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
