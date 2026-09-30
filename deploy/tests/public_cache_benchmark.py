#!/usr/bin/env python3
"""Read-only anonymous workspace benchmark; counts MySQL entity SELECT digests.

Use JIAFENG_ENV_FILE to select an environment. SQL counters include concurrent
background activity, so run on a quiet isolated environment for comparisons.
"""
import argparse
import importlib.machinery
import importlib.util
import json
from pathlib import Path
import statistics
import time
import urllib.request

HERE = Path(__file__).resolve().parents[1]
loader = importlib.machinery.SourceFileLoader('cache_benchmark_deploy', str(HERE / 'dev'))
spec = importlib.util.spec_from_loader(loader.name, loader)
deploy = importlib.util.module_from_spec(spec)
loader.exec_module(deploy)


def measure(samples=30):
    env = deploy.read_env(deploy.ENV_FILE)
    url = 'http://127.0.0.1:' + env['JIAFENG_HTTP_PORT'] + '/api/v1/workspace'
    def count():
        query = ("SELECT COALESCE(SUM(COUNT_STAR),0) FROM performance_schema.events_statements_summary_by_digest "
                 "WHERE SCHEMA_NAME='jiafeng' AND DIGEST_TEXT LIKE 'SELECT%' AND DIGEST_TEXT LIKE '%jf_entity%';")
        result = deploy.compose('exec', '-T', 'mysql', 'sh', '-c',
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -N -B',
            input=query, text=True, capture_output=True)
        return int(result.stdout.strip())
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    durations, sizes = [], []
    before = count()
    for _ in range(samples):
        start = time.perf_counter()
        with opener.open(url, timeout=15) as response:
            body = response.read()
        durations.append((time.perf_counter() - start) * 1000)
        sizes.append(len(body))
        assert isinstance(json.loads(body)['works'], list)
    queries = count() - before
    return {'samples': samples, 'p50ms': statistics.median(durations),
        'p95ms': sorted(durations)[max(0, int(samples * .95) - 1)],
        'firstRequestMs': durations[0], 'responseBytes': sizes[-1],
        'jfEntitySelects': queries, 'perRequestEntitySelects': queries / samples,
        'project': env['COMPOSE_PROJECT_NAME']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--samples', type=int, default=30)
    args = parser.parse_args()
    if args.samples < 1:
        parser.error('--samples must be positive')
    result = measure(args.samples)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
