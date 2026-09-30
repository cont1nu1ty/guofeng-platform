#!/usr/bin/env python3
"""Review-window HTTP/SQL integration checks, restricted to the isolated test project.

JIAFENG_ENV_FILE and JIAFENG_TEST_URL must identify jiafeng-demo-review-cache.
Fixture deadline changes use both authoritative task JSON and its indexed copy.
"""
import concurrent.futures
import datetime as dt
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import time
import uuid
from business_probe import Client, ENV, ROOT, draft

assert ENV.get('COMPOSE_PROJECT_NAME') == 'jiafeng-demo-review-cache', 'isolated project required'
assert os.environ.get('JIAFENG_TEST_URL') == 'http://127.0.0.1:' + ENV['JIAFENG_HTTP_PORT']
loader = importlib.machinery.SourceFileLoader('window_probe_deploy', str(ROOT / 'deploy/dev'))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)
checks = []


def sql(query):
    return deploy.compose('exec', '-T', 'mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --default-character-set=utf8mb4 -N -B jiafeng',
        input=query, text=True, capture_output=True).stdout.strip()


def lit(value):
    return "CONVERT(X'" + str(value).encode().hex() + "' USING utf8mb4)"


def check(name, condition=True):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)


def iso(delta):
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=delta)).isoformat()


def wait_for(fn, timeout=100):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = fn()
        if value:
            return value
        time.sleep(2)
    raise AssertionError('timed out waiting for scheduled reminder')


def force_due(task_id, seconds=-1):
    now = dt.datetime.now(dt.timezone.utc)
    start = now - dt.timedelta(days=1)
    due = now + dt.timedelta(seconds=seconds)
    sql("START TRANSACTION; UPDATE jf_entity SET payload=JSON_SET(payload,'$.startsAt'," + lit(start.isoformat()) +
        ",'$.dueAt'," + lit(due.isoformat()) + ") WHERE id=" + lit(task_id) + "; UPDATE jf_review_window SET starts_at_ms=" +
        str(int(start.timestamp()*1000)) + ',due_at_ms=' + str(int(due.timestamp()*1000)) +
        ' WHERE task_id=' + lit(task_id) + '; COMMIT;')


