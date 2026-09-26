#!/usr/bin/env python3
"""Validate real WarmFlow enabled-node traversal; restores the prior published configuration."""
import datetime as dt
import json
import uuid
from business_probe import Client, ROOT, draft, STAMP

admin=Client('devadmin','admin');operator=Client('region_zj','admin');expert=Client('expert_zj','admin');author=Client('member_zj')
original=admin.workspace(True)['reviewFlow'];saved={k:original[k]for k in ('blind','deadlineDays','enabled')}
report={}
def configure(enabled):
    flow=admin.workspace(True)['reviewFlow']
    admin.command('configureReviewFlow',data={'blind':True,'deadlineDays':7,'enabled':enabled},version=flow['lockVersion'],admin=True)
def traverse(enabled,label):
    configure(enabled)
    data=draft(title=label+' '+STAMP)
    work=author.call('POST','/submissions',data,{'Idempotency-Key':str(uuid.uuid4())})[1];sid=work['id']
    operator.act('approveSubmission','submissions',sid)
    expected=[i for i,on in enumerate(enabled)if on and i!=0]
    actual=[]
    operator.act('prepareBlindMaterial','submissions',sid,{'content':'已由运营人工确认的匿名家风材料，用于验证启用节点的真实办理过程。','confirmed':True})
    operator.act('decideSubmission','submissions',sid,{'result':'shortlisted','note':'尚有节点时不能提前决定。'},expected=409)
    for stage in expected:
        record=operator.entity('submissions',sid);actual.append(record['progressIndex']);assert record['progressIndex']==stage
        operator.act('assignReview','submissions',sid,{'expertId':'10004'})
        task=next(t for t in expert.workspace()['reviewTasks']if t['submissionId']==sid and t['status']=='pending')
        expert.command('review.submit',task['id'],{'scores':[27,28,22,13],'comment':'本节点专家已实际办理，结果仍等待管理员确认。'},task['version'])
    final=operator.entity('submissions',sid);assert final['progressIndex']==6 and not final['published']
    operator.act('decideSubmission','submissions',sid,{'result':'shortlisted','note':'所有开启节点办理完成后人工确认。'})
    return {'submissionId':sid,'enabled':enabled,'visitedStages':actual,'endStage':6,'noAutomaticPublication':True,'incompleteDecisionRejected':True}
try:
    report['lastNodeOnly']=traverse([False,False,False,False,False,True],'跳过节点流程验收')
    report['allSixNodes']=traverse([True]*6,'完整六级流程验收')
finally:
    flow=admin.workspace(True)['reviewFlow']
    admin.command('configureReviewFlow',data=saved,version=flow['lockVersion'],admin=True)
report['configurationRestored']=True
report['testedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
path=ROOT/'deploy/.local/workflow-probe.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
