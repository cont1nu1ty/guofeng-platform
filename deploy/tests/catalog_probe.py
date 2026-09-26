#!/usr/bin/env python3
"""Exercise catalog publication/security against the isolated local runtime.

Creates identifiable temporary records, then removes only those records. Existing
catalog/user edits are not changed. Preference/config test changes are restored.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid
HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('catalog_seed', HERE / 'seed-catalog.py')
seed = importlib.util.module_from_spec(spec); spec.loader.exec_module(seed)
base = seed.base
OUT = HERE.parent / 'docs/verification/previews/catalog-2026-09-26'
checks=[]
def check(label, condition):
    if not condition: raise AssertionError(label)
    checks.append({'check':label,'passed':True})

def request(client, method, path, data=None, expected=200, key=None):
    headers={'Content-Type':'application/json'}
    if client: headers['Authorization']='Bearer '+client.token
    if key: headers['Idempotency-Key']=key
    req=urllib.request.Request(base.BASE+path,method=method,headers=headers,
         data=None if data is None else json.dumps(data,ensure_ascii=False).encode())
    try:
        response=base.HTTP.open(req,timeout=60)
        status=response.status
        raw=response.read()
    except urllib.error.HTTPError as exc:
        status=exc.code;raw=exc.read()
    parsed=json.loads(raw) if raw else {}
    if status!=expected:
        raise AssertionError(f'{method} {path}: expected {expected}, got {status}: {parsed.get("code")} {parsed.get("message")}')
    return parsed

def cmd(client,name,data=None,entity='',version=None,expected=200,admin=False,key=None):
    body={'command':name,'entityId':entity,'data':data or {}}
    if version is not None:body['version']=version
    return request(client,'POST','/admin/commands' if admin else '/commands',body,expected,key or 'catalog-qa:'+str(uuid.uuid4()))

def private_error(label, error, code, forbidden=()):
    check(label+' has a stable error code and request ID',
          error.get('code')==code and bool(error.get('requestId')))
    serialized=json.dumps(error,ensure_ascii=False)
    check(label+' exposes no file metadata or storage URL',
          set(error)=={'code','message','requestId'}
          and not any(value and value in serialized for value in forbidden)
          and 'X-Amz-' not in serialized and 'object_key' not in serialized)

def upload(client, filename, blob, purpose=None, expected=422):
    boundary='catalog-qa-'+uuid.uuid4().hex
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
          'Content-Type: video/mp4\r\n\r\n').encode()+blob+f'\r\n--{boundary}--\r\n'.encode()
    path='/files'+('' if purpose is None else '?purpose='+purpose)
    req=urllib.request.Request(base.BASE+path,data=body,headers={
        'Authorization':'Bearer '+client.token,'Content-Type':'multipart/form-data; boundary='+boundary})
    try:
        with base.HTTP.open(req,timeout=150) as response:
            status=response.status;raw=response.read()
    except urllib.error.HTTPError as exc:
        status=exc.code;raw=exc.read()
    try:parsed=json.loads(raw) if raw else {}
    except ValueError:parsed={'gatewayRejected':True}
    if status!=expected:
        raise AssertionError(f'multipart {path}: expected {expected}, got {status}: {parsed.get("code")}')
    return parsed

def malformed_upload(client):
    req=urllib.request.Request(base.BASE+'/files?purpose=media',data=b'private-parser-test-content',headers={
        'Authorization':'Bearer '+client.token,
        'Content-Type':'multipart/form-data; boundary=missing-boundary'})
    try:
        with base.HTTP.open(req,timeout=30) as response:
            status=response.status;raw=response.read()
    except urllib.error.HTTPError as exc:
        status=exc.code;raw=exc.read()
    if status!=400:raise AssertionError(f'malformed multipart expected 400, got {status}')
    return json.loads(raw)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None

def asset(file_id,expected=302):
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    try:
        r=opener.open(base.BASE+'/files/'+file_id+'/public',timeout=30)
        status=r.status; headers=dict(r.headers)
    except urllib.error.HTTPError as exc:
        status=exc.code;headers=dict(exc.headers)
    check('public asset status '+str(expected),status==expected)
    return headers

def main():
    if seed.PROJECT!='jiafeng-dev' and not seed.PROJECT.startswith('jiafeng-demo-'): raise ValueError('Local development projects only')
    admin=seed.Client('devadmin','admin');zj=seed.Client('region_zj','admin');bj=seed.Client('region_bj','admin')
    member=seed.Client('member_zj');other=seed.Client('member_bj');expert=seed.Client('expert_zj','admin')
    manifest=json.loads(seed.STATE.read_text());created=[]
    run_id=uuid.uuid4().hex
    upload_names=[];server_media_limit_verified=False;completed=False
    # Snapshot only the one member preference row touched in this test.
    pref_id='newsPrefs_'+str(other.user['id'])
    previous_pref=base.sql('SELECT CAST(payload AS CHAR) FROM jf_entity WHERE id='+base.lit(pref_id)+';')
    member_preferences_before=member.workspace()['newsPreferences']
    config=admin.workspace(True)['homepageConfig']
    old_config=json.loads(json.dumps(config));config_changed=False
    initial_user_title=base.sql("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')) FROM jf_entity WHERE id='content_ab5abcc7fb214c339cd0bf96c27680af';")
    started=dt.datetime.now(dt.timezone.utc).isoformat()
    def make(name,data):
        value=cmd(admin,name,data,admin=True)['result'];created.append(value['id']);return value
    def row(collection,id):return next(v for v in admin.workspace(True)[collection] if v['id']==id)
    try:
        public=request(None,'GET','/workspace')
        keys=manifest['refs']['banners']
        check('six Chinese carousel categories are present',set(x['category'] for x in public['banners'] if x['language']=='zh')=={'policy','contribution','celebration','collection','study','integrity'})
        check('future, expired and draft banners excluded',all(keys[k]['id'] not in {x['id'] for x in public['banners']} for k in ['banner_future','banner_expired','banner_draft']))
        check('English carousel published independently',any(x['language']=='en' for x in public['banners']))
        check('private member video and support records absent for guest',not public['mediaSubmissions'] and not public['supportTickets'])
        check('public media hides file metadata and review history',all(not set(x).intersection({'sourceFileId','posterFileId','reviewNote','revisions','authorName'}) for x in public['mediaItems']))
        n=int(base.sql("SELECT COUNT(*) FROM jf_entity WHERE kind='submission';"))
        check('homepage submission count equals stored records',public['homeStats']['submissions']==n)
        for collection in ['banners','mediaItems','venues','hallPeople','supportTickets']:
            check(collection+' regional workspace scope',all(x['regionId']=='zhejiang' for x in zj.workspace(True)[collection]))
            check(collection+' expert workspace empty',not expert.workspace(True)[collection])
        refs=manifest['refs'];original_file=base.sql('SELECT id FROM jf_file WHERE file_type=\'pdf\' LIMIT 1;')
        asset(original_file,404)
        admin_file=manifest['files']['devadmin:family-letter.mp4']['fileId']
        head=asset(admin_file)
        location=head.get('Location') or head.get('location')
        check('public assets use five-minute signed URLs','X-Amz-Expires=300' in location)
        check('asset response forbids caching', 'no-store' in (head.get('Cache-Control') or head.get('cache-control','')))
        with base.HTTP.open(location,timeout=30) as response:blob=response.read()
        check('published S3 file checksum',hashlib.sha256(blob).hexdigest()==manifest['files']['devadmin:family-letter.mp4']['sha256'])
        member_file=manifest['files']['member_zj:everyday-values.mp4']['fileId']
        asset(member_file,404)
        denied=request(other,'GET','/files/'+member_file+'/download',expected=404)
        private_error('cross-owner source denial',denied,'NOT_FOUND',(member_file,'everyday-values.mp4'))
        check('unpublished member media inaccessible to another member',True)
        request(bj,'GET','/files/'+member_file+'/download',expected=404)
        check('unpublished media inaccessible to another region',True)
        signed=request(zj,'GET','/files/'+member_file+'/download')
        check('assigned region operator can review private source',signed.get('expiresIn')==300)
        own=member.workspace()['mediaSubmissions']; target=next(x for x in own if x['status']=='已退回')
        cmd(other,'media.resubmit',target,target['id'],target['lockVersion'],expected=404)
        check('another member cannot resubmit the original media',True)
        cmd(member,'media.submit',{'title':'越权文件验证','language':'zh','region':'zhejiang','category':'letter','type':'short','sourceFileId':admin_file},expected=404)
        check('foreign file cannot be bound to member media',True)
        cmd(member,'media.like',entity=target['id'],expected=404)
        check('unpublished media cannot be liked',True)
        # Complete a new member-owned lifecycle using a previously private file.
        # The seed media records using that same file remain unchanged.
        member_seed_ids={x['id'] for x in own}
        seed_before=base.sql('SELECT id,version,CAST(payload AS CHAR) FROM jf_entity WHERE id IN ('+
            ','.join(base.lit(x) for x in sorted(member_seed_ids))+') ORDER BY id;')
        media_data={'title':'临时会员媒体闭环验证 '+run_id[:8],'language':'zh','region':'zhejiang',
            'sample':True,'category':'letter','type':'short','sourceFileId':member_file,
            'excerpt':'这条临时媒体仅用于验证真实投稿、退修、发布与下架，结束后清理。',
            'transcript':'初稿：把守信的约定写进家庭日常。','duration':'00:08'}
        submit_key='catalog-qa:member-media:'+run_id
        submitted=cmd(member,'media.submit',media_data,key=submit_key)['result']
        created.append(submitted['id'])
        check('member media submission starts in pending review',submitted['status']=='待审核')
        replay=cmd(member,'media.submit',media_data,key=submit_key)['result']
        check('member media submission retry does not duplicate the work',replay['id']==submitted['id'])
        check('pending member media is absent from public catalog',submitted['id'] not in
              {x['id'] for x in request(None,'GET','/workspace')['mediaItems']})
        hidden=asset(member_file,404)
        check('pending media cannot obtain a public signed URL',not (hidden.get('Location') or hidden.get('location')))
        returned=cmd(zj,'setMediaStatus',{'status':'已退回','reviewNote':'请补充对守信约定的具体说明。'},
            submitted['id'],submitted['lockVersion'],admin=True)['result']
        own_returned=next(x for x in member.workspace()['mediaSubmissions'] if x['id']==submitted['id'])
        check('member sees the actual regional return note',own_returned['status']=='已退回'
              and own_returned['reviewNote']=='请补充对守信约定的具体说明。')
        revision={**media_data,'transcript':media_data['transcript']+'修订：每个周末记录一次按时赴约的行动。'}
        denied=cmd(other,'media.resubmit',revision,submitted['id'],returned['lockVersion'],expected=404)
        private_error('foreign member media revision denial',denied,'NOT_FOUND',(member_file,media_data['title']))
        cmd(member,'media.resubmit',revision,submitted['id'],submitted['lockVersion'],expected=412)
        check('stale media revision cannot overwrite a newer return',True)
        revised=cmd(member,'media.resubmit',revision,submitted['id'],returned['lockVersion'])['result']
        check('member resubmission keeps ID and returns to pending review',
              revised['id']==submitted['id'] and revised['status']=='待审核' and revised['reviewNote']=='')
        check('media resubmission retains previous text and return note',
              len(revised['revisions'])==1 and revised['revisions'][0]['content']['transcript']==media_data['transcript']
              and revised['revisions'][0]['content']['reviewNote']=='请补充对守信约定的具体说明。')
        published=cmd(zj,'setMediaStatus',{'status':'已发布'},revised['id'],revised['lockVersion'],admin=True)['result']
        live=next(x for x in request(None,'GET','/workspace')['mediaItems'] if x['id']==published['id'])
        check('regional approval publishes the actual revised media',live['transcript']==revision['transcript']
              and live['source']=='/api/v1/files/'+member_file+'/public')
        check('published member media exposes no private review or identity fields',
              not set(live).intersection({'sourceFileId','posterFileId','reviewNote','revisions','authorName','ownerId'}))
        public_headers=asset(member_file)
        signed_url=public_headers.get('Location') or public_headers.get('location')
        with base.HTTP.open(signed_url,timeout=30) as response: published_blob=response.read()
        check('published member media downloads the original S3 bytes',
              hashlib.sha256(published_blob).hexdigest()==manifest['files']['member_zj:everyday-values.mp4']['sha256'])
        withdrawn=cmd(zj,'setMediaStatus',{'status':'已下架'},published['id'],published['lockVersion'],admin=True)['result']
        check('media withdrawal immediately removes the public catalog entry',withdrawn['id'] not in
              {x['id'] for x in request(None,'GET','/workspace')['mediaItems']})
        denied_headers=asset(member_file,404)
        check('withdrawn member media cannot obtain a new signed URL',
              not (denied_headers.get('Location') or denied_headers.get('location')))
        check('media lifecycle leaves seeded member records untouched',seed_before==base.sql(
            'SELECT id,version,CAST(payload AS CHAR) FROM jf_entity WHERE id IN ('+
            ','.join(base.lit(x) for x in sorted(member_seed_ids))+') ORDER BY id;'))
        # Upload limits are independent of media binding. No new files should be
        # persisted for any rejected request, and errors must not expose object keys.
        sample_video=(seed.ASSETS/'everyday-values.mp4').read_bytes()
        default_name='默认用途拒绝媒体-'+run_id+'.mp4';upload_names.append(default_name)
        failure=upload(member,default_name,sample_video)
        private_error('default manuscript upload rejects MP4',failure,'INVALID_FILE_TYPE',(default_name,))
        fake_name='伪扩展拒绝媒体-'+run_id+'.mp4';upload_names.append(fake_name)
        failure=upload(member,fake_name,b'This is plain text, not an MP4 container.',purpose='media')
        private_error('media upload rejects a fake extension',failure,'INVALID_FILE_TYPE',(fake_name,))
        large_name='超额拒绝媒体-'+run_id+'.mp4';upload_names.append(large_name)
        large=sample_video+b'\x00'*(51*1024*1024-len(sample_video))
        failure=upload(member,large_name,large,purpose='media',expected=413)
        del large
        private_error('server rejects a 51MiB media file',failure,'FILE_TOO_LARGE',(large_name,))
        server_media_limit_verified=True
        private_error('malformed multipart returns a sanitized failure',malformed_upload(member),
                      'INVALID_REQUEST',('private-parser-test-content',))
        check('all rejected uploads leave no usable file row',int(base.sql(
            'SELECT COUNT(*) FROM jf_file WHERE owner_id='+str(member.user['id'])+' AND name IN ('+
            ','.join(base.lit(x) for x in upload_names)+');'))==0)
        manuscript={'title':'临时稿件附件绕过验证 '+run_id[:8],'author':'验证投稿人','region':'zhejiang',
            'genre':'letter','channel':'community','themes':['heritage'],'copyrightAccepted':True,
            'overseasLocation':'','content':'这条请求用于确认音视频不能伪装成原投稿附件，不应保存成稿件。',
            'attachments':[{'fileId':member_file}]}
        failure=request(member,'POST','/submissions',manuscript,expected=422,key='catalog-qa:wrong-attachment:'+run_id)
        private_error('media ID cannot bypass manuscript attachment types',failure,'INVALID_FILE_TYPE',(member_file,))
        check('rejected media attachment does not create a manuscript',int(base.sql(
            "SELECT COUNT(*) FROM jf_entity WHERE kind='submission' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title'))="+
            base.lit(manuscript['title'])+';'))==0)
        # New editorial record; publish/withdraw drives both its banner and public asset.
        media=make('saveMedia',{'title':'临时联动验证素材','language':'zh','region':'zhejiang','sample':True,'category':'letter','type':'short','sourceFileId':admin_file})
        cmd(bj,'setMediaStatus',{'status':'已发布'},media['id'],media['lockVersion'],expected=404,admin=True)
        check('cross-region catalog mutation blocked',True)
        banner=make('saveBanner',{'title':'临时联动验证轮播','language':'zh','region':'zhejiang','category':'celebration','targetScreen':'media','targetId':media['id']})
        cmd(admin,'setBannerStatus',{'status':'已发布'},banner['id'],banner['lockVersion'],expected=409,admin=True)
        check('draft target blocks carousel publication',True)
        media=cmd(admin,'setMediaStatus',{'status':'已发布'},media['id'],media['lockVersion'],admin=True)['result']
        banner=cmd(admin,'setBannerStatus',{'status':'已发布'},banner['id'],banner['lockVersion'],admin=True)['result']
        check('publishing a valid carousel immediately reaches guest workspace',banner['id'] in {x['id'] for x in request(None,'GET','/workspace')['banners']})
        cmd(admin,'setBannerStatus',{'status':'已下架'},banner['id'],banner['lockVersion']-1,expected=412,admin=True)
        check('stale edit cannot overwrite newer banner',True)
        media=cmd(admin,'setMediaStatus',{'status':'已下架'},media['id'],media['lockVersion'],admin=True)['result']
        check('withdrawing the target hides its linked banner',banner['id'] not in {x['id'] for x in request(None,'GET','/workspace')['banners']})
        cmd(zj,'saveBanner',{'title':'跨区创建验证','language':'zh','region':'beijing','category':'policy','targetScreen':'news'},expected=404,admin=True)
        check('region filter cannot expand creation privileges',True)
        cmd(admin,'saveBanner',{'title':'无效排期验证','language':'zh','region':'all','category':'policy','targetScreen':'news','startsAt':'2026-12-01T00:00:00Z','endsAt':'2026-11-01T00:00:00Z'},expected=422,admin=True)
        check('invalid schedule rejected',True)
        cmd(admin,'saveVenue',{'title':'单边坐标验证','language':'zh','region':'all','category':'practice','latitude':10},expected=422,admin=True)
        check('incomplete navigation coordinates rejected',True)
        cmd(admin,'saveHallPerson',{'title':'危险链接验证','language':'zh','region':'all','sourceUrl':'javascript:alert(1)'},expected=422,admin=True)
        check('non-HTTPS source link rejected',True)
        # Layout versioning is shared across all users.
        changed={'sections':[{**s,'order':5-i,'enabled':s['id']!='stats'} for i,s in enumerate(config['sections'])]}
        cmd(zj,'saveHomepageConfig',changed,version=config['lockVersion'],expected=403,admin=True)
        config=cmd(admin,'saveHomepageConfig',changed,version=config['lockVersion'],admin=True)['result'];config_changed=True
        check('homepage layout persists and affects public contract',request(None,'GET','/workspace')['homepageConfig']['sections']==changed['sections'])
        cmd(admin,'saveHomepageConfig',changed,version=config['lockVersion']-1,expected=412,admin=True)
        check('homepage layout detects concurrent editing',True)
        # Real subscription delivery, followed by exact removal of QA news/messages.
        cmd(other,'news.preferences',{'categories':['industry'],'updates':True,'digest':'instant','quietHours':True})
        check('subscription preferences persist on account',other.workspace()['newsPreferences']['categories']==['industry'])
        check('subscription preferences isolated from another account',member.workspace()['newsPreferences']==member_preferences_before)
        content=make('saveContent',{'title':'临时订阅验证资讯','category':'行业动态','topic':'everyday','language':'中文','region':'all','summary':'仅用于验证站内订阅的临时资讯','body':'这是一条验证完成后自动清理的资讯，用于确认订阅偏好产生真实站内消息。'})
        pubkey='catalog-qa:publish:'+uuid.uuid4().hex
        cmd(admin,'setContentStatus',{'status':'已发布'},content['id'],content['lockVersion'],admin=True,key=pubkey)
        notices=[n for n in other.workspace()['notifications'] if n.get('targetId')==content['id']]
        check('publishing subscribed category creates a real member notification',len(notices)==1)
        cmd(admin,'setContentStatus',{'status':'已发布'},content['id'],content['lockVersion'],admin=True,key=pubkey)
        check('idempotent publication does not duplicate notification',len([n for n in other.workspace()['notifications'] if n.get('targetId')==content['id']])==1)
        created.extend(n['id'] for n in notices)
        # Another region should not receive a regional post.
        regional=make('saveContent',{'title':'临时区域订阅验证','category':'行业动态','topic':'everyday','language':'中文','region':'zhejiang','summary':'只面向浙江的临时资讯','body':'这是一条区域范围验证资讯，不应发送给北京订阅账号。'})
        cmd(admin,'setContentStatus',{'status':'已发布'},regional['id'],regional['lockVersion'],admin=True)
        check('regional news does not notify an out-of-region subscriber',not any(n.get('targetId')==regional['id'] for n in other.workspace()['notifications']))
        # A new support ticket returns a real answer to its author only.
        ticket_subject='临时工单验证 '+run_id[:8]
        ticket=cmd(member,'support.create',{'subject':ticket_subject,'body':'请协助核对这条临时测试记录的处理流程。','category':'submission'})['result'];created.append(ticket['id'])
        check('ticket is not visible to another member',ticket['id'] not in {t['id'] for t in other.workspace()['supportTickets']})
        cmd(bj,'replySupportTicket',{'reply':'跨区回复','status':'已回复'},ticket['id'],ticket['lockVersion'],expected=404,admin=True)
        cmd(zj,'replySupportTicket',{'reply':'临时工单验证已完成。','status':'已回复'},ticket['id'],ticket['lockVersion'],admin=True)
        check('regional operator reply is visible to author',next(t for t in member.workspace()['supportTickets'] if t['id']==ticket['id'])['reply']=='临时工单验证已完成。')
        created.extend(n['id'] for n in member.workspace()['notifications'] if ticket_subject in n.get('content',''))
        check('pre-existing user title remains unchanged',initial_user_title==base.sql("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')) FROM jf_entity WHERE id='content_ab5abcc7fb214c339cd0bf96c27680af';"))
        completed=True
    finally:
        if config_changed:
            current=admin.workspace(True)['homepageConfig']
            cmd(admin,'saveHomepageConfig',{'sections':old_config['sections']},version=current['lockVersion'],admin=True)
        if previous_pref:
            base.sql('UPDATE jf_entity SET payload='+base.lit(previous_pref)+' WHERE id='+base.lit(pref_id)+';')
        else:base.sql('DELETE FROM jf_entity WHERE id='+base.lit(pref_id)+';')
        if created:
            ids=','.join(base.lit(x) for x in created)
            # A pre-existing subscriber may also receive this probe's news. Remove
            # only notifications targeting our unique temporary catalog records.
            related=base.sql("SELECT id FROM jf_entity WHERE kind='notification' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.targetId')) IN ("+ids+');')
            if related:created.extend(related.splitlines())
            created=list(dict.fromkeys(created))
            ids=','.join(base.lit(x) for x in created)
            base.sql('DELETE FROM jf_entity WHERE id IN ('+ids+');')
        OUT.mkdir(parents=True,exist_ok=True)
        report={'startedAt':started,'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'project':seed.PROJECT,'passed':completed,
                'checks':checks,'temporaryEntitiesRemoved':len(created),'scope':'Real local APIs, database, signed S3 assets; original business records preserved.',
                'serverMediaLimitVerified':server_media_limit_verified,
                'limits':['Not WeChat device testing','No model inference, live stream, media transcoding or production authorization claim']}
        (OUT/'api-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':True,'checks':len(checks),'temporaryEntitiesRemoved':len(created)},ensure_ascii=False))

if __name__=='__main__':main()
