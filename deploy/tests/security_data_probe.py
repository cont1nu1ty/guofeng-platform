#!/usr/bin/env python3
"""Explicit isolated-project cache/search/dependency-failure probes; never a live default."""
import json
import os
from pathlib import Path
import time
import uuid
from probe_scope import isolated_deployment

_, values, lifecycle = isolated_deployment()
assert values['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-security-')
assert os.environ.get('JIAFENG_TEST_URL') == 'http://127.0.0.1:' + values['JIAFENG_HTTP_PORT']
from business_probe import Client, draft

checks=[]
def check(name, ok=True):
    assert ok, name
    checks.append(name)
    print('PASS',name,flush=True)

def wait_search(admin):
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        s=admin.call('GET','/admin/search/status')[1]
        code,data,_=guest.call('GET','/search?pageSize=1',expected=None)
        if s.get('ready') and code==200:return
        time.sleep(.5)
    raise AssertionError('isolated search recovery timed out')

def sql(query):
    return lifecycle.query(query)

admin=Client('devadmin','admin')
a=Client('member_zj');b=Client('member_bj');regional=Client('region_zj','admin')
guest=Client.__new__(Client);guest.token=''
marker='SecurityVisibility'+uuid.uuid4().hex[:10]
content=admin.command('saveContent',data={'title':marker,'category':'资讯','region':'zhejiang','language':'zh','summary':marker+'公开摘要','body':marker+'这份公开测试内容用于验证下架与搜索一致性。'},admin=True)['result']
cid=content['id']
private=draft(title=marker+'私人草稿')
_,_,headers=a.call('GET','/me/draft')
etag=headers.get('ETag') or headers.get('Etag')
a.call('PUT','/me/draft',private,{'If-Match':etag})
check('another account does not receive the private cloud draft',b.call('GET','/me/draft')[1]['draft'] is None or b.call('GET','/me/draft')[1]['draft']['title']!=private['title'])
for _ in range(2):
    public=guest.workspace()
    assert all(not public.get(k) for k in ('recitations','familyPromises','reviewTasks','supportTickets','notifications','excerpts','aiArchives'))
    assert private['title'] not in json.dumps(public,ensure_ascii=False)
check('cold/warm anonymous workspace excludes private records and draft text')
wait_search(admin)
check('unpublished content and private cloud draft are absent from search counts',guest.call('GET','/search?q='+marker)[1]['total']==0)
admin.act('setContentStatus','contents',cid,{'status':'已发布'})
wait_search(admin)
check('legitimately published content is searchable',guest.call('GET','/search?q='+marker)[1]['total']==1)
admin.act('setContentStatus','contents',cid,{'status':'已下架'})
code,result,_=guest.call('GET','/search?q='+marker,expected=None)
check('withdrawal never returns stale title or count',(code==503 and set(result)=={'code','message','requestId'}) or (code==200 and result['total']==0))
check('withdrawn content leaves the next public cache response',cid not in {i['id'] for i in guest.workspace()['news']})
code,body,headers=a.call('GET','/admin/accounts',expected=None)
check('denial body and response header share the server request ID',code==403 and body['requestId']==headers.get('X-Request-Id'))
_,_,headers=admin.call('POST','/admin/commands',{'command':'saveContent','data':{'title':marker+'审计','category':'资讯','region':'zhejiang','language':'zh','summary':'仅测试关联标识','body':'这是一段虚构内容，仅用于确认成功操作记录与请求关联。'}},{'Idempotency-Key':str(uuid.uuid4())})
rid=headers.get('X-Request-Id','')
assert rid.startswith('req_') and rid.replace('_','').isalnum()
check('successful database audit keeps the same request correlation ID',sql("SELECT COUNT(*) FROM jf_audit WHERE JSON_UNQUOTE(JSON_EXTRACT(detail,'$.requestId'))='"+rid+"';")=='1')
for region in ('all','beijing'):
    result=regional.call('GET','/admin/records/submissions?region='+region)[1]
    if region=='beijing':assert not result['items'] and result['total']==0
    else:assert all(x.get('region') in ('浙江省','zhejiang') for x in result['items'])
check('all filter stays in authorized scope and another-region filter returns no records/count')

faults={}
try:
    lifecycle.compose('stop','search',capture_output=True,text=True)
    code,result,_=guest.call('GET','/search?q='+marker,expected=None)
    check('search outage returns explicit unavailable without cached counts or text',code==503 and set(result)=={'code','message','requestId'})
    check('business health remains ready while search is offline',guest.call('GET','/health')[1]['status']=='ok')
    admin.act('setContentStatus','contents',cid,{'status':'已发布'})
    admin.act('setContentStatus','contents',cid,{'status':'已下架'})
    check('business publish/withdraw still commits while search is offline',admin.entity('contents',cid)['status']=='已下架')
finally:
    lifecycle.compose('start','--wait','--wait-timeout','120','search',capture_output=True,text=True)
wait_search(admin)
check('search rebuilds/replays and restricted content stays absent after recovery',guest.call('GET','/search?q='+marker)[1]['total']==0)
try:
    lifecycle.compose('stop','redis',capture_output=True,text=True)
    start=time.monotonic();public=guest.workspace();elapsed=time.monotonic()-start
    check('anonymous public cache falls back to database when Redis is unavailable',isinstance(public['news'],list) and elapsed<5)
    code,result,_=a.call('GET','/workspace',expected=None)
    check('authenticated Redis outage never falls back to anonymous/demo success',code>=400 and 'works' not in result)
    faults['redisPublicFallbackSeconds']=round(elapsed,3)
finally:
    lifecycle.compose('start','--wait','--wait-timeout','120','redis',capture_output=True,text=True)
check('Redis session and public reads recover',a.call('GET','/auth/me')[1]['id']==a.user['id'] and isinstance(guest.workspace()['news'],list))
try:
    lifecycle.compose('stop','mysql',capture_output=True,text=True)
    code,result,_=guest.call('GET','/health',expected=None)
    check('database outage makes business health fail without ready/demo response',code>=500 and result.get('code')=='INTERNAL_ERROR')
finally:
    lifecycle.compose('start','--wait','--wait-timeout','120','mysql',capture_output=True,text=True)
check('business database health recovers without resetting data',guest.call('GET','/health')[1]['status']=='ok' and admin.entity('contents',cid)['id']==cid)
report={'project':values['COMPOSE_PROJECT_NAME'],'checks':checks,'passed':len(checks),'faults':faults,'scope':'only this isolated project services stopped/started; no external models or live data'}
path=Path(os.environ.get('JIAFENG_SECURITY_DATA_REPORT','/tmp/guofeng-security-data.json'));path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':len(checks)}))
