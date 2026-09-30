#!/usr/bin/env python3
"""Public-cache integration and failure checks in jiafeng-demo-review-cache only."""
import datetime as dt
import importlib.machinery
import importlib.util
import json
import os
import time
import urllib.request
from business_probe import Client, ENV, ROOT

assert ENV.get('COMPOSE_PROJECT_NAME') == 'jiafeng-demo-review-cache', 'isolated project required'
assert os.environ.get('JIAFENG_TEST_URL') == 'http://127.0.0.1:' + ENV['JIAFENG_HTTP_PORT']
loader=importlib.machinery.SourceFileLoader('cache_probe_deploy',str(ROOT/'deploy/dev'))
spec=importlib.util.spec_from_loader(loader.name,loader)
deploy=importlib.util.module_from_spec(spec);loader.exec_module(deploy)
checks=[]


def check(name, value=True):
    assert value,name
    checks.append(name)
    print('PASS',name,flush=True)


def guest():
    with urllib.request.urlopen(os.environ['JIAFENG_TEST_URL']+'/api/v1/workspace',timeout=15) as response:
        return json.load(response)


def redis(command):
    return deploy.compose('exec','-T','redis','sh','-c',
        'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --raw '+command,
        capture_output=True,text=True).stdout.strip()


def sql(query):
    return deploy.compose('exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --default-character-set=utf8mb4 -N -B jiafeng',input=query,capture_output=True,text=True).stdout.strip()


def iso(seconds):
    return (dt.datetime.now(dt.timezone.utc)+dt.timedelta(seconds=seconds)).isoformat()


def until(fn,seconds=15):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        if fn():return
        time.sleep(.5)
    raise AssertionError('timed content visibility did not converge')


