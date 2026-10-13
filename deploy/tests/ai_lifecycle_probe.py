#!/usr/bin/env python3
"""Explicit local AI outage/restart check; does not reset data or repeat paid requests."""
import json
import runpy
import time
import uuid
from pathlib import Path
from business_probe import Client, ROOT


def main():
    deploy = runpy.run_path(str(ROOT / 'deploy/dev'))
    compose = deploy['compose']
    checks = []
    a = Client('member_zj')
    task = next(t for t in a.call('GET', '/ai/tasks')[1]['items'] if t['status'] == 'succeeded' and t['mode'] == 'family')
    before = a.call('GET', '/ai/tasks/' + task['id'])[1]
    try:
        compose('stop', 'ai')
        assert not a.call('GET', '/ai/status')[1]['enabled']
        assert isinstance(a.workspace()['works'], list)
        checks.append('AI outage does not stop business workspace')
        queued = a.call('POST', '/ai/tasks', {'mode': 'family', 'prompt': '模型停机验证，不应返回示例成功。'}, {'Idempotency-Key': str(uuid.uuid4())})[1]
        deadline = time.monotonic() + 35
        while queued['status'] in ('queued', 'running') and time.monotonic() < deadline:
            time.sleep(1)
            queued = a.call('GET', '/ai/tasks/' + queued['id'])[1]
        assert queued['status'] == 'failed' and 'result' not in queued, queued.get('error')
        checks.append('AI outage produces durable explicit failure without demo fallback')
    finally:
        compose('up', '-d', '--no-deps', '--wait', 'ai')
    # A recreated container can receive a new IP; allow the JVM's DNS cache to refresh.
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        if a.call('GET', '/ai/status')[1]['enabled']:
            break
        time.sleep(2)
    else:
        raise AssertionError('AI endpoint did not recover after container recreation')
    compose('restart', '--no-deps', 'server')
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            after = a.call('GET', '/ai/tasks/' + task['id'])[1]
            assert after['result'] == before['result'] and after['model'] == before['model']
            checks.append('completed task and account session survive server restart')
            break
        except Exception:
            time.sleep(2)
    else:
        raise AssertionError('server did not recover')
    assert a.call('GET', '/ai/tasks/' + queued['id'])[1]['status'] == 'failed'
    checks.append('failed task stays failed after recovery and is not automatically charged again')
    Path('/tmp/jiafeng-ai-lifecycle-report.json').write_text(json.dumps({'checks': checks, 'failedTaskId': queued['id']}, ensure_ascii=False, indent=2))
    for check in checks:
        print('PASS', check)

if __name__ == '__main__': main()
