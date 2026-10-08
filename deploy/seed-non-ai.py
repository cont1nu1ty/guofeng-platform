#!/usr/bin/env python3
"""Explicit extension of the branch-owned fictional showcase, never a reset."""
import argparse,importlib,datetime as dt,json
from scenarios.common import Context,base

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--module',choices=['review_regions','education_media','accounts_credentials','operations']);args=parser.parse_args()
    with base.deploy.demo_lifecycle_lock():
        ctx=Context()
        modules=[args.module] if args.module else ['review_regions','education_media','accounts_credentials','operations']
        for name in modules:
            if ctx.state['modules'].get(name)=='complete':
                print('Preserved completed sample module:',name,flush=True);continue
            importlib.import_module('scenarios.'+name).seed(ctx)
            ctx.state['modules'][name]='complete';ctx.checkpoint();print('Installed sample module:',name,flush=True)
        if all(ctx.state['modules'].get(x)=='complete' for x in ['review_regions','education_media','accounts_credentials','operations']):ctx.state.update(phase='complete',completedAt=dt.datetime.now(dt.timezone.utc).isoformat());ctx.checkpoint()
        print(json.dumps({'phase':ctx.state['phase'],'modules':ctx.state['modules'],'scenarios':len(ctx.records)},ensure_ascii=False))
if __name__=='__main__':main()