def main():
    admin = Client('devadmin', 'admin')
    operator = Client('region_zj', 'admin')
    other = Client('region_bj', 'admin')
    expert = Client('expert_zj', 'admin')
    author = Client('member_zj')
    original_flow = admin.workspace(True)['reviewFlow']
    def config(enabled):
        current = admin.workspace(True)['platformConfig']
        data = {k: current[k] for k in ('name','subtitle','contact','language','regionLabel','reviewReminder','draftNotice','notice')}
        data['reviewReminder'] = enabled
        admin.command('savePlatformConfig', data=data, version=current['lockVersion'], admin=True)
    def task(task_id):
        visible = next((t for t in expert.workspace()['reviewTasks'] if t['id'] == task_id), None)
        if visible is not None:
            return visible
        # The member API omits cancelled tasks; operators retain their audit history.
        record = next(t for t in operator.workspace(True)['tasks'] if t['id'] == task_id)
        return {**record, 'version': record['lockVersion']}
    def change(task_id, due, start=None, reason='测试调整评审时间窗口', expected=200, version=None, client=operator):
        current = task(task_id)
        data = {'dueAt': due, 'reason': reason}
        if start is not None:
            data['startsAt'] = start
        return client.command('updateReviewWindow', task_id, data, version if version is not None else current['version'], True, expected=expected)
    def score(task_id, expected):
        current = task(task_id)
        return expert.command('review.submit',task_id,{'scores':[27,28,22,13],'comment':'匿名材料完整，按当前评审窗口提交意见。'},current['version'],expected=expected)
    def assigned(starts=None, due=None):
        data=draft(title='时间窗口验证 '+str(uuid.uuid4())[:8])
        sid=author.call('POST','/submissions',data,{'Idempotency-Key':str(uuid.uuid4())})[1]['id']
        operator.act('approveSubmission','submissions',sid)
        operator.act('prepareBlindMaterial','submissions',sid,{'content':'匿名家风材料，用于检查任务窗口边界和预警通知，不包含作者姓名及任何联系方式。','confirmed':True})
        options={'expertId':'10004'}
        if starts: options['startsAt']=starts
        if due: options['dueAt']=due
        operator.act('assignReview','submissions',sid,options)
        return next(t['id'] for t in expert.workspace()['reviewTasks'] if t['submissionId']==sid and t['status']=='pending'),sid
    def deliveries(task_id, phase):
        return int(sql('SELECT COUNT(*) FROM jf_review_delivery WHERE task_id='+lit(task_id)+' AND phase='+lit(phase)+';'))
    admin.command('configureReviewFlow',data={'blind':True,'deadlineDays':7,'enabled':[False,False,False,False,False,True]},version=original_flow['lockVersion'],admin=True)
    try:
        tid,sid=assigned(iso(3600),iso(7200))
        future=task(tid)
        check('scheduled start is authoritative and anonymous',future['windowStatus']=='not_started' and not future['canScore'] and 'attachments' not in future)
        score(tid,409)
        change(tid,iso(9000),reason='',expected=422)
        change(tid,iso(9000),client=other,expected=404)
        oldver=future['version']
        change(tid,iso(10800),iso(5400))
        check('before-start edit increments window version',task(tid)['windowVersion']==2)
        change(tid,iso(12000),version=oldver,expected=412)
        check('missing reason, cross-region and stale updates are rejected')
        notice=next(n for n in expert.workspace()['notifications'] if n.get('targetId')==tid)
        check('window notification deep link is task based',notice['sourceType']=='review-task' and not notice['workId'])
        other.command('markReviewAlertRead',notice['id'],admin=True,expected=404)
        expert.command('markReviewAlertRead',notice['id'],admin=True)
        check('notifications can only be marked read by their owner')
        force_due(tid)
        check('expired task cannot score',task(tid)['windowStatus']=='overdue' and not task(tid)['canScore'])
        score(tid,409)
        alerts=operator.call('GET','/admin/review-alerts?phase=overdue&page=1&pageSize=1')[1]
        check('alerts are paginated and region scoped',alerts['pageSize']==1 and alerts['total']>=1 and all(x['regionId']=='zhejiang' for x in alerts['items']))
        check('other region does not see task',tid not in [x['id'] for x in other.call('GET','/admin/review-alerts?phase=overdue')[1]['items']])
        flow_before=sql('SELECT JSON_EXTRACT(payload,\'$.flowTaskId\') FROM jf_entity WHERE id='+lit(tid)+';')
        change(tid,iso(3600))
        current=task(tid)
        check('overdue extension restores score on same workflow task',current['canScore'] and flow_before==sql('SELECT JSON_EXTRACT(payload,\'$.flowTaskId\') FROM jf_entity WHERE id='+lit(tid)+';'))
        change(tid,iso(1800),expected=422)
        change(tid,iso(7200),iso(60),expected=409)
        check('started tasks cannot shorten or move start')
        version=current['version']
        def concurrent_extension(seconds):
            return operator.call('POST','/admin/commands',{'command':'updateReviewWindow','entityId':tid,'version':version,'data':{'dueAt':iso(seconds),'reason':'并发延期验证，保留一项有效变更'}},{'Idempotency-Key':str(uuid.uuid4())},expected=None)[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(concurrent_extension,[7200,10800]))
        check('concurrent extensions yield one success and one version conflict',sorted(codes)==[200,412])
        score(tid,200)
        change(tid,iso(15000),expected=409)
        check('completed tasks are immutable and leave warning list',task(tid)['windowStatus']=='completed')
        deploy.compose('up','-d','--no-build','--wait','--scale','server=2','server',capture_output=True,text=True)
        check('two backend instances are running against the same ledger',
              len(deploy.compose('ps','-q','server',capture_output=True,text=True).stdout.splitlines())==2)
        soon,sid2=assigned(due=iso(3600))
        wait_for(lambda: deliveries(soon,'due_soon')==1)
        check('near-deadline reminder goes only to expert',sql('SELECT recipient_id FROM jf_review_delivery WHERE task_id='+lit(soon)+" AND phase='due_soon';")=='10004')
        force_due(soon)
        wait_for(lambda: deliveries(soon,'overdue')==2)
        check('first overdue reminder reaches expert and assigned operator once')
        deploy.compose('up','-d','--no-build','--wait','--scale','server=1','server',capture_output=True,text=True)
        counts=deliveries(soon,'overdue')
        deploy.compose('restart','server',capture_output=True,text=True)
        wait_for(lambda: public_health(),100)
        time.sleep(17)
        check('restart does not duplicate reminders',deliveries(soon,'overdue')==counts)
        config(False)
        quiet,sid3=assigned(due=iso(3600))
        force_due(quiet)
        config(True)
        time.sleep(3)
        check('re-enable cutoff excludes historical overdue',int(sql('SELECT due_at_ms < cutoff_ms FROM jf_review_window,jf_review_reminder_state WHERE task_id='+lit(quiet)+';'))==1)
        wait_for(lambda: int(sql('SELECT initialized FROM jf_review_reminder_state WHERE id=1;'))==1)
        check('disabled/reenabled history has no overdue delivery',deliveries(quiet,'overdue')==0)
        change(quiet,iso(3600))
        wait_for(lambda: deliveries(quiet,'due_soon')==1)
        check('extended window obtains a fresh reminder cycle')
        operator.act('returnSubmission','submissions',sid3,{'reason':'取消任务验证，请补充材料后再提交。'})
        change(quiet,iso(7200),expected=409)
        check('cancelled tasks are immutable',task(quiet)['windowStatus']=='cancelled')
        check('ordinary member cannot access admin alert API',author.call('GET','/admin/review-alerts',expected=403)[0]==403)
        check('invalid pagination rejected',operator.call('GET','/admin/review-alerts?page=0',expected=422)[0]==422)
    finally:
        deploy.compose('up','-d','--no-build','--wait','--scale','server=1','server',capture_output=True,text=True)
        flow=admin.workspace(True)['reviewFlow']
        admin.command('configureReviewFlow',data={k:original_flow[k] for k in ('blind','deadlineDays','enabled')},version=flow['lockVersion'],admin=True)
    result={'checks':checks,'passed':len(checks),'testedAt':iso(0),'project':ENV['COMPOSE_PROJECT_NAME']}
    (ROOT/'deploy/.local/review-cache/review-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':len(checks)}))


def public_health():
    import urllib.request
    try:
        with urllib.request.urlopen(os.environ['JIAFENG_TEST_URL']+'/api/v1/health',timeout=3) as response:
            return json.load(response).get('status')=='ok'
    except Exception:
        return False


if __name__ == '__main__':
    main()
