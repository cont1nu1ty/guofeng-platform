#!/usr/bin/env python3
"""Real HTTP integration probe. Creates identifiable development records; never resets data."""
import concurrent.futures as futures
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request
import urllib.error
import uuid

urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('JIAFENG_TEST_URL','http://127.0.0.1:18080')+'/api/v1'
ENV=dict(line.split('=',1) for line in (ROOT/'deploy/.env').read_text().splitlines() if line and not line.startswith('#'))
RESULTS=[]
STAMP=dt.datetime.now(dt.timezone.utc).strftime('%m%d%H%M%S')

def check(name,condition=True):
    if not condition: raise AssertionError(name)
    RESULTS.append(name)
    print('PASS',name,flush=True)

class Client:
    def __init__(self,name,client='member'):
        self.token=''
        _,data,_=self.call('POST','/auth/login',{'username':name,'password':ENV['JIAFENG_DEV_PASSWORD'],'client':client})
        self.token=data['token'];self.user=data['user'];self.name=name
    def call(self,method,path,data=None,headers=None,expected=200):
        hs={'Content-Type':'application/json'}
        if self.token: hs['Authorization']='Bearer '+self.token
        hs.update(headers or {})
        req=urllib.request.Request(BASE+path,data=json.dumps(data,ensure_ascii=False).encode() if data is not None else None,headers=hs,method=method)
        try:
            with urllib.request.urlopen(req,timeout=60) as res: status=res.status;raw=res.read();heads=dict(res.headers)
        except urllib.error.HTTPError as e: status=e.code;raw=e.read();heads=dict(e.headers)
        try: parsed=json.loads(raw) if raw else {}
        except Exception: parsed={'raw':raw[:200].decode(errors='replace')}
        if expected is not None and status!=expected: raise AssertionError(f'{method} {path} expected {expected}, got {status}: {parsed}')
        return status,parsed,heads
    def workspace(self,admin=False):return self.call('GET','/admin/workspace' if admin else '/workspace')[1]
    def command(self,name,id='',data=None,version=None,admin=False,key=None,expected=200):
        body={'command':name,'entityId':id,'data':data or {}}
        if version is not None: body['version']=version
        return self.call('POST','/admin/commands' if admin else '/commands',body,{'Idempotency-Key':key or str(uuid.uuid4())},expected)[1]
    def entity(self,collection,id):return next(x for x in self.workspace(True)[collection] if x['id']==id)
    def act(self,name,collection,id,data=None,**kwargs):return self.command(name,id,data,self.entity(collection,id)['lockVersion'],True,**kwargs)
    def upload(self,blob,name='中文验收资料.pdf',expected=200):
        boundary='probe'+uuid.uuid4().hex
        raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+blob+f'\r\n--{boundary}--\r\n'.encode())
        req=urllib.request.Request(BASE+'/files',data=raw,headers={'Authorization':'Bearer '+self.token,'Content-Type':'multipart/form-data; boundary='+boundary})
        try:
            with urllib.request.urlopen(req,timeout=90)as r:status=r.status;data=json.load(r)
        except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
        assert status==expected,(status,data)
        return data

def draft(region='zhejiang',title=None):return {'title':title or '真实业务验收 '+STAMP,'author':'验收作者甲','region':region,'genre':'letter','channel':'community','themes':['heritage'],'content':'这是一份用于验证真实投稿流程的家书。我们珍惜家风传承，也认真记录每一次修改与评审。'+STAMP,'copyrightAccepted':True,'attachments':[],'overseasLocation':''}

