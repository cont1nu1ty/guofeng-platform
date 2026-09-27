#!/usr/bin/env python3
"""Check the real public search projection, preserving all existing business records.

--faults additionally stops/restarts only this project's search service and deletes
its current derived search index to verify automatic recovery. Never deletes a
Docker volume. Temporary news is withdrawn through the API before exact-ID cleanup.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('search_seed', HERE / 'seed-catalog.py')
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)
base = seed.base
checks = []


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    checks.append({'check': label, 'passed': True})


def request(client, method, path, data=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if client:
        headers['Authorization'] = 'Bearer ' + client.token
    req = urllib.request.Request(base.BASE + path, method=method, headers=headers,
        data=None if data is None else json.dumps(data, ensure_ascii=False).encode())
    try:
        with base.HTTP.open(req, timeout=40) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as exc:
        status, raw = exc.code, exc.read()
    value = json.loads(raw) if raw else {}
    if expected is not None and status != expected:
        raise AssertionError(f'{method} {path.split("?")[0]}: expected {expected}, got {status}: {value.get("code")}')
    return value if expected is not None else (status, value)


def search(expected=200, **params):
    return request(None, 'GET', '/search?' + urllib.parse.urlencode(params), expected=expected)


def wait_ready(admin, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = request(admin, 'GET', '/admin/search/status')
        if status.get('ready'):
            code, result = search(expected=None, pageSize=1)
            if code == 200:
                return status
        time.sleep(0.2)
    raise AssertionError('search did not reach a verified generation before timeout')


def all_hits(**params):
    found, cursor, pages = [], '', 0
    first = None
    while True:
        result = search(**params, cursor=cursor, pageSize=3)
        first = first or result
        found.extend(result['items'])
        pages += 1
        cursor = result.get('nextCursor')
        if not cursor:
            return found, first, pages
        if pages > 2000:
            raise AssertionError('unbounded search cursor')


def es(method, path, body=None):
    if not re.fullmatch(r'/[a-zA-Z0-9_./?=*-]+', path):
        raise ValueError('unsafe probe ES path')
    script = 'curl --fail --silent --show-error -u "elastic:$ELASTIC_PASSWORD" -H "Content-Type: application/json" -X ' + method + ' "http://127.0.0.1:9200' + path + '"'
    if body is not None:
        script += ' --data-binary @-'
    result = base.deploy.compose('exec', '-T', 'search', 'sh', '-c', script,
        input=None if body is None else json.dumps(body), text=True, capture_output=True)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--faults', action='store_true')
    parser.add_argument('--output', type=Path,
        default=HERE.parent / 'docs/verification/previews/records-search-2026-09-27/search-api.json')
    args = parser.parse_args()
    if not re.fullmatch(r'jiafeng-(?:dev|demo-[a-z0-9][a-z0-9_-]*)', seed.PROJECT):
        raise ValueError('Only the isolated local development project may be probed')
    if args.faults and not seed.PROJECT.startswith('jiafeng-demo-'):
        raise ValueError('Fault injection requires an explicitly selected jiafeng-demo-* environment')
    admin = seed.Client('devadmin', 'admin')
    region = seed.Client('region_zj', 'admin')
    expert = seed.Client('expert_zj', 'admin')
    member = seed.Client('member_zj')
    marker = 'SearchProbe' + uuid.uuid4().hex[:12]
    created, paused, complete = [], False, False
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    original = base.sql("SELECT id,version,SHA2(CAST(payload AS CHAR),256) FROM jf_entity WHERE kind IN ('submission','content','collection','activity','course','media','hallPerson','product','venue') ORDER BY id;")
    out = {'startedAt': started, 'project': seed.PROJECT, 'faultTests': args.faults}

    def current(entity):
        return next(x for x in admin.workspace(True)['contents'] if x['id'] == entity)

    def update_status(entity, status):
        item = current(entity)
        return admin.command('setContentStatus', entity, {'status': status}, item['lockVersion'], True)

    def create(language, region_id, published=True, suffix=''):
        result = admin.command('saveContent', data={
            'title': marker + ' ' + suffix + ('家庭家风搜索验证' if language == 'zh' else 'Letters to our families'),
            'summary': marker + ' 公开摘要 public excerpt', 'body': marker + ' 公开正文 keeping promises',
            'language': language, 'region': region_id, 'topic': 'everyday', 'category': '资讯'}, admin=True)['result']
        created.append(result['id'])
        if published:
            update_status(result['id'], '已发布')
        return result['id']

    try:
        wait_ready(admin)
        public = request(None, 'GET', '/workspace')
        kind_sources = {'work': 'works', 'news': 'news', 'classic': 'classics', 'activity': 'activities',
            'course': 'courses', 'video': 'mediaItems', 'hall': 'hallPeople', 'product': 'products', 'venue': 'venues'}
        expected = {lang: set() for lang in ('zh', 'en')}
        for kind, source in kind_sources.items():
            for item in public[source]:
                lang = 'en' if item.get('language') in ('en', 'English', '英文') else 'zh'
                expected[lang].add((kind, item['id']))
        all_zh, summary, pages = all_hits(language='zh', region='all')
        check('all nine published kinds are covered', set(x['kind'] for x in all_zh) == set(kind_sources))
        check('Chinese hits equal public catalog IDs', {(x['kind'], x['contentId']) for x in all_zh} == expected['zh'])
        check('stable cursor pagination has no duplicates', len({x['id'] for x in all_zh}) == len(all_zh) and pages > 1)
        check('facet all and total equal the public result size', summary['counts']['all'] == summary['total'] == len(all_zh))
        all_en, _, _ = all_hits(language='en', region='all')
        check('English edition excludes legacy Chinese-only records', {(x['kind'], x['contentId']) for x in all_en} == expected['en'])
        check('result DTO excludes source body and private metadata', all(set(x) == {'id','kind','screen','contentId','region','language','title','summary'} for x in all_zh + all_en))
        check('result language fields never fallback across editions', all(x['language'] == 'zh' and x['title']['en'] == '' for x in all_zh) and all(x['language'] == 'en' and x['title']['zh'] == '' for x in all_en))
        zj, _, _ = all_hits(language='zh', region='zhejiang')
        check('region filtering narrows to own region plus shared records', {(x['kind'], x['contentId']) for x in zj} == {(x['kind'], x['contentId']) for x in all_zh if x['region'] in ('all','zhejiang')})
        check('anonymous status administration denied', request(None, 'GET', '/admin/search/status', expected=401)['code'] == 'UNAUTHENTICATED')
        request(region, 'GET', '/admin/search/status')
        check('regional operator can read search status', True)
        for actor, label in [(region,'regional operator'),(expert,'expert'),(member,'member')]:
            check(label + ' cannot rebuild public index', request(actor, 'POST', '/admin/search/rebuild', {}, 403)['code'] == 'FORBIDDEN')
        check('expert cannot inspect search operations', request(expert, 'GET', '/admin/search/status', expected=403)['code'] == 'FORBIDDEN')
        for params, code in [({'q':'字'*201},'INVALID_QUERY'),({'kind':'recitation'},'INVALID_KIND'),({'region':'fictional'},'INVALID_REGION'),({'language':'fr'},'INVALID_LANGUAGE'),({'pageSize':51},'INVALID_PAGE_SIZE'),({'pageSize':'not-a-number'},'INVALID_PAGE_SIZE')]:
            check('invalid query rejected: ' + code, search(expected=422, **params)['code'] == code)

        chinese = create('zh', 'zhejiang', suffix='甲')
        beijing = create('zh', 'beijing', suffix='乙')
        english = create('en', 'all')
        private = create('zh', 'zhejiang', False, suffix='私密草稿')
        wait_ready(admin)
        result = search(q=marker, language='zh', pageSize=1)
        check('drafts are absent from hits, facets and totals', result['total'] == result['counts']['news'] == 2 and bool(result['nextCursor']))
        check('CJK analyzer finds Chinese words', search(q=marker+' 家风', language='zh')['total'] == 2)
        check('English analyzer matches stemmed family/families', search(q=marker+' family', language='en')['total'] == 1)
        check('full text body can match independently of title', search(q=marker+' keeping', language='en')['total'] == 1)
        check('keyword and region apply to facets', search(q=marker, language='zh', region='zhejiang')['counts']['all'] == 1)
        cursor = result['nextCursor']
        update_status(beijing, '已下架')
        changed = search(q=marker, language='zh', pageSize=1, cursor=cursor, expected=409)
        check('publication changes invalidate old cursor', changed['code'] == 'SEARCH_CHANGED' and bool(changed.get('requestId')))
        code, after = search(q=marker, language='zh', expected=None)
        check('withdrawal never leaks stale count or title during indexing', (code == 503 and after.get('code') == 'SEARCH_UPDATING') or (code == 200 and after['total'] == 1 and all(x['contentId'] != beijing for x in after['items'])))
        wait_ready(admin)
        check('withdrawn title absent after synchronization', search(q=marker, language='zh')['total'] == 1)

        first_index = request(admin, 'GET', '/admin/search/status')['indexName']
        request(admin, 'POST', '/admin/search/rebuild', {}, 202)
        deadline = time.monotonic() + 30
        observed_rebuilding = False
        while time.monotonic() < deadline:
            state = request(admin, 'GET', '/admin/search/status')
            if state['status'] == 'rebuilding':
                observed_rebuilding = True
                break
            time.sleep(0.02)
        check('full rebuild begins asynchronously', observed_rebuilding)
        last_title = ''
        for number in range(5):
            item = current(chinese)
            last_title = marker + ' 重建期间更新 ' + str(number)
            admin.command('saveContent', chinese, {**item,'title':last_title,'region':'zhejiang'}, item['lockVersion'], True)
            time.sleep(0.08)
        second = wait_ready(admin)
        check('rebuild uses a new physical index and switches alias', second['indexName'] != first_index)
        check('writes during rebuild survive snapshot and outbox replay', any(x['contentId'] == chinese and x['title']['zh'] == last_title for x in search(q=marker, language='zh')['items']))
        request(admin, 'POST', '/admin/search/rebuild', {}, 202)
        third = wait_ready(admin)
        check('repeated rebuild replaces index without duplicate documents', third['indexName'] != second['indexName'] and search(q=marker, language='zh')['total'] == 1)

        if args.faults:
            paused = True
            base.deploy.compose('stop', 'search', capture_output=True, text=True)
            check('engine outage returns stable unavailable error', search(expected=503)['code'] == 'SEARCH_UPDATING')
            check('other public business remains available during engine outage', request(None,'GET','/health')['status'] == 'ok' and bool(request(None,'GET','/workspace')['works']))
            update_status(chinese, '已下架')
            check('business save commits while engine is offline', current(chinese)['status'] == '已下架')
            check('offline withdrawal never returns cached hits or facets', set(search(q=marker, expected=503)) == {'code','message','requestId'})
            base.deploy.compose('up','-d','--no-build','--wait','--wait-timeout','120','search',capture_output=True,text=True)
            paused = False
            wait_ready(admin)
            check('durable outbox removes withdrawn title after restart', search(q=marker, language='zh')['total'] == 0)
            lost = request(admin,'GET','/admin/search/status')['indexName']
            es('DELETE', '/' + lost)
            code, result = search(q=marker, expected=None)
            check('missing index never trusts old database checkpoint', code == 503 and result['code'] == 'SEARCH_UPDATING')
            recovered = wait_ready(admin)
            check('lost derived index automatically rebuilt from business database', recovered['indexName'] != lost and search(q=marker, language='en')['total'] == 1)
        complete = True
    finally:
        cleanup_error = ''
        try:
            if paused:
                base.deploy.compose('up','-d','--no-build','--wait','--wait-timeout','120','search',capture_output=True,text=True)
            if created:
                for entity in created:
                    if current(entity)['status'] != '已下架':
                        update_status(entity, '已下架')
                wait_ready(admin)
                check('temporary records removed from public search before cleanup', search(q=marker, language='zh')['total'] == 0 and search(q=marker, language='en')['total'] == 0)
                ids = ','.join(base.lit(x) for x in created)
                # Only rows created by this run, and subscriber messages targeting them.
                base.sql("DELETE FROM jf_entity WHERE kind='notification' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.targetId')) IN ("+ids+");\nDELETE FROM jf_entity WHERE kind='content' AND status='已下架' AND id IN ("+ids+");")
            untouched = base.sql("SELECT id,version,SHA2(CAST(payload AS CHAR),256) FROM jf_entity WHERE kind IN ('submission','content','collection','activity','course','media','hallPerson','product','venue') ORDER BY id;")
            check('existing public and private business records unchanged', original == untouched)
        except Exception as exc:
            complete = False
            cleanup_error = type(exc).__name__ + ': ' + str(exc)
        out.update(checkedAt=dt.datetime.now(dt.timezone.utc).isoformat(), passed=complete, checks=checks,
            temporaryNewsRemoved=len(created) if not cleanup_error else 0,
            cleanupError=cleanup_error, temporaryEntityIds=created,
            scope='Real MySQL transactions, Elasticsearch, app endpoints and scoped Compose service; no WeChat device evidence.')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
        if cleanup_error:
            raise AssertionError('Search probe cleanup incomplete; see the evidence report')
    print(json.dumps({'passed':complete,'checks':len(checks),'temporaryNewsRemoved':len(created)},ensure_ascii=False))


if __name__ == '__main__':
    main()
