#!/usr/bin/env python3
"""Final bounded reads, audit privacy and explicitly defined engagement checks."""
import datetime as dt
import json
from business_probe import Client, ENV, ROOT, STAMP, check, RESULTS
from jobs_schedule_probe import command
assert ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-non-ai-')
def main():
    admin=Client('devadmin','admin');member=Client('member_zj');beijing=Client('region_bj','admin')
    anon=object.__new__(Client);anon.token=''
    content=command(admin,'saveContent',data={'title':'传播口径验收 '+STAMP,'category':'行业动态','language':'中文','region':'浙江省','author':'测试作者','summary':'隔离环境传播指标测试','body':'用于验证真实访问与分享意向按账号内容日期去重的公开正文。'})['result']['id']
    event={'kind':'content','targetId':content,'action':'view'}
    anon.call('POST','/engagement/events',event,expected=401)
    member.call('POST','/engagement/events',event,expected=404)
    command(admin,'setContentStatus',content,{'status':'已发布'},'contents')
    before=admin.call('GET','/admin/statistics?region=zhejiang')[1]['engagement']
    first=member.call('POST','/engagement/events',event)[1]
    second=member.call('POST','/engagement/events',event)[1]
    share=member.call('POST','/engagement/events',{**event,'action':'share_intent'})[1]
    after=admin.call('GET','/admin/statistics?region=zhejiang')[1]['engagement']
    check('engagement requires signed-in account and published content')
    assert all(isinstance(v,int) for v in after.values()),'Statistic counters must be JSON integers'
    check('view deduplicates by account/content/day while share intent is separate',first['recorded'] and not second['recorded'] and share['recorded'] and int(after['signedInViews'])==int(before['signedInViews'])+1 and int(after['shareIntents'])==int(before['shareIntents'])+1)
    command(admin,'setContentStatus',content,{'status':'已下架'},'contents');member.call('POST','/engagement/events',event,expected=404)
    check('withdrawn content stops recording new events')
    now=dt.datetime.now(dt.timezone.utc)
    aid=command(admin,'saveActivity',data={'title':'报名分页验收 '+STAMP,'type':'家风活动','region':'浙江省','location':'隔离测试','startAt':(now+dt.timedelta(days=1)).isoformat(),'endAt':(now+dt.timedelta(days=2)).isoformat(),'capacity':10,'summary':'验证真实名单分页、签到及地区边界。'})['result']['id']
    command(admin,'setActivityStatus',aid,{'status':'报名中'},'activities')
    member.command('activity.register',aid)
    detail=admin.call('GET','/admin/records/activities/'+aid)[1]
    assert isinstance(detail['checkedInCount'],int),'Activity count must be a JSON integer'
    page=admin.call('GET','/admin/activities/'+aid+'/registrations?pageSize=1')[1]
    check('activity list omits full names while separate endpoint returns bounded registrations',detail['registrations']==[] and detail['registrationCount']==1 and len(page['items'])==1 and page['total']==1)
    beijing.call('GET','/admin/activities/'+aid+'/registrations',expected=404)
    member.call('GET','/admin/activities/'+aid+'/registrations',expected=403)
    command(admin,'toggleAttendance',aid,{'registrationId':page['items'][0]['id'],'checkedIn':True},'activities')
    checked=admin.call('GET','/admin/activities/'+aid+'/registrations?status=checked')[1]
    pending=admin.call('GET','/admin/activities/'+aid+'/registrations?status=pending')[1]
    check('attendance write refreshes server filtered counts and denies other region/member',checked['total']==1 and pending['total']==0)
    audit=admin.call('GET','/admin/records/activityLog?pageSize=1')[1]
    private=admin.call('GET','/admin/records/activityLog?q=recitation.')[1]
    check('audit paginates database records without private recitation events',len(audit['items'])==1 and audit['total']>1 and private['total']==0)
    command_result=admin.call('POST','/admin/exports',{'kind':'csv','collection':'activityLog'},headers={'Idempotency-Key':'audit-deny-'+STAMP},expected=422)[1]
    check('audit cannot be exported through an incompatible generic CSV schema',command_result['code']=='UNSUPPORTED_EXPORT')
    (ROOT/'deploy/.local/non-ai-20261007/pagination-engagement.json').write_text(json.dumps({'passed':RESULTS,'activityId':aid},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
