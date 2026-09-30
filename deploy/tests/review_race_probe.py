#!/usr/bin/env python3
"""Race one real expert score against one operator deadline extension.

Only the isolated jiafeng-demo-review-cache project on port 18082 is accepted.
Creates one labelled manuscript/task and changes no shared configuration.
"""
import concurrent.futures
import datetime as dt
import importlib.machinery
import importlib.util
import json
import os
import threading
import uuid

from business_probe import Client, ENV, ROOT, draft

assert ENV.get('COMPOSE_PROJECT_NAME') == 'jiafeng-demo-review-cache', 'isolated project required'
assert ENV.get('JIAFENG_HTTP_PORT') == '18082', 'isolated port required'
assert os.environ.get('JIAFENG_TEST_URL') == 'http://127.0.0.1:18082', 'explicit isolated URL required'

loader = importlib.machinery.SourceFileLoader('review_race_deploy', str(ROOT / 'deploy/dev'))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)


def sql(query):
    result = deploy.compose('exec', '-T', 'mysql', 'sh', '-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --default-character-set=utf8mb4 -N -B jiafeng',
        input=query, text=True, capture_output=True)
    return result.stdout.strip()


def lit(value):
    return "CONVERT(X'" + str(value).encode().hex() + "' USING utf8mb4)"


def timestamp(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def epoch_ms(value):
    elapsed = timestamp(value) - dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)
    return elapsed.days * 86400000 + elapsed.seconds * 1000 + elapsed.microseconds // 1000


def main():
    checks = []

    def check(name, condition):
        assert condition, name
        checks.append(name)
        print('PASS', name, flush=True)

    operator = Client('region_zj', 'admin')
    expert = Client('expert_zj', 'admin')
    author = Client('member_zj')
    title = '评分与延期并发验收 ' + uuid.uuid4().hex[:10]
    sid = author.call('POST', '/submissions', draft(title=title),
        {'Idempotency-Key': str(uuid.uuid4())})[1]['id']
    operator.act('approveSubmission', 'submissions', sid)
    work = operator.entity('submissions', sid)
    check('existing flow has an expert stage without changing global settings', work['progressIndex'] < 6)
    operator.act('prepareBlindMaterial', 'submissions', sid, {
        'content': '这是一份用于并发评分与延期验证的匿名家风材料，没有作者姓名、联系方式或原始附件。',
        'confirmed': True,
    })
    due = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=2)).isoformat()
    operator.act('assignReview', 'submissions', sid, {'expertId': '10004', 'dueAt': due})
    task = next(item for item in expert.workspace()['reviewTasks']
        if item['submissionId'] == sid and item['status'] == 'pending')
    check('new task starts in an active scoring window', task['canScore'] and task['windowStatus'] == 'active')
    tid, version = task['id'], task['version']
    next_due = (timestamp(task['dueAt']) + dt.timedelta(days=1)).isoformat()
    scores = [27, 28, 22, 13]
    barrier = threading.Barrier(2)

    def request(kind):
        if kind == 'score':
            client, endpoint, command = expert, '/commands', 'review.submit'
            data = {'scores': scores, 'comment': '匿名材料完整，现按真实时间窗口提交并发验收评分。'}
        else:
            client, endpoint, command = operator, '/admin/commands', 'updateReviewWindow'
            data = {'dueAt': next_due, 'reason': '并发验收：运营申请延长一天，必须与专家评分互斥提交。'}
        barrier.wait(timeout=10)
        status, body, _ = client.call('POST', endpoint, {
            'command': command, 'entityId': tid, 'version': version, 'data': data,
        }, {'Idempotency-Key': str(uuid.uuid4())}, expected=None)
        return {'operation': kind, 'httpStatus': status, 'errorCode': body.get('code')}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(request, ['score', 'extension']))
    winners = [item for item in responses if item['httpStatus'] == 200]
    losers = [item for item in responses if item['httpStatus'] != 200]
    check('exactly one concurrent operation succeeds', len(winners) == 1 and len(losers) == 1)
    check('loser is rejected by version or completed-task guard',
        losers[0]['httpStatus'] in (409, 412) and losers[0]['errorCode'] in
        ('VERSION_CONFLICT', 'TASK_COMPLETED', 'TASK_INVALID'))

    final = json.loads(sql("SELECT JSON_OBJECT('status',e.status,'version',e.version,"
        "'startsAt',JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.startsAt')),"
        "'dueAt',JSON_UNQUOTE(JSON_EXTRACT(e.payload,'$.dueAt')),"
        "'windowVersion',JSON_EXTRACT(e.payload,'$.windowVersion'),"
        "'scores',JSON_EXTRACT(e.payload,'$.scores'),'completedAt',JSON_EXTRACT(e.payload,'$.completedAt'),"
        "'indexedStatus',w.status,'indexedWindowVersion',w.window_version,'indexedDueMs',w.due_at_ms) "
        "FROM jf_entity e JOIN jf_review_window w ON w.task_id=e.id WHERE e.id=" + lit(tid) + ';'))
    manuscript = json.loads(sql("SELECT JSON_OBJECT('reviewCount',COALESCE(JSON_LENGTH(JSON_EXTRACT(payload,'$.reviews')),0),"
        "'progressIndex',JSON_EXTRACT(payload,'$.progressIndex')) FROM jf_entity WHERE id=" + lit(sid) + ';'))
    edits = int(sql("SELECT COUNT(*) FROM jf_audit WHERE action='review.window.updated' AND target_id=" + lit(tid) + ';'))
    check('single committed task update matches its durable index', final['version'] == version + 1 and
        final['status'] == final['indexedStatus'] and final['windowVersion'] == final['indexedWindowVersion'] and
        epoch_ms(final['dueAt']) == final['indexedDueMs'])
    check('scoring/extension never moves the original start', timestamp(final['startsAt']) == timestamp(task['startsAt']))

    winner = winners[0]['operation']
    if winner == 'score':
        check('score winner commits scores and advances flow without extending deadline',
            final['status'] == '已完成' and final['scores'] == scores and final['completedAt'] is not None and
            final['windowVersion'] == task['windowVersion'] and timestamp(final['dueAt']) == timestamp(task['dueAt']) and
            manuscript['reviewCount'] == 1 and manuscript['progressIndex'] > work['progressIndex'] and edits == 0)
    else:
        check('extension winner commits new deadline without partial score or flow advancement',
            final['status'] == '待评分' and final['scores'] is None and final['completedAt'] is None and
            final['windowVersion'] == task['windowVersion'] + 1 and timestamp(final['dueAt']) == timestamp(next_due) and
            manuscript['reviewCount'] == 0 and manuscript['progressIndex'] == work['progressIndex'] and edits == 1)
    evidence = {
        'testedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'project': ENV['COMPOSE_PROJECT_NAME'], 'baseUrl': os.environ['JIAFENG_TEST_URL'],
        'submissionId': sid, 'taskId': tid, 'submittedVersion': version,
        'responses': responses, 'winner': winner, 'finalTask': final, 'finalManuscript': manuscript,
        'checks': checks, 'passed': len(checks), 'globalConfigurationChanged': False,
    }
    path = ROOT / 'deploy/.local/review-cache/review-race-probe.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': len(checks), 'winner': winner, 'evidence': str(path)}), flush=True)


if __name__ == '__main__':
    main()