def main():
    admin=Client('devadmin','admin');a=Client('member_zj');b=Client('member_bj')
    pattern="'*jiafeng-demo-review-cache:public:v1:*'"
    keys=redis('--scan --pattern '+pattern).splitlines()
    for key in keys:
        assert all(c.isalnum() or c in ':_-{}' for c in key)
        redis('DEL '+key)
    cold=guest();warm=guest()
    def stable(data):return {k:v for k,v in data.items() if k!='serverNow'}
    check('cold and warm public responses are equivalent',stable(cold)==stable(warm))
    keys=redis('--scan --pattern '+pattern).splitlines()
    check('public catalog and stats use separate Redis entries',any(':catalog:'in k for k in keys) and any(':stats:'in k for k in keys))
    for key in keys:
        entry=json.loads(redis('GET '+key))
        check('shared projection excludes private workspace arrays '+key.split(':')[-2],not(set(entry['data']) & {'notifications','reviewTasks','mediaSubmissions','supportTickets','registrations','favorites','excerpts','aiArchives','familyPromises','recitations'}) if ':catalog:'in key else not(set(entry['data']) & {'notifications','reviewTasks','favorites','recitations','familyPromises'}))
        ttl=int(redis('PTTL '+key))
        check('cache has bounded expiry '+key.split(':')[-2],0<ttl<= (300000 if ':catalog:'in key else 30000))
    aw=a.workspace();bw=b.workspace()
    private_a={w['id'] for w in aw['works'] if w.get('isMine')}
    private_b={w['id'] for w in bw['works'] if w.get('isMine')}
    check('personal records and own-work flags stay account scoped',private_a and private_b and private_a.isdisjoint(private_b) and all(not w.get('isMine') for w in guest()['works']))
    check('anonymous workspace contains no private records',all(not guest()[k] for k in ('notifications','reviewTasks','mediaSubmissions','supportTickets','favorites','excerpts','aiArchives')))
    created=admin.command('saveContent',data={'title':'缓存一致性临时资讯','category':'资讯','region':'zhejiang','language':'zh','summary':'验证提交后公开可见性','body':'这是独立测试环境的缓存一致性测试内容。'},admin=True)['result']
    cid=created['id']
    admin.act('setContentStatus','contents',cid,{'status':'已发布'})
    check('committed publish invalidates the public catalog immediately',cid in [x['id']for x in guest()['news']])
    # Real MySQL rollback, paired with the Java command-transaction bypass unit test.
    # This controlled fixture updates both business data and its version, then rolls both back.
    old_news=guest()['news'];old_version=sql('SELECT catalog_generation FROM jf_public_cache_state WHERE id=1;')
    content_literal="CONVERT(X'"+cid.encode().hex()+"' USING utf8mb4)"
    sql("START TRANSACTION; UPDATE jf_entity SET payload=JSON_SET(payload,'$.title','rollback-only') WHERE id="+content_literal+
        "; UPDATE jf_public_cache_state SET catalog_generation=catalog_generation+1 WHERE id=1; ROLLBACK;")
    check('database rollback preserves the public version and response',
        sql('SELECT catalog_generation FROM jf_public_cache_state WHERE id=1;')==old_version and guest()['news']==old_news)
    config=admin.workspace(True)['homepageConfig']; changed=[dict(s)for s in config['sections']]
    changed[0]['enabled']=not changed[0]['enabled']
    admin.command('saveHomepageConfig',data={'sections':changed},version=config['lockVersion'],admin=True)
    check('homepage configuration commits invalidate cache',guest()['homepageConfig']['sections']==changed)
    current=admin.workspace(True)['homepageConfig']
    admin.command('saveHomepageConfig',data={'sections':config['sections']},version=current['lockVersion'],admin=True)
    banner=admin.command('saveBanner',data={'title':'定时轮播缓存边界','language':'zh','region':'zhejiang','category':'celebration','targetScreen':'news','targetId':cid,'startsAt':iso(8),'endsAt':iso(18)},admin=True)['result']
    banner=admin.command('setBannerStatus',banner['id'],{'status':'已发布'},banner['lockVersion'],True)['result']
    check('future banner is initially hidden',banner['id']not in [x['id']for x in guest()['banners']])
    until(lambda:banner['id'] in [x['id']for x in guest()['banners']])
    check('banner begins without a database write')
    until(lambda:banner['id'] not in [x['id']for x in guest()['banners']])
    check('banner ends without a database write')
    admin.act('setContentStatus','contents',cid,{'status':'已下架'})
    check('withdrawn content is absent on the next read',cid not in [x['id']for x in guest()['news']])
    media=guest()['mediaItems'][0]['id']
    had_like=media in a.workspace()['mediaLikes']
    response=a.command('media.like',media)
    check('command workspace reads its own uncommitted interaction', (media in response['workspace']['mediaLikes']) != had_like)
    a.command('media.like',media)
    before=guest()['homeStats']['asOf'];time.sleep(31)
    refreshed=guest()['homeStats']['asOf']
    age=(dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(refreshed.replace('Z','+00:00'))).total_seconds()
    check('stats timestamp refreshes within its fixed 30-second lifetime',refreshed!=before and age<=30)
    try:
        deploy.compose('stop','redis',capture_output=True,text=True)
        start=time.perf_counter();fallback=guest();elapsed=(time.perf_counter()-start)*1000
        print('Redis outage first request milliseconds:',round(elapsed,2),flush=True)
        check('anonymous public cache falls back when Redis is unavailable',isinstance(fallback['news'],list))
        check('Redis fallback has bounded request latency',elapsed<1500)
    finally:
        deploy.compose('start','--wait','redis',capture_output=True,text=True)
    time.sleep(6)
    check('public cache recovers after Redis returns',stable(guest())['news']==fallback['news'])
    epoch=sql('SELECT epoch FROM jf_public_cache_state WHERE id=1;')
    sql('UPDATE jf_public_cache_state SET epoch=UUID() WHERE id=1;')
    check('database epoch change prevents reuse of old cache keys',guest()['news']==fallback['news'] and sql('SELECT epoch FROM jf_public_cache_state WHERE id=1;')!=epoch)
    result={'checks':checks,'passed':len(checks),'fallbackMs':elapsed,'testedAt':iso(0),'project':ENV['COMPOSE_PROJECT_NAME']}
    (ROOT/'deploy/.local/review-cache/cache-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':len(checks),'fallbackMs':elapsed}))


if __name__=='__main__':main()