def main():
    admin=Client('devadmin','admin');zj=Client('region_zj','admin');bj=Client('region_bj','admin');expert=Client('expert_zj','admin');a=Client('member_zj');b=Client('member_bj')
    check('six real sessions and role profiles',admin.user['roles']==['national_admin'] and expert.user['roles']==['expert'])
    a.call('GET','/admin/workspace',expected=403)
    expert.command('saveContent',data={},admin=True,expected=403)
    check('members cannot enter admin and experts cannot run operations')
    a.call('GET','/workspace',headers={'Authorization':'Bearer invalid-session'},expected=401)
    check('expired workspace sessions return 401 instead of anonymous success')
    _,initial,h=a.call('GET','/me/draft');etag=h.get('ETag') or h.get('Etag');d=draft()
    _,saved,h2=a.call('PUT','/me/draft',d,{'If-Match':etag});fresh=h2.get('ETag') or h2.get('Etag')
    a.call('PUT','/me/draft',d,{'If-Match':etag},412)
    a.call('PUT','/me/draft',d,expected=428)
    check('cloud draft ETag and stale write rejection',fresh!=etag and saved['draft']['title']==d['title'])
    blob=b'%PDF-1.4\n% real private upload verification\n%%EOF\n'
    f=a.upload(blob);a.upload(b'not pdf',expected=422);a.upload(b'%PDF-'+b'x'*(10*1024*1024),expected=413)
    url=a.call('GET','/files/'+f['fileId']+'/download')[1]['url']
    with urllib.request.urlopen(url)as r: downloaded=r.read()
    assert hashlib.sha256(downloaded).digest()==hashlib.sha256(blob).digest()
    check('Chinese filename private multipart upload, validation and signed download',f['name']=='中文验收资料.pdf')
    b.call('GET','/files/'+f['fileId']+'/download',expected=404);expert.call('GET','/files/'+f['fileId']+'/download',expected=404)
    check('cross-owner and expert original attachment denial')
    d['attachments']=[f];a.call('PUT','/me/draft',d,{'If-Match':fresh});key=str(uuid.uuid4());work=a.call('POST','/submissions',d,{'Idempotency-Key':key})[1];sid=work['id']
    same=a.call('POST','/submissions',d,{'Idempotency-Key':key})[1]
    assert same['id']==sid
    a.call('POST','/submissions',{**d,'title':'different'}, {'Idempotency-Key':key},409)
    check('submission replay creates one work and rejects changed payload')
    check('accepted submission atomically clears matching cloud draft',a.call('GET','/me/draft')[1]['draft'] is None)
    b.call('GET',f'/submissions/{sid}/progress',expected=404);bj.call('GET',f'/submissions/{sid}/progress',expected=404)
    assert sid not in [x['id']for x in bj.workspace(True)['submissions']]
    bj.command('approveSubmission',sid,version=work['version'],admin=True,expected=404)
    bj.call('GET','/files/'+f['fileId']+'/download',expected=404)
    zj.call('GET','/files/'+f['fileId']+'/download')
    check('regional list/detail/write/file boundaries')
    zj.act('returnSubmission','submissions',sid,{'reason':'请补充家风故事的真实细节后再次提交。'})
    returned=next(x for x in a.workspace()['works'] if x['id']==sid)
    revised={**d,'content':d['content']+'这是修改后的新版本，补充了更多故事细节。'}
    w2=a.call('POST',f'/submissions/{sid}/revisions',revised,{'Idempotency-Key':str(uuid.uuid4()),'If-Match':f'"{returned["version"]}"'})[1]
    progress=a.call('GET',f'/submissions/{sid}/progress')[1]
    check('return and resubmit keep work ID with immutable original revision',w2['id']==sid and len(progress['revisions'])==2 and progress['revisions'][0]['content']['content']==d['content'])
    flow=admin.workspace(True)['reviewFlow'];original={k:flow[k] for k in ('blind','deadlineDays','enabled')}
    admin.command('configureReviewFlow',data={'blind':True,'deadlineDays':7,'enabled':[True,True,False,False,False,False]},version=flow['lockVersion'],admin=True)
    zj.act('approveSubmission','submissions',sid)
    cfg=admin.workspace(True)['reviewFlow'];admin.command('configureReviewFlow',data=original,version=cfg['lockVersion'],admin=True)
    zj.act('assignReview','submissions',sid,{'expertId':'10004'},expected=422)
    zj.act('prepareBlindMaterial','submissions',sid,{'content':'这份脱敏家书记述了家风传承与日常生活，不包含作者身份或原始文件。','confirmed':True})
    expertAccount=next(x for x in admin.workspace(True)['users']if x['id']=='10004')
    admin.command('toggleUser','10004',{'enabled':False},expertAccount['lockVersion'],True)
    zj.act('assignReview','submissions',sid,{'expertId':'10004'},expected=409)
    assert zj.call('GET','/auth/me')[1]['id']=='10002'
    expertAccount=next(x for x in admin.workspace(True)['users']if x['id']=='10004')
    admin.command('toggleUser','10004',{'enabled':True},expertAccount['lockVersion'],True)
    check('disabled experts cannot receive tasks without invalidating operator session')
    zj.act('assignReview','submissions',sid,{'expertId':'10004','dueAt':(dt.datetime.now(dt.timezone.utc)+dt.timedelta(seconds=2)).isoformat()})
    task=next(x for x in expert.workspace()['reviewTasks'] if x['submissionId']==sid)
    time.sleep(2.1)
    expert.command('review.submit',task['id'],{'scores':[28,28,23,14],'comment':'超过时间窗口的评分必须被拒绝。'},task['version'],expected=409)
    zj.act('assignReview','submissions',sid,{'expertId':'10004','dueAt':(dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=1)).isoformat()})
    newtask=next(x for x in expert.workspace()['reviewTasks'] if x['submissionId']==sid and x['status']=='pending')
    expert.command('review.submit',task['id'],{'scores':[28,28,23,14],'comment':'失效的旧任务不能修改重新分配的任务。'},task['version'],expected=412)
    task=newtask
    check('expired tasks rejected, reallocated and old task invalidated')
    assert task['content'].startswith('这份脱敏家书') and 'attachments' not in task
    b.command('review.submit',task['id'],{'scores':[30,30,25,15],'comment':'这是不属于当前用户的任务。'},task['version'],expected=404)
    expert.command('review.submit',task['id'],{'scores':[31,30,25,15],'comment':'分数越界需要被拒绝。'},task['version'],expected=422)
    expert.command('review.submit',task['id'],{'scores':[28,28,23,14],'comment':'作品完整体现家风传承，建议进入下一阶段。'},task['version'])
    expert.command('review.submit',task['id'],{'scores':[28,28,23,14],'comment':'重复评审不能覆盖原有意见。'},task['version'],expected=412)
    check('WarmFlow assigned blind task, four-dimensional scoring and duplicate rejection')
    reviewed=zj.entity('submissions',sid)
    check('workflow version remains frozen after config changes',reviewed['progressIndex']==6 and not reviewed['published'])
    zj.act('decideSubmission','submissions',sid,{'result':'shortlisted','note':'管理员根据试点评审意见确认入围。'})
    assert sid not in [x['id']for x in b.workspace()['works']]
    zj.act('publishSubmission','submissions',sid,{'published':True})
    published=next(x for x in b.workspace()['works']if x['id']==sid)
    check('manual decision separated from publication and public fields', 'attachments' not in published and 'reviews' not in published)
    zj.act('publishSubmission','submissions',sid,{'published':False})
    check('publication withdrawal reflected immediately',sid not in [x['id']for x in b.workspace()['works']])
    zj.act('publishSubmission','submissions',sid,{'published':True})
    zj.act('decideSubmission','submissions',sid,{'result':'rejected','note':'验收结果变更时必须同步撤销公开。'})
    check('changed rejection retracts an already public manuscript',sid not in [x['id']for x in b.workspace()['works']])
    content=zj.command('saveContent',data={'title':'中文资讯验收 '+STAMP,'category':'资讯','language':'中文','region':'浙江省','summary':'真实发布验证','body':'这篇资讯用于验证草稿、发布和下架。'},admin=True)['result'];cid=content['id']
    assert cid not in [x['id']for x in a.workspace()['news']]
    zj.act('setContentStatus','contents',cid,{'status':'已发布'});assert cid in [x['id']for x in a.workspace()['news']]
    zj.act('setContentStatus','contents',cid,{'status':'已下架'});assert cid not in [x['id']for x in a.workspace()['news']]
    check('content draft/publish/withdraw visibility')
    col=zj.command('saveCollection',data={'title':'家风验收卷 '+STAMP,'subtitle':'真实章节存储','region':'浙江省','theme':'家风传承'},admin=True)['result'];coid=col['id']
    zj.act('saveChapter','collections',coid,{'title':'第一章','author':'编纂组','body':'这一章验证典籍章节的真实保存与发布。'})
    zj.act('collectVolume','collections',coid);assert coid in [x['id']for x in a.workspace()['classics']]
    chapter=zj.entity('collections',coid)['chapters'][0]
    zj.act('saveChapter','collections',coid,{'chapterId':chapter['id'],'title':'修订第一章','author':'编纂组','body':'修改章节后需要重新确认入藏，避免草稿直接公开。'})
    check('collection publishing and edit withdrawal',coid not in [x['id']for x in a.workspace()['classics']])
    now=dt.datetime.now(dt.timezone.utc)
    activity=zj.command('saveActivity',data={'title':'并发名额验收 '+STAMP,'type':'家风活动','region':'浙江省','location':'本机联调','startAt':(now+dt.timedelta(days=1)).isoformat(),'endAt':(now+dt.timedelta(days=2)).isoformat(),'capacity':1,'summary':'用两个真实账号验证最后一个名额。'},admin=True)['result'];aid=activity['id']
    zj.act('setActivityStatus','activities',aid,{'status':'报名中'})
    with futures.ThreadPoolExecutor(2)as pool:
        outcomes=list(pool.map(lambda c:(c,c.command('activity.register',aid,expected=None)),[a,b]))
    winners=[c for c,r in outcomes if 'result'in r]
    check('concurrent registration never exceeds capacity',len(winners)==1 and len(zj.entity('activities',aid)['registrations'])==1)
    winner=winners[0];winner.command('activity.cancel',aid);a.command('activity.register',aid);a.command('activity.register',aid)
    zj.act('setActivityStatus','activities',aid,{'status':'进行中'});a.command('activity.checkIn',aid)
    check('cancellation/re-registration/duplicate/check-in ledger',len(zj.entity('activities',aid)['registrations'])==1 and zj.entity('activities',aid)['registrations'][0]['checkedIn'])
    check('check-in timestamp is recorded independently of registration',bool(a.workspace()['learning']['checkIns'].get(aid)))
    course=zj.command('saveCourse',data={'title':'真实学习台账验收 '+STAMP,'category':'家风教育','duration':20,'chapters':3,'description':'这门试点课程用于检验导读完成与真实学习记录聚合。','teacher':'家风教研组'},admin=True)['result'];courseid=course['id'];zj.act('toggleCourse','courses',courseid,{'status':'已上架'})
    changedDescription='课程导读已真实修订，用于确认后台编辑后用户端正文同步更新。'
    zj.command('saveCourse',courseid,{'title':course['title'],'category':'家风教育','duration':20,'chapters':1,'description':changedDescription,'teacher':'家风教研组'},zj.entity('courses',courseid)['lockVersion'],True)
    check('course edits update the actual published introductory lesson',next(c for c in a.workspace()['courses'] if c['id']==courseid)['lessons'][0]['body']==changedDescription)
    a.command('course.progress',courseid,{'lessonId':'missing'},expected=422);a.command('course.progress',courseid,{'lessonId':'intro'})
    check('learning completion uses actual published lessons',bool(a.workspace()['learning']['courses'][courseid].get('completedAt')))
    product=zj.command('saveProduct',data={'title':'公益库存验收 '+STAMP,'stock':2,'quota':2,'region':'浙江省','description':'真实库存事务验证'},admin=True)['result'];pid=product['id'];claimkey=str(uuid.uuid4());claimdata={'kind':'public','organization':'验收单位','quantity':2,'purpose':'验证公益库存发放的数据库事务。'}
    claim=a.command('welfare.claim',pid,claimdata,key=claimkey)['result'];same=a.command('welfare.claim',pid,claimdata,key=claimkey)['result'];assert claim['id']==same['id']
    qid=claim['id'];zj.act('processClaim','welfareClaims',qid,{'action':'approve'});q=zj.entity('welfareClaims',qid);deliverkey=str(uuid.uuid4());zj.command('processClaim',qid,{'action':'deliver'},q['lockVersion'],True,deliverkey);zj.command('processClaim',qid,{'action':'deliver'},q['lockVersion'],True,deliverkey)
    check('idempotent claim and delivery deduct stock once',zj.entity('products',pid)['stock']==0)
    cross=b.command('welfare.claim',pid,claimdata)['result']
    bj.command('processClaim',cross['id'],{'action':'approve'},cross['version'],True,expected=404)
    check('cross-region claims routed to product operator',cross['id'] not in [x['id'] for x in bj.workspace(True)['welfareClaims']] and cross['id'] in [x['id'] for x in zj.workspace(True)['welfareClaims']])
    b.command('welfare.cancel',cross['id'])
    concurrent=draft(title='并发幂等受理验收 '+STAMP);idem=str(uuid.uuid4())
    with futures.ThreadPoolExecutor(2)as pool:
        repeated=list(pool.map(lambda _:a.call('POST','/submissions',concurrent,{'Idempotency-Key':idem})[1],range(2)))
    check('simultaneous same-key submissions produce exactly one manuscript',repeated[0]['id']==repeated[1]['id'] and sum(x['title']==concurrent['title'] for x in a.workspace()['works'])==1)
    _,_,dh=a.call('GET','/me/draft');other=draft(title='并发设备的新草稿 '+STAMP);a.call('PUT','/me/draft',other,{'If-Match':dh.get('ETag')or dh.get('Etag')})
    a.call('POST','/submissions',draft(title='来自另一窗口的提交 '+STAMP),{'Idempotency-Key':str(uuid.uuid4())})
    check('submission leaves a different concurrent cloud draft intact',a.call('GET','/me/draft')[1]['draft']['title']==other['title'])
    stockproduct=zj.command('saveProduct',data={'title':'库存并发验收 '+STAMP,'stock':1,'quota':1,'region':'浙江省','description':'不同运营账号并发发放不得超发'},admin=True)['result'];stockid=stockproduct['id']
    claims=[c.command('welfare.claim',stockid,{**claimdata,'quantity':1})['result'] for c in (a,b)]
    for c in claims:zj.act('processClaim','welfareClaims',c['id'],{'action':'approve'})
    with futures.ThreadPoolExecutor(2)as pool:
        delivered=list(pool.map(lambda pair:pair[0].act('processClaim','welfareClaims',pair[1]['id'],{'action':'deliver'},expected=None),zip([admin,zj],claims)))
    check('parallel delivery never overspends inventory',sum('result' in r for r in delivered)==1 and zj.entity('products',stockid)['stock']==0)
    notice=zj.command('saveNotificationDraft',data={'title':'真实站内消息 '+STAMP,'audience':'全部用户','content':'这是发给获准地区用户的真实站内通知，验证消息隔离。'},admin=True)['result'];zj.act('publishNotification','notificationDrafts',notice['id']);mine=[n for n in a.workspace()['notifications']if n['title'].endswith(STAMP)];other=[n for n in b.workspace()['notifications']if n['title'].endswith(STAMP)]
    check('regional in-app notification routing',mine and not other);a.command('notification.read',mine[0]['id'])
    assert any(n['id']==mine[0]['id'] and n['read'] for n in a.workspace()['notifications'])
    u=next(x for x in admin.workspace(True)['users']if x['username']=='member_bj');admin.command('toggleUser',u['id'],{'enabled':False},u['lockVersion'],True);b.call('GET','/auth/me',expected=401);u2=next(x for x in admin.workspace(True)['users']if x['id']==u['id']);admin.command('toggleUser',u['id'],{'enabled':True},u2['lockVersion'],True)
    check('disabled account session revoked and operator can re-enable',Client('member_bj').user['id']==u['id'])
    _,_,last=a.call('GET','/me/draft');a.call('PUT' if initial['draft'] is not None else 'DELETE','/me/draft',initial['draft'],{'If-Match':last.get('ETag')or last.get('Etag')})
    check('probe restores previous member draft')
    out={'testedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'baseUrl':BASE,'checks':RESULTS,'recordIds':{'submission':sid,'file':f['fileId'],'activity':aid,'product':pid},'fileSha256':hashlib.sha256(blob).hexdigest()}
    path=ROOT/'deploy/.local/business-probe.json';path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print('All',len(RESULTS),'real integration checks passed; evidence:',path)

if __name__=='__main__': main()
