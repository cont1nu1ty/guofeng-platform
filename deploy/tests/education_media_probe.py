#!/usr/bin/env python3
"""Education/media checks against an explicitly configured isolated test stack.
Creates labelled synthetic records. Never use against the running user dataset.
"""
import io, json, os, subprocess, urllib.request, urllib.parse, urllib.error, uuid, wave
from pathlib import Path
from business_probe import Client, BASE, STAMP, check, RESULTS
OUT=Path(os.environ.get('JIAFENG_PROBE_OUTPUT','deploy/.local/non-ai-20261007'))

def edu(client,command,id='',data=None,version=None,admin=False,key=None,expected=200):
    body={'command':command,'entityId':id,'data':data or {}}
    if version is not None:body['version']=version
    return client.call('POST','/admin/education/commands' if admin else '/education/commands',body,{'Idempotency-Key':key or str(uuid.uuid4())},expected)[1]
def course(client,id):
    result=client.call('GET','/admin/education?q='+urllib.parse.quote(STAMP))[1]
    return next(x for x in result['courses'] if x['id']==id)
def track(client,id,action,version,data=None,expected=200):
    return client.call('POST',f'/admin/media/{id}/accessibility',{'action':action,'version':version,'data':data or {}},{'Idempotency-Key':str(uuid.uuid4())},expected)[1]
def upload(client,blob,name,expected=200):
    boundary='educationMedia'+uuid.uuid4().hex
    raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()+blob+f'\r\n--{boundary}--\r\n'.encode())
    req=urllib.request.Request(BASE+'/files?purpose=media',data=raw,headers={'Authorization':'Bearer '+client.token,'Content-Type':'multipart/form-data; boundary='+boundary})
    try:
        with urllib.request.urlopen(req,timeout=90)as r:status=r.status;result=json.load(r)
    except urllib.error.HTTPError as e:status=e.code;result=json.load(e)
    assert status==expected,(status,result)
    return result

