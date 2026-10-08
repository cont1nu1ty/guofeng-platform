#!/usr/bin/env python3
"""Review/import/region/consultation acceptance, restricted to the isolated non-AI deployment."""
import json
import uuid
from business_probe import Client, ENV, ROOT, STAMP, draft, check, RESULTS

assert ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-non-ai-'), 'Use an isolated non-AI test project'
OUT=ROOT/'deploy/.local/non-ai-20261007'

def post(client,path,data,key=None,expected=200):
    return client.call('POST',path,data,{'Idempotency-Key':key or str(uuid.uuid4())},expected)[1]

def current(client,sid):
    return client.call('GET',f'/submissions/{sid}/progress')[1]

def main():
    admin=Client('devadmin','admin'); zj=Client('region_zj','admin'); bj=Client('region_bj','admin')
    member=Client('member_zj'); other=Client('member_bj'); expert=Client('expert_zj','admin')
    original=admin.call('GET','/admin/bootstrap')[1]['reviewFlow']
    original={k:original[k] for k in ('blind','deadlineDays','enabled','rubrics') if k in original}
    rubric={'title':'隔离验收双维量表','dimensions':[{'id':'meaning','label':'内容','max':70,'description':'依据正文的完整性与主题。'},{'id':'expression','label':'表达','max':30,'description':'依据表达准确性。'}]}
    config=admin.call('GET','/admin/bootstrap')[1]['reviewFlow']
    admin.command('configureReviewFlow',data={'blind':True,'deadlineDays':7,'enabled':[True,True,False,False,False,False],'rubrics':[rubric for _ in range(6)]},version=config['lockVersion'],admin=True)
    try:
        work=post(member,'/submissions',draft(title='不可变量表验收 '+STAMP)); sid=work['id']
        row={**draft(title='线下归集验收 '+STAMP),'ownerId':member.user['id'],'sourceName':'隔离验收文字稿','sourceRef':str(uuid.uuid4()),'copyrightAccepted':True}
        plan=post(zj,'/admin/submission-imports/preview',{'rows':[row]})
        assert len(plan['rows'])==1 and not plan['errors']
        assert plan['rows'][0]['data']['copyrightAccepted'] is False
        bad=post(zj,'/admin/submission-imports/preview',{'rows':[{**row,'ownerId':other.user['id']}]})
        assert len(bad['errors'])==1
        check('offline import precheck cannot forge owner consent or cross recipient province')
        key=str(uuid.uuid4()); confirmed=post(zj,'/admin/submission-imports/confirm',{'rows':[row],'fingerprint':plan['fingerprint']},key)
        assert post(zj,'/admin/submission-imports/confirm',{'rows':[row],'fingerprint':plan['fingerprint']},key)==confirmed
        imported=confirmed['imported'][0]; iid=imported['id']
        check('offline import confirm is idempotent and records an immutable revision')
    finally:
        fresh=admin.call('GET','/admin/bootstrap')[1]['reviewFlow']
        admin.command('configureReviewFlow',data=original,version=fresh['lockVersion'],admin=True)
    progress=current(member,sid)
    assert len(progress['timeline']['stages'])==6
    assert len(progress['timeline']['stages'][1]['rubric']['dimensions'])==2
    assert progress['timeline']['stages'][2]['state']=='disabled'
    assert progress['timeline']['flowVersion']!=admin.call('GET','/admin/bootstrap')[1]['reviewFlow']['flowVersion']
    check('submission captures six-node flow and custom rubrics before later global configuration changes')
    original_revision=current(member,iid)['revisions'][0]
    zj.act('approveSubmission','submissions',iid,expected=409)
    agreement=member.call('GET','/rights/agreement')[1]
    data={'revisionId':imported['revisionId'],'agreementVersion':agreement['version'],'accepted':True,'version':current(member,iid)['work']['version']}
    post(other,f'/submissions/{iid}/copyright-confirmations',data,expected=404)
    post(member,f'/submissions/{iid}/copyright-confirmations',data)
    assert current(member,iid)['revisions'][0]==original_revision
    check('offline initial approval is gated by explicit owner confirmation without rewriting original revision')
    duplicate=post(zj,'/admin/submission-imports/preview',{'rows':[row]})
    assert duplicate['errors'][0]['code']=='DUPLICATE_IMPORT_SOURCE'
    for work_id in (sid,iid):
        zj.act('approveSubmission','submissions',work_id)
        zj.act('prepareBlindMaterial','submissions',work_id,{'content':'这份稿件记述了家风传承与日常生活，仅提供脱敏正文，不包含作者姓名、附件及个人信息。','confirmed':True})
    input={'ids':[sid,iid],'group':'','versions':{i:current(member,i)['work']['version'] for i in (sid,iid)}}
    allocation=post(zj,'/admin/review-assignments/preview',input)
    repeat=post(zj,'/admin/review-assignments/preview',input)
    assert allocation==repeat and len(allocation['rows'])==2
    post(zj,'/admin/review-assignments/confirm',{**input,'fingerprint':'outdated'},expected=409)
    key=str(uuid.uuid4()); assigned=post(zj,'/admin/review-assignments/confirm',{**input,'fingerprint':allocation['fingerprint']},key)
    assert post(zj,'/admin/review-assignments/confirm',{**input,'fingerprint':allocation['fingerprint']},key)==assigned
    check('rule-based batch allocation is deterministic, preview-gated and idempotent')
    task=next(t for t in expert.workspace()['reviewTasks'] if t['submissionId']==sid and t['status']=='pending')
    assert len(task['dimensions'])==2 and task['ruleVersion']!='jiafeng-four-v1'
    expert.command('review.submit',task['id'],{'scores':[30,30,25,15],'comment':'旧四维不适配当前任务版本。'},task['version'],expected=422)
    expert.command('review.submit',task['id'],{'scores':[69,29],'ruleVersion':task['ruleVersion'],'comment':'作品完整表达家风主题，进入人工决定环节。'},task['version'])
    progress=current(member,sid)
    assert [s['state'] for s in progress['timeline']['stages'][:2]]==['completed','completed']
    assert not progress['work']['published']
    assert 'approver' not in json.dumps(progress['timeline']) and all(r['reviewer']=='匿名评审专家' for r in progress['work']['reviews'])
    check('task-bound custom scoring advances real WarmFlow timeline and preserves expert anonymity/manual decision')

    city=post(admin,'/admin/regions',{'parentId':'zhejiang','name':'验收城市 '+STAMP,'nameEn':'Acceptance city','officialCode':'','source':'隔离测试手工目录，不是全国行政区划数据','enabled':True})
    county=post(admin,'/admin/regions',{'parentId':city['id'],'name':'验收区县','nameEn':'Acceptance district','officialCode':'','source':'隔离测试目录','enabled':True})
    post(admin,'/admin/regions',{'parentId':county['id'],'name':'不允许第四级','source':'测试','enabled':True},expected=422)
    bj.call('GET','/admin/regions?parentId='+city['id'],expected=404)
    check('province/city/county hierarchy enforces scope and maximum depth')
    venue=zj.command('saveVenue',data={'title':'地区筛选阵地 '+STAMP,'language':'zh','region':'zhejiang','category':'practice','city':'测试城市','address':'隔离测试地址','description':'用于验证地区归属及已发布过滤','latitude':30.2,'longitude':120.1,'sample':False},admin=True)['result']
    binding=post(zj,'/admin/regions/venues/'+venue['id'],{'areaId':county['id'],'coordinateSystem':'wgs84','version':venue['lockVersion']})
    assert venue['id'] not in member.call('GET','/regions/venues?areaId='+city['id'])[1]['ids']
    zj.command('setVenueStatus',venue['id'],{'status':'已发布'},binding['version'],True)
    assert venue['id'] in member.call('GET','/regions/venues?areaId='+city['id'])[1]['ids']
    assert member.call('GET','/regions/venue-map/'+venue['id'])[1]['coordinateSystem']=='wgs84'
    assert venue['id'] in [v['id'] for v in member.call('GET','/regions/venue-coordinates')[1]['items']]
    city=post(admin,'/admin/regions',{**city,'enabled':False})
    member.call('GET','/regions/children?parentId='+city['id'],expected=404)
    member.call('GET','/regions/venues?areaId='+county['id'],expected=404)
    check('venue area filter excludes drafts and disabled ancestors; map coordinates require explicit provenance')
    product=zj.command('saveProduct',data={'title':'定制咨询验收 '+STAMP,'description':'人工报价流程测试','stock':7,'quota':20,'region':'zhejiang'},admin=True)['result']
    claim=member.command('welfare.claim',product['id'],{'kind':'custom','organization':'隔离验收单位','quantity':3,'purpose':'用于验证定制咨询与公益库存的隔离。'})['result']
    cid=claim['id']; other.call('GET','/me/consultations/'+cid,expected=404)
    zj.command('processClaim',cid,{'action':'approve'},claim['version'],True,expected=409)
    initial=zj.call('GET','/admin/consultations/'+cid)[1]
    quote={'version':initial['version'],'stage':'quoted','note':'已核对需求，现记录人工参考报价。','quoteAmount':'1250.50','quoteDescription':'包括文字排版与打样，七日有效；后续合同须另行确认。'}
    post(zj,'/admin/consultations/'+cid,{**quote,'quoteAmount':'1.001'},expected=422)
    key=str(uuid.uuid4()); saved=post(zj,'/admin/consultations/'+cid,quote,key)
    assert post(zj,'/admin/consultations/'+cid,quote,key)==saved
    mine=member.call('GET','/me/consultations/'+cid)[1]
    assert len(mine['events'])==1 and float(mine['events'][0]['quoteAmount'])==1250.50
    assert 'actor' not in json.dumps(mine) and zj.entity('products',product['id'])['stock']==7
    member.command('welfare.cancel',cid)
    cancelled=zj.call('GET','/admin/consultations/'+cid)[1]
    post(zj,'/admin/consultations/'+cid,{'version':cancelled['version'],'stage':'discussion','note':'已取消不能继续处理。'},expected=409)
    check('custom quotes are owner-private, append-only, idempotent and never consume welfare inventory')
    (OUT/'review-regions-acceptance.json').write_text(json.dumps({'passed':RESULTS,'submissionId':sid,'importedId':iid,'venueId':venue['id'],'consultationId':cid},ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
