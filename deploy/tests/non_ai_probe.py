#!/usr/bin/env python3
"""Non-AI release acceptance against an explicitly isolated test deployment; never resets data."""
import json
import os
from pathlib import Path
import secrets
import time
import uuid
import urllib.request
from business_probe import Client, ENV, ROOT, STAMP, draft, check, RESULTS

assert ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-non-ai-'), 'Use the isolated non-AI test project'
OUT=ROOT/'deploy/.local/non-ai-20261007'

def post(client,path,data):
    return client.call('POST',path,data,{'Idempotency-Key':str(uuid.uuid4())})[1]

def education(client,command,id='',data=None,version=None,admin=False):
    return post(client,'/admin/education/commands' if admin else '/education/commands',{'command':command,'entityId':id,'data':data or {},'version':version})

def wait_job(admin,id):
    for _ in range(40):
        job=next(x for x in admin.call('GET','/admin/exports?pageSize=100')[1]['items'] if x['id']==id)
        if job['status'] in ['completed','failed','cancelled']:
            assert job['status']=='completed', job
            return job
        time.sleep(1)
    raise AssertionError('export did not complete')

def download(client,path,name):
    url=client.call('GET',path)[1]['url']
    with urllib.request.urlopen(url,timeout=30) as response: payload=response.read()
    (OUT/name).write_bytes(payload)
    return payload

def main():
    admin=Client('devadmin','admin'); member=Client('member_zj'); other=Client('member_bj'); regional=Client('region_zj','admin')
    boot=admin.call('GET','/admin/bootstrap')[1]
    check('compact bootstrap excludes business arrays', 'submissions' not in boot and 'permissions' in boot)
    password=secrets.token_urlsafe(24)
    uname='content_'+STAMP
    account=post(admin,'/admin/accounts',{'username':uname,'name':'内容岗位验收','password':password,'organization':'隔离验收机构','roles':['content_operator'],'regionIds':['zhejiang']})
    operator=object.__new__(Client);operator.token='';operator.name=uname
    login=operator.call('POST','/auth/login',{'username':uname,'password':password,'client':'admin'})[1];operator.token=login['token'];operator.user=login['user']
    operator.call('GET','/admin/records/submissions',expected=403)
    operator.call('GET','/admin/accounts',expected=403)
    operator.call('GET','/admin/statistics',expected=403)
    operator.call('GET','/admin/records/contents')
    operator.command('approveSubmission','missing',version=1,admin=True,expected=403)
    check('content operator has content access but cannot read manuscripts/accounts/statistics or review')
    pages=admin.call('GET','/admin/records/contents?page=1&pageSize=1')[1]
    check('SQL page contract bounded and validated', len(pages['items'])<=1 and 'total' in pages)
    admin.call('GET','/admin/records/contents?pageSize=101',expected=422)
    body=draft(title='版本流程验收 '+STAMP)
    work=post(member,'/submissions',body)
    timeline=member.call('GET','/submissions/'+work['id']+'/progress')[1]['timeline']
    check('real author sees six immutable review stages before processing',len(timeline['stages'])==6 and timeline['flowVersion'] is not None and not timeline['started'])
    operator.call('GET','/submissions/'+work['id']+'/progress',expected=403)
    data={'title':'完整课程验收 '+STAMP,'category':'廉政教育','description':'这是一门用于验证课程多章节、服务端测验和版本快照的真实测试课程。','teacher':'验收讲师','duration':20,'passPercent':100,'region':'zhejiang',
        'lessons':[{'id':'one','title':'第一章','body':'第一章家风正文。','practice':'请阅读'},{'id':'two','title':'第二章','body':'第二章清廉正文。','practice':'请阅读'}],
        'questions':[{'id':'q1','prompt':'本课程共有几章？','options':[{'id':'a','text':'两章'},{'id':'b','text':'一章'}],'answerId':'a','explanation':'课程编排为两章。'}],'examQuestionIds':['q1']}
    created=education(operator,'saveCourse',data=data,admin=True);cid=created['id']
    published=education(operator,'publishCourse',cid,version=created['lockVersion'],admin=True)
    detail=member.call('GET','/education/courses/'+cid)[1]
    check('published multi-chapter course withholds server answer keys', 'answerId' not in json.dumps(detail) and 'explanation' not in json.dumps(detail.get('questions',[])))
    education(member,'course.progress',cid,{'publicationVersion':1,'lessonId':'one'})
    education(member,'course.progress',cid,{'publicationVersion':1,'lessonId':'two'})
    passed=education(member,'course.progress',cid,{'publicationVersion':1,'answers':{'q1':'a'}})
    check('server marks course complete only after lessons and passing quiz', passed['result']['passed'] and passed['progress']['complete'])
    changed={**data,'title':'新草稿未发布 '+STAMP}
    saved=education(operator,'saveCourse',cid,changed,published['lockVersion'],True)
    assert member.call('GET','/education/courses/'+cid)[1]['course']['title']==data['title']
    education(operator,'publishCourse',cid,version=saved['lockVersion'],admin=True)
    newdetail=member.call('GET','/education/courses/'+cid)[1]
    check('draft is private and publication creates separate learning version',newdetail['course']['publicationVersion']==2)
    cert=post(admin,'/admin/certificates',{'kind':'completion','sourceId':cid,'ownerId':member.user['id'],'courseVersion':1,'issuer':'隔离验收签发机构'})
    certificates=member.call('GET','/me/certificates')[1]['items'];issued=next(c for c in certificates if c['id']==cert['id'])
    content=download(member,'/certificates/'+cert['id']+'/download','certificate.pdf')
    other.call('GET','/certificates/'+cert['id']+'/download',expected=404)
    check('manual certificate creates private real PDF and denies other owner',content.startswith(b'%PDF-'))
    token=issued['verifyToken'];verify=member.call('GET','/certificates/verify/'+token)[1]
    check('certificate verification discloses no holder identity','name' not in verify and 'ownerId' not in verify)
    post(admin,'/admin/certificates/'+cert['id']+'/revoke',{'version':issued['version'],'reason':'隔离验收完成后撤销测试证书'})
    member.call('GET','/certificates/'+cert['id']+'/download',expected=410)
    check('revoked certificate cannot generate a new download URL')
    job=post(admin,'/admin/exports',{'kind':'report','region':'zhejiang'})
    result=wait_job(admin,job['id']);report=download(admin,'/admin/exports/'+job['id']+'/download','report.pdf')
    member.call('GET','/files/'+result['result']['fileId']+'/download',expected=404)
    check('durable report executor produces PDF and generic file URL cannot bypass authorization',report.startswith(b'%PDF-'))
    prefs=admin.call('PUT','/me/delivery-preferences',{'digest':'weekly','draftNotice':True,'reports':['month','quarter','year']})[1]
    check('scheduling preferences round-trip with explicit report periods',prefs['digest']=='weekly' and len(prefs['reports'])==3)
    row=admin.call('GET','/admin/accounts/'+account['id'])[1]
    post(admin,'/admin/accounts/'+account['id']+'/roles',{'version':row['version'],'roles':['review_manager'],'regionIds':['zhejiang']})
    operator.call('GET','/admin/records/contents',expected=401)
    check('role change invalidates old session rather than preserving old grants')
    (OUT/'acceptance.json').write_text(json.dumps({'passed':RESULTS,'courseId':cid,'submissionId':work['id'],'reportJobId':job['id'],'testAccount':uname},ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
