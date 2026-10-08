#!/usr/bin/env python3
"""Read-only browser checks for isolated review, city-directory and consultation fixtures."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from business_probe import Client, ENV, ROOT
assert ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-non-ai-')
BASE=os.environ.get('JIAFENG_TEST_URL','http://127.0.0.1:19084')
OUT=ROOT/'deploy/.local/non-ai-20261007/browser-review-regions';OUT.mkdir(exist_ok=True)
fixtures=json.loads((OUT.parent/'review-regions-acceptance.json').read_text())
admin=Client('devadmin','admin');member=Client('member_zj')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    contexts=[];errors=[];external=[]
    for name,client,admin_mode,path in [
        ('review',member,False,'/#/pages/explore/index?screen=review&id='+fixtures['submissionId']),
        ('admin-reviews',admin,True,'/admin/#/reviews'),
        ('admin-regions',admin,True,'/admin/#/settings'),
        ('venue',member,False,'/#/pkg-content/pages/index?screen=venues&id='+fixtures['venueId']),
        ('consultation',member,False,'/#/pkg-content/pages/index?screen=shop&view=records')]:
        ctx=browser.new_context(viewport={'width':1440,'height':950});contexts.append(ctx)
        storage='sessionStorage' if admin_mode else 'localStorage';key='Jiafeng-Admin-Token' if admin_mode else 'jiafeng:http:token'
        ctx.add_init_script(f'{storage}.setItem({json.dumps(key)}, {json.dumps(client.token)});')
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:external.append(r.url) if 'openstreetmap.org' in r.url else None)
        page.goto(BASE+path)
        if name=='review':
            page.get_by_text('本版本评审进度',exact=True).wait_for(timeout=25000)
            (OUT/'review-before-action.txt').write_text(page.locator('body').inner_text())
            page.get_by_text('查看评分标准',exact=True).first.click()
            page.get_by_text('隔离验收双维量表',exact=False).wait_for()
            assert page.get_by_text('试点评审量表',exact=True).count()==0
        elif name=='admin-reviews':
            page.get_by_role('heading',name='评审管理',exact=True).wait_for(timeout=25000)
            (OUT/'admin-reviews-before-action.txt').write_text(page.locator('body').inner_text())
            row=page.locator('tr').filter(has_text=fixtures['submissionId'])
            assert row.locator('.title-link').inner_text().strip()
            assert row.locator('.expert-name').inner_text().strip()
            page.get_by_role('button',name='评审流程配置',exact=True).click()
            page.get_by_role('dialog',name='评审流程配置').wait_for()
            page.get_by_role('dialog').locator('.el-collapse-item__header').first.click()
            page.get_by_text('维度标识',exact=True).first.wait_for()
        elif name=='admin-regions':
            page.get_by_role('tab',name='市县目录',exact=True).wait_for()
            (OUT/'admin-regions-before-action.txt').write_text(page.locator('body').inner_text())
            page.get_by_role('tab',name='市县目录',exact=True).click()
            page.get_by_role('button',name='全部省级地区',exact=True).wait_for()
        elif name=='venue':
            page.get_by_text('加载 OpenStreetMap 地图',exact=True).wait_for(timeout=25000)
            page.get_by_text('在地图中查看',exact=True).wait_for()
        else:
            page.get_by_text('我的公益申领与定制咨询',exact=True).wait_for(timeout=25000)
            (OUT/'consultation-before-action.txt').write_text(page.locator('body').inner_text())
            card=page.locator('.shop-record').filter(has_text=fixtures['consultationId'])
            card.get_by_text('查看咨询跟进',exact=True).click()
            card.get_by_text('参考报价：人民币 1250.50',exact=True).wait_for()
        (OUT/f'{name}-dom.txt').write_text(page.locator('body').inner_text())
        for width in [1440,390]:
            page.set_viewport_size({'width':width,'height':950})
            page.screenshot(path=str(OUT/f'{name}-{width}.png'),full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (name,width)
            if name=='admin-reviews':
                button=page.get_by_role('button',name='发布流程配置',exact=True)
                button.scroll_into_view_if_needed()
                expect(button).to_be_in_viewport()
                page.screenshot(path=str(OUT/f'{name}-footer-{width}.png'),full_page=True)
        ctx.close()
    assert not errors,errors
    assert not external, 'External map was requested before the user activated it'
    (OUT/'result.json').write_text(json.dumps({'pageErrors':errors,'mapRequestsBeforeConsent':len(external),'viewports':[1440,390],'pages':5},ensure_ascii=False,indent=2))
    browser.close()
print('PASS review/standards, admin review and city directory, venue map consent and consultation records at desktop/mobile widths; no page errors or horizontal overflow')