def main():
    assert os.environ.get('JIAFENG_ISOLATED_TEST')=='1','Explicit isolated test flag required'
    OUT.mkdir(parents=True,exist_ok=True)
    admin=Client('devadmin','admin');zj=Client('region_zj','admin');bj=Client('region_bj','admin');a=Client('member_zj');b=Client('member_bj')
    content={'title':'教育媒体隔离验收 '+STAMP,'region':'zhejiang','description':'这门合成课程仅用于隔离环境验收，不代表正式培训或真实学时。','teacher':'隔离验收组','category':'清廉教育','duration':10,'passPercent':100,
      'lessons':[{'id':'l1','title':'阅读章节一','body':'履行承诺，认真完成阅读确认。','practice':'讨论诚信'},{'id':'l2','title':'阅读章节二','body':'尊重他人并承担家庭责任。','practice':'共同实践'}],
      'questions':[{'id':'q1','prompt':'哪种行为符合诚信？','options':[{'id':'a','text':'履行承诺'},{'id':'b','text':'轻率失信'}],'answerId':'a','explanation':'内部答案不应下发'}],'examQuestionIds':['q1']}
    created=edu(zj,'saveCourse',data=content,admin=True);cid=created['id']
    edu(zj,'publishCourse',cid,version=created['lockVersion'],admin=True)
    detail=a.call('GET',f'/education/courses/{cid}')[1]
    check('published learner DTO excludes answer keys and explanations',detail['course']['publicationVersion']==1 and 'answerId' not in json.dumps(detail) and '内部答案不应下发' not in json.dumps(detail,ensure_ascii=False))
    edu(a,'course.progress',cid,{'publicationVersion':1,'answers':{'q1':'a'}},expected=409)
    for lesson in ['l1','l2']:edu(a,'course.progress',cid,{'publicationVersion':1,'lessonId':lesson})
    failed=edu(a,'course.progress',cid,{'publicationVersion':1,'answers':{'q1':'b'}})
    passed=edu(a,'course.progress',cid,{'publicationVersion':1,'answers':{'q1':'a'}})
    check('server grading permits retries, requires reading and records version completion',not failed['progress']['complete'] and passed['result']['score']==100 and passed['progress']['complete'])
    old=course(zj,cid);edu(zj,'saveCourse',cid,{'title':'教育媒体更新草稿 '+STAMP},old['lockVersion'],True)
    assert a.call('GET',f'/education/courses/{cid}')[1]['course']['title']==content['title']
    edited=course(zj,cid);assert edited['questions'][0]['answerId']=='a'
    edu(zj,'publishCourse',cid,version=edited['lockVersion'],admin=True)
    current=a.call('GET',f'/education/courses/{cid}')[1]
    check('metadata edits retain quiz and immutable older completion',current['course']['publicationVersion']==2 and not current['progress']['complete'] and a.call('GET',f'/education/courses/{cid}?version=1')[1]['progress']['complete'])
    b.call('GET',f'/education/courses/{cid}?version=1',expected=404)
    identity=a.call('GET','/education/me')[1]['identity']
    edu(a,'education.requestIdentity',data={'organization':'隔离验收单位','requestNote':'人工核验用的合成身份申请，不代表实际干部资格。'},version=identity['version'] if identity else None)
    group={'name':'隔离学习班组 '+STAMP,'region':'zhejiang','courseId':cid,'publicationVersion':1,'cadreOnly':True,'declarationText':'我已阅读并确认遵守这份隔离验收承诺。','memberIds':[a.user['id']]}
    edu(zj,'education.saveGroup',data=group,admin=True,expected=409)
    identity=a.call('GET','/education/me')[1]['identity'];edu(zj,'education.reviewIdentity',a.user['id'],{'status':'approved','reason':'依据隔离测试资料人工确认，仅作功能验收。'},identity['version'],True)
    gid=edu(zj,'education.saveGroup',data=group,admin=True)['id']
    own=next(g for g in a.call('GET','/education/me')[1]['groups'] if g['id']==gid)
    edu(b,'education.confirmDeclaration',gid,{'accepted':True,'textHash':own['declarationHash']},own['version'],expected=404)
    edu(a,'education.confirmDeclaration',gid,{'accepted':True,'textHash':'wrong'},own['version'],expected=422)
    key=str(uuid.uuid4());answer={'accepted':True,'textHash':own['declarationHash']}
    one=edu(a,'education.confirmDeclaration',gid,answer,own['version'],key=key);two=edu(a,'education.confirmDeclaration',gid,answer,own['version'],key=key)
    check('manual cadre approval and exact-text declaration with idempotency',one['id']==two['id'])
    edu(zj,'education.saveGroup',gid,{**group,'declarationText':'第二版隔离验收承诺，请重新阅读确认。'},own['version'],True)
    updated=next(g for g in a.call('GET','/education/me')[1]['groups'] if g['id']==gid)
    assert not updated['confirmed']
    edu(a,'education.confirmDeclaration',gid,{'accepted':True,'textHash':updated['declarationHash']},updated['version'])
    ledger=next(g for g in zj.call('GET','/admin/education')[1]['learningGroups'] if g['id']==gid)
    check('commitment revisions preserve both exact historical confirmations',len(ledger['declarationHistory'])==2 and len({x['textHash']for x in ledger['declarationHistory']})==2)
    check('member candidate SQL scope excludes foreign account',not zj.call('GET','/admin/education/members?q='+b.user['id'])[1]['items'])
    video=OUT/'synthetic-short.mov'
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','lavfi','-i','testsrc=size=160x80:rate=10','-t','2','-pix_fmt','yuv420p','-c:v','libx264','-threads','1',str(video)],check=True)
    file=upload(zj,video.read_bytes(),'隔离合成短片.mov');upload(zj,b'invalid movie','invalid.mov',422)
    check('real MOV upload decoded and normalized to MP4',file['name'].endswith('.mp4') and file['mimeType']=='video/mp4' and 1.8<file['duration']<2.2)
    wav=io.BytesIO()
    with wave.open(wav,'wb')as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(b'\x00\x00'*24000)
    audio=upload(zj,wav.getvalue(),'隔离静音朗读.wav')
    media={'title':'人工字幕合成媒体 '+STAMP,'language':'zh','region':'zhejiang','sortOrder':0,'sample':True,'category':'lecture','type':'replay','collection':'隔离验收素材','excerpt':'这是合成视频与静音录音，仅作媒体闭环验收。','duration':'00:02','sourceFileId':file['fileId'],'posterFileId':'','transcript':'这是一段人工编写的验收字幕。'}
    saved=zj.command('saveMedia',data=media,admin=True)['result'];mid=saved['id']
    published=zj.command('setMediaStatus',mid,{'status':'已发布'},saved['lockVersion'],True)['result']
    data={'language':'zh','cues':[{'startMs':0,'endMs':1000,'text':'第一句人工字幕'},{'startMs':1000,'endMs':1900,'text':'第二句人工字幕'}],'narrationFileId':audio['fileId']}
    draft=track(zj,mid,'save',0,data)
    assert not a.call('GET',f'/media/{mid}/accessibility')[1]['cues']
    public=track(zj,mid,'publish',draft['version'])
    visible=a.call('GET',f'/media/{mid}/accessibility')[1]
    check('manual captions and narration appear only after their own publish',len(visible['cues'])==2 and bool(visible['narrationUrl']))
    bj.call('GET',f'/admin/media/{mid}/accessibility',expected=403)
    replacement=upload(zj,video.read_bytes(),'替换合成短片.mov')
    changed=zj.command('saveMedia',mid,{**media,'sourceFileId':replacement['fileId']},published['lockVersion'],True)['result']
    a.call('GET',f'/media/{mid}/accessibility',expected=404)
    republished=zj.command('setMediaStatus',mid,{'status':'已发布'},changed['lockVersion'],True)['result']
    check('source replacement hides stale caption timings',not a.call('GET',f'/media/{mid}/accessibility')[1]['cues'])
    track(zj,mid,'publish',public['version'])
    check('editor can republish captions for replacement after review',len(a.call('GET',f'/media/{mid}/accessibility')[1]['cues'])==2)
    data={'courseId':cid,'groupId':gid,'mediaId':mid,'tests':RESULTS}
    (OUT/'education-media-acceptance.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print('PASS total',len(RESULTS),flush=True)
if __name__=='__main__':main()
